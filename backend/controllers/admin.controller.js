const { pool } = require('../config/db');
const { computeMandalRankings } = require('../services/ranking.service');

async function logHistory(issueId, adminId, oldStatus, newStatus, reason, note) {
  await pool.query(
    `INSERT INTO issue_status_history (issue_id, admin_id, old_status, new_status, reason, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [issueId, adminId, oldStatus, newStatus, reason || null, note || null]
  );
}

// GET /api/admin/issues?category=&status=&date=&mandalId=
// Unified single dashboard: any authenticated admin sees complaints across
// every mandal, with mandal as an optional filter rather than a hard lock.
// (Per-mandal restriction removed by request — a future "rank based"
// permission layer can reintroduce scoped access on top of this.)
async function listIssues(req, res) {
  try {
    const { category, status, date, mandalId } = req.query;
    const conditions = [];
    const params = [];

    if (mandalId) {
      conditions.push('i.mandal_id = ?');
      params.push(mandalId);
    }
    if (category) {
      conditions.push('i.category = ?');
      params.push(category);
    }
    if (status) {
      conditions.push('i.status = ?');
      params.push(status);
    }
    if (date) {
      conditions.push('DATE(i.created_at) = ?');
      params.push(date);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT i.id, i.issue_code, i.category, i.address, i.status, i.ai_confidence,
              i.duplicate_score, i.reported_count, i.created_at,
              u.name AS citizen_name,
              m.name AS mandal_name,
              (SELECT image_path FROM issue_images WHERE issue_id = i.id ORDER BY id ASC LIMIT 1) AS thumbnail
       FROM issues i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN mandals m ON m.id = i.mandal_id
       ${whereClause}
       ORDER BY i.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[admin.listIssues]', err);
    return res.status(500).json({ success: false, message: 'Failed to load issues' });
  }
}

// GET /api/admin/issues/:id
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

    const [images] = await pool.query('SELECT * FROM issue_images WHERE issue_id = ?', [id]);
    const [history] = await pool.query(
      `SELECT h.*, a.name AS admin_name FROM issue_status_history h
       LEFT JOIN admins a ON a.id = h.admin_id
       WHERE h.issue_id = ? ORDER BY h.created_at ASC`,
      [id]
    );
    const [[rating]] = await pool.query('SELECT * FROM ratings WHERE issue_id = ? LIMIT 1', [id]);
    const [linkedReports] = await pool.query(
      `SELECT i.issue_code, i.created_at FROM issue_links l
       JOIN issues i ON i.id = l.linked_issue_id
       WHERE l.primary_issue_id = ?`,
      [id]
    );

    return res.json({ success: true, data: { ...issue, images, history, rating: rating || null, linkedReports } });
  } catch (err) {
    console.error('[admin.getIssueById]', err);
    return res.status(500).json({ success: false, message: 'Failed to load issue' });
  }
}

// PUT /api/admin/issues/:id/status   body: { status: 'COMPLETED'|'CANT_TAKEUP', reason? }
// NOTE: unlike listIssues/getIssueById (which are intentionally unified —
// any admin can browse/view every mandal's issues), this action is
// deliberately still locked to the issue's own mandal. Viewing everything
// in one dashboard is fine; letting any admin close out any other
// mandal's complaints is not — that's still "dedicated credentials"
// territory (Rule 4 of the original spec).
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['COMPLETED', 'CANT_TAKEUP'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be COMPLETED or CANT_TAKEUP' });
    }
    // Backend-enforced mandatory reason (Section 26 / Rule 5) — never rely on frontend alone.
    if (status === 'CANT_TAKEUP' && (!reason || reason.trim().length < 5)) {
      return res.status(400).json({ success: false, message: 'A reason is required when an issue cannot be taken up' });
    }

    const [[issue]] = await pool.query('SELECT * FROM issues WHERE id = ?', [id]);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.mandal_id !== req.user.mandalId) {
      return res.status(403).json({ success: false, message: 'This issue belongs to a different mandal — only that mandal\'s admin can act on it' });
    }
    if (!['PENDING'].includes(issue.status)) {
      return res.status(409).json({ success: false, message: `Issue is currently "${issue.status}" and cannot be updated` });
    }

    const completedAt = status === 'COMPLETED' ? new Date() : null;
    await pool.query('UPDATE issues SET status = ?, admin_reason = ?, completed_at = ? WHERE id = ?', [
      status,
      status === 'CANT_TAKEUP' ? reason.trim() : null,
      completedAt,
      id,
    ]);
    await logHistory(id, req.user.id, issue.status, status, status === 'CANT_TAKEUP' ? reason.trim() : null, null);

    return res.json({ success: true, message: `Issue marked as ${status}`, data: { status } });
  } catch (err) {
    console.error('[admin.updateStatus]', err);
    return res.status(500).json({ success: false, message: 'Failed to update issue status' });
  }
}

// GET /api/admin/statistics?mandalId=   — city-wide by default, or a single
// mandal's numbers if mandalId is passed (drives the dashboard filter).
async function statistics(req, res) {
  try {
    const { mandalId } = req.query;
    const whereClause = mandalId ? 'WHERE mandal_id = ?' : '';
    const params = mandalId ? [mandalId] : [];

    const [[overall]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'PENDING') AS pending,
         SUM(status = 'COMPLETED') AS completed,
         SUM(status = 'CANT_TAKEUP') AS cant_takeup
       FROM issues ${whereClause}`,
      params
    );

    const [byCategory] = await pool.query(
      `SELECT category, COUNT(*) AS count FROM issues ${whereClause} GROUP BY category`,
      params
    );

    const [byMandal] = await pool.query(
      `SELECT m.name AS mandal_name, COUNT(i.id) AS count
       FROM mandals m LEFT JOIN issues i ON i.mandal_id = m.id
       GROUP BY m.id, m.name
       ORDER BY m.name`
    );

    const ratingWhere = mandalId ? 'WHERE i.mandal_id = ?' : '';
    const [[ratingRow]] = await pool.query(
      `SELECT AVG(r.rating) AS avg_rating, COUNT(r.id) AS rating_count
       FROM ratings r JOIN issues i ON i.id = r.issue_id ${ratingWhere}`,
      params
    );

    const resolvedOrClosed = Number(overall.completed || 0) + Number(overall.cant_takeup || 0);
    const resolutionRate = resolvedOrClosed > 0 ? Math.round((overall.completed / resolvedOrClosed) * 100) : 0;

    return res.json({
      success: true,
      data: {
        total: Number(overall.total || 0),
        pending: Number(overall.pending || 0),
        completed: Number(overall.completed || 0),
        cantTakeup: Number(overall.cant_takeup || 0),
        resolutionRate,
        averageRating: ratingRow.avg_rating ? Number(ratingRow.avg_rating).toFixed(2) : null,
        byCategory,
        byMandal,
      },
    });
  } catch (err) {
    console.error('[admin.statistics]', err);
    return res.status(500).json({ success: false, message: 'Failed to load statistics' });
  }
}

// GET /api/admin/rankings — city-wide leaderboard
async function rankings(req, res) {
  try {
    const data = await computeMandalRankings();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[admin.rankings]', err);
    return res.status(500).json({ success: false, message: 'Failed to compute rankings' });
  }
}

// GET /api/admin/mandals/:id/issues — read-only cross-mandal view
async function mandalIssues(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT i.id, i.issue_code, i.category, i.status, i.created_at
       FROM issues i WHERE i.mandal_id = ? ORDER BY i.created_at DESC LIMIT 200`,
      [id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[admin.mandalIssues]', err);
    return res.status(500).json({ success: false, message: 'Failed to load mandal issues' });
  }
}

module.exports = { listIssues, getIssueById, updateStatus, statistics, rankings, mandalIssues };