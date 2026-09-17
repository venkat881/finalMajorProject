const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[0-9]{10,15}$/;

function isStrongPassword(pw) {
  // Minimum security requirement (Section 6): at least 8 chars, one
  // letter and one number. Kept simple/college-project-appropriate
  // rather than an overly strict enterprise policy.
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (!PHONE_RE.test(phone)) {
      return res.status(400).json({ success: false, message: 'Enter a valid phone number' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters and include a letter and a number',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), phone.trim(), passwordHash]
    );

    const token = signToken({ id: result.insertId, role: 'CITIZEN' });
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: { id: result.insertId, name, email, phone },
      },
    });
  } catch (err) {
    console.error('[auth.register]', err);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

// POST /api/auth/login  (citizen)
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken({ id: user.id, role: 'CITIZEN' });
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
      },
    });
  } catch (err) {
    console.error('[auth.login]', err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
}

// POST /api/admin/login
async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT a.*, m.name AS mandal_name FROM admins a
       JOIN mandals m ON m.id = a.mandal_id
       WHERE a.email = ?`,
      [email.toLowerCase().trim()]
    );
    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken({ id: admin.id, role: 'ADMIN', mandalId: admin.mandal_id });
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          mandalId: admin.mandal_id,
          mandalName: admin.mandal_name,
        },
      },
    });
  } catch (err) {
    console.error('[auth.adminLogin]', err);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
}

// GET /api/auth/me (either role, based on token) — handy for the frontend
// to rehydrate the logged-in user after a page refresh.
async function me(req, res) {
  try {
    if (req.user.role === 'CITIZEN') {
      const [rows] = await pool.query('SELECT id, name, email, phone FROM users WHERE id = ?', [req.user.id]);
      if (!rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: { role: 'CITIZEN', user: rows[0] } });
    }
    const [rows] = await pool.query(
      `SELECT a.id, a.name, a.email, a.mandal_id, m.name AS mandal_name
       FROM admins a JOIN mandals m ON m.id = a.mandal_id WHERE a.id = ?`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Admin not found' });
    return res.json({ success: true, data: { role: 'ADMIN', admin: rows[0] } });
  } catch (err) {
    console.error('[auth.me]', err);
    return res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
}

module.exports = { register, login, adminLogin, me };
