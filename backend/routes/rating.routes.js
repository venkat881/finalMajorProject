const express = require('express');
const router = express.Router();
const { submitRating, getRating } = require('../controllers/rating.controller');
const { authenticate, requireCitizen } = require('../middleware/auth.middleware');

router.post('/issues/:id/rating', authenticate, requireCitizen, submitRating);
router.get('/issues/:id/rating', authenticate, getRating);

module.exports = router;
