/**
 * Seed script — sample mandals + sample admin accounts for LOCAL
 * DEVELOPMENT ONLY. Passwords are hashed here at runtime with bcrypt,
 * never stored/committed in plain text.
 *
 * Usage:
 *   1. Import db/schema.sql into MySQL first.
 *   2. npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Simple bounding-box boundaries covering the Injapur / Abdullapurmet /
// Ibrahimpatnam / LB Nagar area (Rangareddy district, southeast of
// Hyderabad), split into four quadrants. Replace with real administrative
// polygon boundaries later — see services/location.service.js for where
// this plugs in.
const MANDALS = [
  { name: 'LB Nagar',        min_lat: 17.30, max_lat: 17.40, min_lng: 78.55, max_lng: 78.65 },
  { name: 'Abdullapurmet',   min_lat: 17.30, max_lat: 17.40, min_lng: 78.65, max_lng: 78.75 },
  { name: 'Injapur',         min_lat: 17.20, max_lat: 17.30, min_lng: 78.55, max_lng: 78.65 },
  { name: 'Ibrahimpatnam',   min_lat: 17.20, max_lat: 17.30, min_lng: 78.65, max_lng: 78.75 },
];

const SAMPLE_ADMINS = [
  { name: 'Admin - LB Nagar',      email: 'admin.lbnagar@civic.local',      password: 'Admin@123', mandal: 'LB Nagar' },
  { name: 'Admin - Abdullapurmet', email: 'admin.abdullapurmet@civic.local', password: 'Admin@123', mandal: 'Abdullapurmet' },
  { name: 'Admin - Injapur',       email: 'admin.injapur@civic.local',      password: 'Admin@123', mandal: 'Injapur' },
  { name: 'Admin - Ibrahimpatnam', email: 'admin.ibrahimpatnam@civic.local', password: 'Admin@123', mandal: 'Ibrahimpatnam' },
];

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Seeding mandals...');
    const mandalIds = {};
    for (const m of MANDALS) {
      const [existing] = await conn.query('SELECT id FROM mandals WHERE name = ?', [m.name]);
      if (existing.length) {
        mandalIds[m.name] = existing[0].id;
        continue;
      }
      const [result] = await conn.query(
        `INSERT INTO mandals (name, min_lat, max_lat, min_lng, max_lng) VALUES (?, ?, ?, ?, ?)`,
        [m.name, m.min_lat, m.max_lat, m.min_lng, m.max_lng]
      );
      mandalIds[m.name] = result.insertId;
      console.log(`  + ${m.name} created (id=${result.insertId})`);
    }

    console.log('Seeding sample admins (LOCAL DEV ONLY)...');
    for (const a of SAMPLE_ADMINS) {
      const [existing] = await conn.query('SELECT id FROM admins WHERE email = ?', [a.email]);
      if (existing.length) {
        console.log(`  = ${a.email} already exists, skipping`);
        continue;
      }
      const hash = await bcrypt.hash(a.password, 10);
      await conn.query(
        `INSERT INTO admins (name, email, password_hash, mandal_id) VALUES (?, ?, ?, ?)`,
        [a.name, a.email, hash, mandalIds[a.mandal]]
      );
      console.log(`  + ${a.email} created (password: ${a.password})`);
    }

    console.log('\nSeed complete.');
    console.log('\nSample admin logins (development only — change/remove before any real deployment):');
    SAMPLE_ADMINS.forEach(a => console.log(`  ${a.email} / ${a.password}  ->  ${a.mandal}`));
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
