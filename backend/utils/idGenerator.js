const { pool } = require('../config/db');

/**
 * Generates the next human-readable issue code: CIV-000001, CIV-000002, ...
 * Uses a dedicated counters table + row lock so concurrent submissions
 * never collide, instead of relying on the auto-increment `id` alone
 * (which could have gaps and isn't meant to be user-facing).
 */
async function nextIssueCode(connection) {
  const conn = connection || pool;
  // Ensure the counter row exists before incrementing it. Defensive
  // against a database where this row is missing — whether from a schema
  // predating this table, or from it being wiped out during a manual
  // cleanup/reset — so this can never crash with "Cannot read properties
  // of undefined" again.
  await conn.query(
    `INSERT INTO counters (name, value) VALUES ('issue_code', 0)
     ON DUPLICATE KEY UPDATE name = name`
  );
  await conn.query(
    `UPDATE counters SET value = value + 1 WHERE name = 'issue_code'`
  );
  const [[row]] = await conn.query(`SELECT value FROM counters WHERE name = 'issue_code'`);
  const n = row.value;
  return `CIV-${String(n).padStart(6, '0')}`;
}

module.exports = { nextIssueCode };