const { pool } = require('../config/db');

// GET /api/mandals — used to populate the mandal dropdown on Report Issue
async function listMandals(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, name FROM mandals ORDER BY name ASC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[mandal.list]', err);
    return res.status(500).json({ success: false, message: 'Failed to load mandals' });
  }
}

// POST /api/mandals   body: { name }
// Lets a citizen add a mandal that isn't in the list yet. Created with no
// GPS boundary — it will only ever be assigned by explicit selection,
// never by automatic lat/lng routing (see location.service.js).
async function createMandal(req, res) {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Mandal name must be at least 2 characters' });
    }
    const trimmed = name.trim();

    const [existing] = await pool.query('SELECT id, name FROM mandals WHERE LOWER(name) = LOWER(?)', [trimmed]);
    if (existing.length > 0) {
      // Already exists — just hand back the existing one instead of erroring,
      // so the frontend can use it transparently.
      return res.status(200).json({ success: true, message: 'Mandal already exists', data: existing[0] });
    }

    const [result] = await pool.query(
      'INSERT INTO mandals (name, min_lat, max_lat, min_lng, max_lng) VALUES (?, NULL, NULL, NULL, NULL)',
      [trimmed]
    );
    return res.status(201).json({ success: true, message: 'Mandal created', data: { id: result.insertId, name: trimmed } });
  } catch (err) {
    console.error('[mandal.create]', err);
    return res.status(500).json({ success: false, message: 'Failed to create mandal' });
  }
}

module.exports = { listMandals, createMandal };
