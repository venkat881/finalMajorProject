const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { nextIssueCode } = require('../utils/idGenerator');
const { determineMandal } = require('../services/location.service');
const { classifyIssueImage, evaluateAiResult, CATEGORIES } = require('../services/ai.service');
const { checkDuplicate } = require('../services/duplicate.service');

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) // (0,0) almost always means "no real GPS fix"
  );
}

async function logHistory(connOrPool, issueId, adminId, oldStatus, newStatus, reason, note) {
  await connOrPool.query(
    `INSERT INTO issue_status_history (issue_id, admin_id, old_status, new_status, reason, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [issueId, adminId, oldStatus, newStatus, reason || null, note || null]
  );
}

// POST /api/issues  (multipart/form-data, field "photo")
async function createIssue(req, res) {
  const imageFile = req.file;
  try {
    const { category, description, address, landmark, latitude, longitude, capturedAt, mandalId } = req.body;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // ---- Backend validation (never trust the frontend alone) ----
    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `Category must be one of: ${CATEGORIES.join(', ')}` });
    }

    // If the citizen explicitly picked (or just created) a mandal, verify
    // it exists up front — fail fast before spending effort on the image/AI
    // pipeline below. Leaving this blank falls back to automatic GPS-based
    // routing further down (see "Mandal Routing" section).
    let selectedMandal = null;
    if (mandalId) {
      const [[m]] = await pool.query('SELECT id, name FROM mandals WHERE id = ?', [mandalId]);
      if (!m) {
        return res.status(400).json({ success: false, message: 'Selected mandal was not found' });
      }
      selectedMandal = m;
    }
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Please provide a short description of the issue' });
    }
    if (!address || address.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Address is required' });
    }
    if (!imageFile) {
      return res.status(400).json({ success: false, message: 'A photograph captured via the camera is required' });
    }
    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ success: false, message: 'Valid GPS location is required to submit an issue' });
    }

    // Fetch citizen name/phone from profile (Section 10 — auto-populated, not user-editable)
    const [[user]] = await pool.query('SELECT name, phone FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const issueCode = await nextIssueCode();

    const [insertResult] = await pool.query(
      `INSERT INTO issues (issue_code, user_id, category, description, address, landmark, latitude, longitude, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AI_REVIEW')`,
      [issueCode, req.user.id, category, description.trim(), address.trim(), landmark ? landmark.trim() : null, lat, lng]
    );
    const issueId = insertResult.insertId;
    await logHistory(pool, issueId, null, null, 'AI_REVIEW', null, 'Issue submitted by citizen');

    // Store image record (metadata only — capture timestamp + GPS travel with the photo, Section 13).
    // Duplicate detection no longer compares images (see duplicate.service.js),
    // so no hash is computed here anymore.
    await pool.query(
      `INSERT INTO issue_images (issue_id, image_path, latitude, longitude, captured_at)
       VALUES (?, ?, ?, ?, ?)`,
      [issueId, imageFile.filename, lat, lng, capturedAt ? new Date(capturedAt) : new Date()]
    );

    // ---- AI Verification ----
    const aiResult = await classifyIssueImage(imageFile.path, category);
    const verdict = evaluateAiResult({
      selectedCategory: category,
      aiCategory: aiResult.category,
      aiConfidence: aiResult.confidence,
      failed: aiResult.failed,
    });

    await pool.query('UPDATE issues SET ai_category = ?, ai_confidence = ? WHERE id = ?', [
      aiResult.category,
      aiResult.confidence,
      issueId,
    ]);
    await logHistory(
      pool, issueId, null, 'AI_REVIEW', 'AI_REVIEW',
      null,
      aiResult.failed
        ? 'AI verification unavailable — routed for manual review'
        : `AI verification completed (detected: ${aiResult.category}, confidence: ${aiResult.confidence}%)`
    );

    if (verdict === 'REJECT') {
      await pool.query(`UPDATE issues SET status = 'REJECTED' WHERE id = ?`, [issueId]);
      await logHistory(pool, issueId, null, 'AI_REVIEW', 'REJECTED', 'Low AI confidence / category mismatch', null);
      return res.status(200).json({
        success: false,
        message:
          aiResult.category && aiResult.category !== category
            ? `The photo appears to show a "${aiResult.category}" issue, not "${category}". Please retake the photo or choose the matching category.`
            : 'The photo could not be confidently verified. Please retake the photograph and try again.',
        data: { issueCode, status: 'REJECTED', aiCategory: aiResult.category, aiConfidence: aiResult.confidence },
      });
    }

    // ---- AI Duplicate/Location Check (only for PASS/REVIEW, i.e. not
    // already rejected on image confidence) ----
    // Simplified by request: matches on GPS proximity OR address text
    // similarity alone (an OR, not a weighted composite of many signals).
    // A strong match on either is treated as an AI rejection — the report
    // never reaches an admin, and the citizen sees the match confidence.
    const dup = await checkDuplicate({
      category,
      address: address.trim(),
      latitude: lat,
      longitude: lng,
      excludeIssueId: issueId,
    });

    if (dup.isDuplicate) {
      await pool.query(`UPDATE issues SET status = 'DUPLICATE', duplicate_of = ?, duplicate_score = ? WHERE id = ?`, [
        dup.existingIssueId,
        dup.score,
        issueId,
      ]);
      await pool.query(`UPDATE issues SET reported_count = reported_count + 1 WHERE id = ?`, [dup.existingIssueId]);
      await pool.query(
        `INSERT INTO issue_links (primary_issue_id, linked_issue_id, duplicate_score) VALUES (?, ?, ?)`,
        [dup.existingIssueId, issueId, dup.score]
      );
      await logHistory(
        pool, issueId, null, 'AI_REVIEW', 'DUPLICATE',
        null,
        `Rejected by AI — matched an existing report on ${dup.breakdown?.matchedOn || 'location/address'} (confidence ${dup.score}%)`
      );

      const [[existing]] = await pool.query('SELECT issue_code FROM issues WHERE id = ?', [dup.existingIssueId]);
      return res.status(200).json({
        success: false,
        message: `This report was rejected by AI verification — it closely matches an existing report's ${dup.breakdown?.matchedOn || 'location'} (confidence: ${dup.score}%).`,
        data: {
          issueCode,
          status: 'DUPLICATE',
          existingIssueCode: existing?.issue_code,
          duplicateScore: dup.score,
          matchedOn: dup.breakdown?.matchedOn,
        },
      });
    }

    // ---- Mandal Routing ----
    // Use the citizen's explicit selection if they made one; otherwise
    // fall back to automatic GPS-based routing (Section 14).
    const mandal = selectedMandal || (await determineMandal(lat, lng));
    const finalStatus = 'PENDING';
    await pool.query(`UPDATE issues SET status = ?, mandal_id = ?, duplicate_score = ? WHERE id = ?`, [
      finalStatus,
      mandal ? mandal.id : null,
      dup.score || null,
      issueId,
    ]);
    await logHistory(
      pool, issueId, null, 'AI_REVIEW', finalStatus,
      null,
      mandal ? `Assigned to ${mandal.name}` : 'Could not determine mandal automatically'
    );

    return res.status(201).json({
      success: true,
      message:
        verdict === 'REVIEW'
          ? 'Issue submitted successfully and flagged for admin review'
          : 'Issue submitted successfully',
      data: { issueCode, status: finalStatus, mandal: mandal ? mandal.name : null },
    });
  }   catch (err) {
    console.error('[issue.create]', err);
    // Clean up an orphaned uploaded file if something failed after upload
    if (imageFile && fs.existsSync(imageFile.path)) {
      try { fs.unlinkSync(imageFile.path); } catch (_) {}
    }
    // TEMPORARY DEBUG DETAIL: surfaces the real error message to the
    // frontend so it shows up directly in the UI instead of only in this
    // terminal. Remove the `debugDetail` field before any real deployment
    // — it can leak internal details (file paths, SQL fragments) to the client.
    return res.status(500).json({ success: false, message: 'Failed to submit issue', debugDetail: err.message });
  }
}
  

