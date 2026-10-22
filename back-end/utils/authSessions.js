const AuthSession = require('../models/AuthSession');
const User = require('../models/User');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function createAuthSession(userId) {
  const session = await AuthSession.create({
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return session;
}

async function revokeAuthSession(sessionId, userId) {
  await AuthSession.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

async function revokeUserSessions(userId) {
  await AuthSession.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

async function invalidateUserSessions(userId) {
  await User.updateOne({ _id: userId }, { $inc: { authVersion: 1 } });
  await revokeUserSessions(userId);
}

module.exports = { createAuthSession, revokeAuthSession, revokeUserSessions, invalidateUserSessions };
