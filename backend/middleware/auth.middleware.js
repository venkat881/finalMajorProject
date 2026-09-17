const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT and attaches { id, role, mandalId? } to req.user.
 * Used for BOTH citizen and admin protected routes — role-specific
 * checks happen in admin.middleware.js on top of this.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token missing' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, mandalId? }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Ensures the authenticated principal is a citizen (not an admin token
 * used against a citizen-only route).
 */
function requireCitizen(req, res, next) {
  if (!req.user || req.user.role !== 'CITIZEN') {
    return res.status(403).json({ success: false, message: 'Citizen access required' });
  }
  next();
}

module.exports = { authenticate, requireCitizen };
