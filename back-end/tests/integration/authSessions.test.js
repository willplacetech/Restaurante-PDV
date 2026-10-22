const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const User = require('../../models/User');
const AuthSession = require('../../models/AuthSession');
const Auditoria = require('../../models/Auditoria');
const auth = require('../../middleware/auth');

const jwtSecret = process.env.JWT_SECRET || 'restaurante-pdv-secret-key';
const app = express();
app.use(express.json());
app.use('/api/auth', require('../../routes/auth'));
app.get('/auth-contract', auth, (req, res) => res.json({
  id: req.user._id,
  role: req.user.role,
  username: req.user.username,
  active: req.user.active,
}));

describe('auth session lifecycle', () => {
  let admin;
  let target;
  let adminToken;

  beforeEach(async () => {
    admin = await User.create({ username: 'auth-admin', password: 'admin-pass', role: 'admin' });
    target = await User.create({ username: 'auth-target', password: 'target-pass', role: 'operador' });
    adminToken = jwt.sign({ id: admin._id, role: admin.role }, jwtSecret, { expiresIn: '1h' });
  });

  afterEach(() => jest.restoreAllMocks());

  const login = async (username = 'auth-target', password = 'target-pass') => request(app)
    .post('/api/auth/login')
    .send({ username, password });

  test('persists a session and issues a token bound to its current auth version', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    const claims = jwt.verify(response.body.token, jwtSecret);
    expect(claims.sessionId).toBeTruthy();
    expect(claims.authVersion).toBe(0);
    await expect(AuthSession.findById(claims.sessionId)).resolves.toMatchObject({
      userId: target._id,
      revokedAt: null,
    });
  });

  test('preserves the authenticated user fields consumed by existing routes', async () => {
    const { body } = await login();

    const response = await request(app).get('/auth-contract').set('Authorization', `Bearer ${body.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: String(target._id),
      role: 'operador',
      username: 'auth-target',
      active: true,
    });
  });

  test('logout revokes a newly issued session token', async () => {
    const { body } = await login();
    const claims = jwt.verify(body.token, jwtSecret);

    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${body.token}`);
    const current = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(logout.status).toBe(200);
    expect(current.status).toBe(401);
    expect((await AuthSession.findById(claims.sessionId)).revokedAt).toBeInstanceOf(Date);
  });

  test('uses the current database role rather than a stale JWT role', async () => {
    const token = jwt.sign({ id: target._id, role: 'admin' }, jwtSecret, { expiresIn: '1h' });

    const response = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  test('rejects disabled and archived users', async () => {
    const token = jwt.sign({ id: target._id }, jwtSecret, { expiresIn: '1h' });
    target.active = false;
    target.archivedAt = new Date();
    await target.save();

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  test('does not issue sessions to archived users', async () => {
    target.active = true;
    target.archivedAt = new Date();
    await target.save();

    const response = await login();

    expect(response.status).toBe(403);
    expect(await AuthSession.countDocuments({ userId: target._id })).toBe(0);
  });

  test.each([
    ['role change', { role: 'atendente' }],
    ['password reset', { password: 'new-target-pass' }],
  ])('invalidates sessions after a %s', async (_change, update) => {
    const { body } = await login();
    const claims = jwt.verify(body.token, jwtSecret);
    const secondBody = (await login()).body;
    const secondClaims = jwt.verify(secondBody.token, jwtSecret);

    const changed = await request(app)
      .patch(`/api/auth/users/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(update);
    const current = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    const secondCurrent = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${secondBody.token}`);

    expect(changed.status).toBe(200);
    expect(current.status).toBe(401);
    expect(secondCurrent.status).toBe(401);
    expect((await User.findById(target._id)).authVersion).toBe(1);
    expect((await AuthSession.findById(claims.sessionId)).revokedAt).toBeInstanceOf(Date);
    expect((await AuthSession.findById(secondClaims.sessionId)).revokedAt).toBeInstanceOf(Date);
  });

  test('invalidates sessions when a user is disabled', async () => {
    const { body } = await login();
    const claims = jwt.verify(body.token, jwtSecret);

    const disabled = await request(app)
      .patch(`/api/auth/users/${target._id}/active`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false });
    const current = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);

    expect(disabled.status).toBe(200);
    expect(current.status).toBe(403);
    expect((await User.findById(target._id)).authVersion).toBe(1);
    expect((await AuthSession.findById(claims.sessionId)).revokedAt).toBeInstanceOf(Date);
  });

  test('rejects a legacy token after logout revokes legacy sessions', async () => {
    const legacyToken = jwt.sign({ id: target._id, role: target.role }, jwtSecret, { expiresIn: '1h' });

    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${legacyToken}`);
    const current = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${legacyToken}`);

    expect(logout.status).toBe(200);
    expect(current.status).toBe(401);
  });

  test('reports login audit failure and does not create a session', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Auditoria, 'create').mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await login();

    expect(response.status).toBe(500);
    expect(await AuthSession.countDocuments({ userId: target._id })).toBe(0);
  });

  test('reports user-change audit failure instead of swallowing it', async () => {
    const responseLogin = await login();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Auditoria, 'create').mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await request(app)
      .patch(`/api/auth/users/${target._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'atendente' });

    expect(response.status).toBe(500);
    expect(response.body.message).toMatch(/auditoria/i);
    expect((await User.findById(target._id)).role).toBe('atendente');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${responseLogin.body.token}`)).status).toBe(401);
  });
});
