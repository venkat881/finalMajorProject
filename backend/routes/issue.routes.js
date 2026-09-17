const express = require('express');
const router = express.Router();
const { createIssue, myIssues, getIssueById } = require('../controllers/issue.controller');
const { authenticate, requireCitizen } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

router.post('/issues', authenticate, requireCitizen, upload.single('photo'), createIssue);
router.get('/issues/my', authenticate, requireCitizen, myIssues);
router.get('/issues/:id', authenticate, getIssueById);

module.exports = router;
