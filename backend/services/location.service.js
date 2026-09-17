/**
 * Location / Mandal Routing Service
 * ---------------------------------------------------------------
 * Determines which mandal an incoming complaint belongs to, based on
 * the GPS coordinates captured on submission (Section 14).
 *
 * For this prototype, each mandal is defined by a simple lat/lng
 * bounding box (see db/schema.sql + db/seed.js). This is intentionally
 * simple and NOT how real administrative boundaries work (they're
 * irregular polygons) — it is designed to be swapped out later for:
 *   - a proper polygon-in-point check (e.g. using a `mandal_boundaries`
 *     GeoJSON table + a library such as `@turf/boolean-point-in-polygon`), or
 *   - a call to a government GIS/boundary API.
 * Every other part of the system only depends on `mandal_id`, so
 * changing the matching strategy here doesn't require changes elsewhere.
 */

const { pool } = require('../config/db');
const { distanceInMeters } = require('../utils/geo');

/**
 * @returns {Promise<{id:number, name:string}|null>}
 */
async function determineMandal(latitude, longitude) {
  const [allMandals] = await pool.query('SELECT * FROM mandals');

  // Manually-added mandals (created by a citizen at report time, with no
  // GPS boundary) are only ever chosen by explicit selection — never by
  // auto-detection — so exclude them here.
  const mandals = allMandals.filter(
    (m) => m.min_lat !== null && m.max_lat !== null && m.min_lng !== null && m.max_lng !== null
  );

  // 1. Exact bounding-box match
  const match = mandals.find(
    (m) =>
      latitude >= m.min_lat &&
      latitude <= m.max_lat &&
      longitude >= m.min_lng &&
      longitude <= m.max_lng
  );
  if (match) return { id: match.id, name: match.name };

  // 2. Fallback: outside every defined box (e.g. edge of the city) ->
  // assign to whichever mandal's box-center is nearest, so a complaint
  // is never left unrouted. Flag-worthy for future real-boundary data.
  if (mandals.length === 0) return null;

  let nearest = null;
  let nearestDist = Infinity;
  for (const m of mandals) {
    const centerLat = (Number(m.min_lat) + Number(m.max_lat)) / 2;
    const centerLng = (Number(m.min_lng) + Number(m.max_lng)) / 2;
    const d = distanceInMeters(latitude, longitude, centerLat, centerLng);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = m;
    }
  }
  return nearest ? { id: nearest.id, name: nearest.name } : null;
}

module.exports = { determineMandal };
