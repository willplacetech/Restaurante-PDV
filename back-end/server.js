require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const colors = require('colors');
const path = require('path');
const connectDB = require('./db');
const User = require('./models/User');

const app = express();

// ============================================================
// CORS — CONFIGURAÇÃO CORRIGIDA
// ============================================================
const allowedOrigins = [
  'https://restaurante-pdv.onrender.com',   // ← origem fixa (garantia)
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL || '').split(','),
]
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isRenderOrigin = (origin) => /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin);

const corsOptions = {
  origin: (requestOrigin, callback) => {
    const normalizedOrigin = requestOrigin?.replace(/\/$/, '');
    // Libera se: origem vazia (apps móveis/Postman), na lista, ou é *.onrender.com
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin) || isRenderOrigin(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não autorizada pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// ============================================================
// MIDDLEWARES — ORDEM CORRIGIDA: CORS PRIMEIRO, depois helmet
// ============================================================
app.disable('x-powered-by');

// 1) CORS PRIMEIRO — antes de TUDO (inclusive helmet)
app.use(cors(corsOptions));
// Responde preflight OPTIONS para QUALQUER rota
app.options('*', cors(corsOptions));

// 2) Helmet DEPOIS do cors — CSP desligado para não bloquear scripts/fontes
app.use(helmet({ contentSecurityPolicy: false }));

// 3) JSON
app.use(express.json({ limit: '1mb' }));

// 4) Parse manual de cookies (mantido do seu código)
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  req.cookies = Object.fromEntries(
    cookieHeader.split(';').filter(Boolean).map((cookie) => {
      const separator = cookie.indexOf('=');
      return [cookie.slice(0, separator).trim(), decodeURIComponent(cookie.slice(separator + 1).trim())];
    })
  );
  next();
});

// ============================================================
// RATE LIMIT — login
// ============================================================
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { msg: 'Muitas tentativas de login. Tente novamente mais tarde.' },
}));

// ============================================================
// ROTAS DA API
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/production', require('./routes/production'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/comandas', require('./routes/comandas'));
app.use('/api/caixa', require('./routes/caixa'));
app.use('/api/fiscal', require('./routes/fiscal'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/despesas', require('./routes/despesas'));
app.use('/api/contabil', require('./routes/contabil'));
app.use('/api/insumos', require('./routes/insumos'));
app.use('/api/compras', require('./routes/purchases'));
app.use('/api/receitas', require('./routes/receitas'));
app.use('/api/produtos', require('./routes/products'));

// Rota base da API
app.get('/api', (req, res) => {
  res.json({
    msg: 'API PDV Restaurante funcionando!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      production: '/api/production',
      customers: '/api/customers',
      orders: '/api/orders',
      comandas: '/api/comandas',
      fiscal: '/api/fiscal'
    }
  });
});

// ============================================================
// FRONTEND SPA (Vite/React) — fica DEPOIS das rotas de API
// ============================================================
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ============================================================
// TRATAMENTO DE ERRO GLOBAL
// ============================================================
app.use((err, req, res, next) => {
  console.error(err.stack ? err.stack.red : String(err).red);
  // Não vazar detalhes de erro CORS para o cliente
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ msg: 'Origem não autorizada' });
  }
  res.status(500).json({ msg: 'Erro interno do servidor' });
});

// ============================================================
// SUBIR SERVIDOR + CRIAR ADMIN SE NÃO EXISTIR
// ============================================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';

  if (!await User.exists({ username: adminUsername })) {
    await User.create({
      username: adminUsername,
      password: adminPassword,
      role: 'admin'
    });
    console.log(`Administrador inicial "${adminUsername}" criado.`.green);
  } else {
    console.log(`Administrador "${adminUsername}" já existe.`.cyan);
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`.yellow.bold);
    console.log(`Origens permitidas: ${allowedOrigins.join(', ') || '(nenhuma fixa, só *.onrender.com)'}`.gray);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;