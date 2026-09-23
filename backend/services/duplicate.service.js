/**
 * Duplicate / AI-Rejection Service
 * ---------------------------------------------------------------
 * Simplified by request: instead of a multi-signal composite score
 * (which included an unreliable image-hash comparison — see git history
 * for the earlier version, which caused false-positive duplicates on
 * dark/low-detail test photos), this checks exactly two independent
 * signals against every open complaint in the same category:
 *
 *   1. GPS proximity — is the new report within DUPLICATE_GPS_RADIUS_METERS
 *      of an existing one?
 *   2. Address text similarity — does the new report's address closely
 *      match an existing one's address string?
 *
 * Either signal alone clearing DUPLICATE_SCORE_THRESHOLD is enough to
 * flag a match (an OR, not a weighted composite) — the idea being that a
 * near-identical address is just as strong a signal as being GPS-close,
 * even if the other signal is weak or noisy.
 *
 * When a match is found, the new report is rejected by AI before it ever
 * reaches an admin — see issue.controller.js's handling of isDuplicate.
 */

const stringSimilarity = require('string-similarity');
const { pool } = require('../config/db');
const { distanceInMeters, gpsSimilarityScore } = require('../utils/geo');

/**
 * Looks for an existing open complaint that likely represents the same
 * real-world issue as the one just submitted, based on GPS proximity or
 * address text similarity.
 *
 * @param {object} params
 * @param {string} params.category
 * @param {string} params.address
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.excludeIssueId] - the id of the issue currently
 *   being created. It's already inserted into the DB by the time this runs
 *   (so it can be linked to an image/history), so it MUST be excluded here
 *   — otherwise every new issue matches itself (same GPS, same address)
 *   and gets incorrectly flagged as its own duplicate.
 * @returns {Promise<{isDuplicate:boolean, score:number, existingIssueId:number|null, breakdown:object}>}
 */
async function checkDuplicate({ category, address, latitude, longitude, excludeIssueId }) {
  const radius = Number(process.env.DUPLICATE_GPS_RADIUS_METERS || 100);
  const threshold = Number(process.env.DUPLICATE_SCORE_THRESHOLD || 75);

  // Only compare against open (still-relevant) complaints in the same
  // category, excluding the issue currently being processed.
  const [candidates] = await pool.query(
    `SELECT id, address, latitude, longitude
     FROM issues
     WHERE category = ?
       AND status IN ('PENDING', 'AI_REVIEW')
       AND duplicate_of IS NULL
       AND id != ?`,
    [category, excludeIssueId || 0]
  );

  if (candidates.length === 0) {
    return { isDuplicate: false, score: 0, existingIssueId: null, breakdown: null };
  }

  const newAddress = (address || '').trim().toLowerCase();

  let best = null;
  for (const c of candidates) {
    const dist = distanceInMeters(latitude, longitude, Number(c.latitude), Number(c.longitude));
    const gpsScore = gpsSimilarityScore(dist, radius);

    const addressScore = Math.round(
      stringSimilarity.compareTwoStrings(newAddress, (c.address || '').trim().toLowerCase()) * 100
    );

    // Either signal alone can trigger a match — take whichever is stronger.
    // If both are strongly matched (within 10 points of each other and
    // both high), report "both" rather than arbitrarily picking one —
    // that's the literal-same-report case, not a coincidental match on
    // just one signal.
    const matchScore = Math.max(gpsScore, addressScore);
    let matchedOn;
    if (gpsScore >= 70 && addressScore >= 70 && Math.abs(gpsScore - addressScore) <= 10) {
      matchedOn = 'both location and address';
    } else {
      matchedOn = gpsScore >= addressScore ? 'location' : 'address';
    }

    console.log(
      `[duplicate.service] vs issue #${c.id}: distance=${Math.round(dist)}m gpsScore=${gpsScore} addressScore=${addressScore} -> matchScore=${matchScore} (threshold=${threshold})`
    );

    if (!best || matchScore > best.score) {
      best = {
        existingIssueId: c.id,
        score: matchScore,
        breakdown: { gpsScore, addressScore, matchedOn, distanceMeters: Math.round(dist) },
      };
    }
  }

  if (best && best.score >= threshold) {
    return { isDuplicate: true, ...best };
  }
  return { isDuplicate: false, score: best ? best.score : 0, existingIssueId: null, breakdown: best?.breakdown || null };
}

module.exports = { checkDuplicate };