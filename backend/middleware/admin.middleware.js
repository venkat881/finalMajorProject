/**
 * Enforces: Authenticated + Role = ADMIN (Section 8).
 * Must run AFTER `authenticate` in the middleware chain.
 * A citizen JWT hitting an admin route is rejected here with 403,
 * satisfying Rule 4 / Section 8's authorization requirement.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

module.exports = { requireAdmin };
