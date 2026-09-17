const { pool } = require('../config/db');

// POST /api/issues/:id/rating   body: { rating: 1-5, comment? }
async function submitRating(req, res) {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    const [[issue]] = await pool.query('SELECT * FROM issues WHERE id = ?', [id]);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only rate your own complaints' });
    }
    // Rule 6: a citizen can rate only completed complaints.
    if (issue.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, message: 'Only completed issues can be rated' });
    }

    try {
      await pool.query('INSERT INTO ratings (issue_id, user_id, rating, comment) VALUES (?, ?, ?, ?)', [
        id,
        req.user.id,
        ratingNum,
        comment ? comment.trim() : null,
      ]);
    } catch (err) {
      // Rule 7: unique(issue_id, user_id) constraint blocks a second rating.
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'You have already rated this issue' });
      }
      throw err;
    }

    return res.status(201).json({ success: true, message: 'Thank you for your feedback' });
  } catch (err) {
    console.error('[rating.submit]', err);
    return res.status(500).json({ success: false, message: 'Failed to submit rating' });
  }
}

// GET /api/issues/:id/rating
async function getRating(req, res) {
  try {
    const { id } = req.params;
    const [[rating]] = await pool.query('SELECT * FROM ratings WHERE issue_id = ? LIMIT 1', [id]);
    return res.json({ success: true, data: rating || null });
  } catch (err) {
    console.error('[rating.get]', err);
    return res.status(500).json({ success: false, message: 'Failed to load rating' });
  }
}

module.exports = { submitRating, getRating };