// GET /api/issues/my
async function myIssues(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.issue_code, i.category, i.description, i.address, i.status,
              i.admin_reason, i.created_at, i.completed_at,
              m.name AS mandal_name,
              (SELECT image_path FROM issue_images WHERE issue_id = i.id ORDER BY id ASC LIMIT 1) AS thumbnail,
              (SELECT r.id FROM ratings r WHERE r.issue_id = i.id AND r.user_id = i.user_id) AS rating_id
       FROM issues i
       LEFT JOIN mandals m ON m.id = i.mandal_id
       WHERE i.user_id = ?
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[issue.myIssues]', err);
    return res.status(500).json({ success: false, message: 'Failed to load your issues' });
  }
}

// GET /api/issues/:id  (citizen — must own the issue)
async function getIssueById(req, res) {
  try {
    const { id } = req.params;
    const [[issue]] = await pool.query(
      `SELECT i.*, m.name AS mandal_name, u.name AS citizen_name, u.phone AS citizen_phone
       FROM issues i
       LEFT JOIN mandals m ON m.id = i.mandal_id
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
      [id]
    );
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (req.user.role === 'CITIZEN' && issue.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this issue' });
    }

    const [images] = await pool.query('SELECT * FROM issue_images WHERE issue_id = ?', [id]);
    const [history] = await pool.query(
      'SELECT * FROM issue_status_history WHERE issue_id = ? ORDER BY created_at ASC',
      [id]
    );
    const [[rating]] = await pool.query('SELECT * FROM ratings WHERE issue_id = ? LIMIT 1', [id]);

    let duplicateOfCode = null;
    if (issue.duplicate_of) {
      const [[dupRow]] = await pool.query('SELECT issue_code FROM issues WHERE id = ?', [issue.duplicate_of]);
      duplicateOfCode = dupRow?.issue_code || null;
    }

    return res.json({ success: true, data: { ...issue, images, history, rating: rating || null, duplicateOfCode } });
  } catch (err) {
    console.error('[issue.getById]', err);
    return res.status(500).json({ success: false, message: 'Failed to load issue' });
  }
}

module.exports = { createIssue, myIssues, getIssueById };