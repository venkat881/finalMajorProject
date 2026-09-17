const express = require('express');
const router = express.Router();
const {
  listIssues, getIssueById, updateStatus, statistics, rankings, mandalIssues,
} = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');

router.use(authenticate, requireAdmin);

router.get('/admin/issues', listIssues);
router.get('/admin/issues/:id', getIssueById);
router.put('/admin/issues/:id/status', updateStatus);
router.get('/admin/statistics', statistics);
router.get('/admin/rankings', rankings);
router.get('/admin/mandals/:id/issues', mandalIssues);

module.exports = router;
