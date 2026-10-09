require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { requireAuth } = require('./auth');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateProfile(body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const workStatus = String(body.workStatus || '');
  if (name.length < 2 || name.length > 100) return 'Name must be 2–100 characters.';
  if (!emailPattern.test(email) || email.length > 254) return 'Enter a valid email address.';
  if (!/^[0-9+() .-]{7,30}$/.test(phone)) return 'Enter a valid phone number.';
  if (!['Student', 'Employee'].includes(workStatus)) return 'Choose Student or Employee.';
  return { name, email, phone, workStatus };
}
function publicUser(row) {
  return {
    id: row.id, name: row.name, email: row.email, phone: row.phone,
    workStatus: row.work_status, createdAt: row.created_at
  };
}
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error', database: 'unavailable' }); }
});

app.post('/api/auth/register', async (req, res) => {
  const profile = validateProfile(req.body);
  const password = String(req.body.password || '');
  if (typeof profile === 'string') return res.status(400).json({ message: profile });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ message: 'Password must be 8–72 characters.' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (name,email,phone,work_status,password_hash) VALUES (?,?,?,?,?)',
      [profile.name, profile.email, profile.phone, profile.workStatus, await bcrypt.hash(password, 12)]
    );
    const user = { id: result.insertId, email: profile.email };
    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    console.error('Registration error:', err.code || 'unknown');
    res.status(500).json({ message: 'Could not register right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!emailPattern.test(email) || !password) return res.status(400).json({ message: 'Enter your email and password.' });
  try {
    const [rows] = await pool.execute('SELECT id,email,password_hash FROM users WHERE email=? LIMIT 1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    const user = { id: rows[0].id, email: rows[0].email };
    res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Login error:', err.code || 'unknown');
    res.status(500).json({ message: 'Could not log in right now.' });
  }
});

app.get('/api/users', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id,name,email,phone,work_status,created_at FROM users ORDER BY created_at DESC');
    res.json({ users: rows.map(publicUser) });
  } catch (err) {
    console.error('List users error:', err.code || 'unknown');
    res.status(500).json({ message: 'Could not load users.' });
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid user ID.' });
  if (id !== Number(req.user.id)) return res.status(403).json({ message: 'You can update only your own profile.' });
  const profile = validateProfile(req.body);
  if (typeof profile === 'string') return res.status(400).json({ message: profile });
  try {
    await pool.execute('UPDATE users SET name=?,email=?,phone=?,work_status=? WHERE id=?',
      [profile.name, profile.email, profile.phone, profile.workStatus, id]);
    res.json({ message: 'Profile updated.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That email is already registered.' });
    console.error('Update error:', err.code || 'unknown');
    res.status(500).json({ message: 'Could not update profile.' });
  }
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid user ID.' });
  if (id !== Number(req.user.id)) return res.status(403).json({ message: 'You can delete only your own account.' });
  try {
    await pool.execute('DELETE FROM users WHERE id=?', [id]);
    res.json({ message: 'Account deleted.' });
  } catch (err) {
    console.error('Delete error:', err.code || 'unknown');
    res.status(500).json({ message: 'Could not delete account.' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled request error:', err.message);
  res.status(500).json({ message: 'Unexpected server error.' });
});

const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set to a random secret of at least 32 characters.');
  process.exit(1);
}
app.listen(port, '0.0.0.0', () => console.log(`API listening on port ${port}`));
