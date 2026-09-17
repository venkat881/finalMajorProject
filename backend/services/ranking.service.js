/**
 * Mandal Ranking Service
 * ---------------------------------------------------------------
 * Computes a composite performance score per mandal (Section 30):
 *
 *   Mandal Score = W1 * Resolution Rate
 *                + W2 * Average Citizen Rating (normalized to 0-100)
 *                + W3 * Resolution Speed (normalized to 0-100, faster = higher)
 *
 * Weights are configurable via .env so they can be tuned without a
 * code change (and must sum to 100).
 */

const { pool } = require('../config/db');

function getWeights() {
  const w1 = Number(process.env.RANKING_WEIGHT_RESOLUTION_RATE || 40);
  const w2 = Number(process.env.RANKING_WEIGHT_AVERAGE_RATING || 30);
  const w3 = Number(process.env.RANKING_WEIGHT_RESOLUTION_SPEED || 30);
  return { w1, w2, w3 };
}

async function computeMandalRankings() {
  const [mandals] = await pool.query('SELECT id, name FROM mandals ORDER BY id');
  const { w1, w2, w3 } = getWeights();

  const stats = [];
  for (const mandal of mandals) {
    const [[counts]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'COMPLETED') AS completed,
         SUM(status = 'CANT_TAKEUP') AS cant_takeup,
         SUM(status = 'PENDING') AS pending,
         AVG(CASE WHEN status = 'COMPLETED' AND completed_at IS NOT NULL
                  THEN TIMESTAMPDIFF(HOUR, created_at, completed_at) END) AS avg_resolution_hours
       FROM issues
       WHERE mandal_id = ?
         AND status IN ('COMPLETED','CANT_TAKEUP','PENDING')`,
      [mandal.id]
    );

    const [[ratingRow]] = await pool.query(
      `SELECT AVG(r.rating) AS avg_rating, COUNT(r.id) AS rating_count
       FROM ratings r
       JOIN issues i ON i.id = r.issue_id
       WHERE i.mandal_id = ?`,
      [mandal.id]
    );

    const total = Number(counts.total || 0);
    const completed = Number(counts.completed || 0);
    const cantTakeup = Number(counts.cant_takeup || 0);
    const resolvedOrClosed = completed + cantTakeup;
    const resolutionRate = resolvedOrClosed > 0 ? (completed / resolvedOrClosed) * 100 : 0;
    const avgRating = ratingRow.avg_rating ? Number(ratingRow.avg_rating) : null;
    const avgResolutionHours = counts.avg_resolution_hours ? Number(counts.avg_resolution_hours) : null;

    stats.push({
      mandalId: mandal.id,
      mandalName: mandal.name,
      total,
      completed,
      cantTakeup,
      pending: Number(counts.pending || 0),
      resolutionRate,
      avgRating,
      ratingCount: Number(ratingRow.rating_count || 0),
      avgResolutionHours,
    });
  }

  // Normalize resolution speed across mandals: fastest average resolution
  // time -> 100, slowest -> 0 (mandals with no completed issues yet get 0).
  const speedCandidates = stats.filter((s) => s.avgResolutionHours !== null);
  const minHours = speedCandidates.length ? Math.min(...speedCandidates.map((s) => s.avgResolutionHours)) : 0;
  const maxHours = speedCandidates.length ? Math.max(...speedCandidates.map((s) => s.avgResolutionHours)) : 0;

  for (const s of stats) {
    let speedScore = 0;
    if (s.avgResolutionHours !== null) {
      speedScore = maxHours === minHours ? 100 : 100 * (1 - (s.avgResolutionHours - minHours) / (maxHours - minHours));
    }
    const ratingScore = s.avgRating !== null ? (s.avgRating / 5) * 100 : 0;

    s.speedScore = Math.round(speedScore);
    s.ratingScore = Math.round(ratingScore);
    s.score = Math.round((w1 * s.resolutionRate + w2 * ratingScore + w3 * speedScore) / 100);
  }

  stats.sort((a, b) => b.score - a.score);
  return stats.map((s, i) => ({ rank: i + 1, ...s }));
}

module.exports = { computeMandalRankings, getWeights };
