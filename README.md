# Civic Issue Reporter — AI-Based Civic Issue Detection & Routing System

A full-stack civic complaint platform: citizens capture a problem with the
device camera, the system verifies the photo with an AI classification
step, checks for duplicate reports, automatically routes the complaint to
the responsible mandal, and tracks it through to resolution and rating.

```
React (frontend)  ↕  Express REST API (backend)  ↕  MySQL
                          ↕
                     AI service (pluggable)
```

The frontend never talks to MySQL directly — every request goes through
the Express API.

---

## 1. Prerequisites

- Node.js 18+ and npm
- MySQL 8+ (or MariaDB 10.6+) running locally or reachable over the network
- A modern browser (camera + geolocation APIs are required — Chrome/Edge/
  Firefox/Safari on desktop or mobile all work; camera access requires
  `https://` or `localhost`)

---

## 2. Database setup

```bash
mysql -u root -p < backend/db/schema.sql
```

This creates the `civic_issue_system` database and all tables.

---

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

- Set `DB_USER` / `DB_PASSWORD` / `DB_HOST` to match your MySQL instance.
- Set `JWT_SECRET` to a long random string.
- Leave `AI_MODE=DEV_HEURISTIC` and `AI_API_URL`/`AI_API_KEY` blank to run
  the whole pipeline **without** any external AI account (see "AI
  configuration" below for how to plug in a real model later).

Seed sample mandals + sample admin accounts (development only):

```bash
npm run seed
```

This prints 4 sample admin logins (`admin.lbnagar@civic.local` /
`admin.abdullapurmet@civic.local` / `admin.injapur@civic.local` /
`admin.ibrahimpatnam@civic.local`, all
password `Admin@123`) — one per mandal. **Change or remove these before
any real deployment.**

> **Already have a database from an earlier version with `Mandal A/B/C/D`?**
> Run this once instead of re-seeding, so existing issues keep their mandal
> assignment instead of getting duplicate rows:
> ```sql
> UPDATE mandals SET name='LB Nagar',      min_lat=17.30, max_lat=17.40, min_lng=78.55, max_lng=78.65 WHERE name='Mandal A';
> UPDATE mandals SET name='Abdullapurmet', min_lat=17.30, max_lat=17.40, min_lng=78.65, max_lng=78.75 WHERE name='Mandal B';
> UPDATE mandals SET name='Injapur',       min_lat=17.20, max_lat=17.30, min_lng=78.55, max_lng=78.65 WHERE name='Mandal C';
> UPDATE mandals SET name='Ibrahimpatnam', min_lat=17.20, max_lat=17.30, min_lng=78.65, max_lng=78.75 WHERE name='Mandal D';
>
> UPDATE admins SET name='Admin - LB Nagar',      email='admin.lbnagar@civic.local'      WHERE email='admin.a@civic.local';
> UPDATE admins SET name='Admin - Abdullapurmet', email='admin.abdullapurmet@civic.local' WHERE email='admin.b@civic.local';
> UPDATE admins SET name='Admin - Injapur',       email='admin.injapur@civic.local'       WHERE email='admin.c@civic.local';
> UPDATE admins SET name='Admin - Ibrahimpatnam', email='admin.ibrahimpatnam@civic.local'  WHERE email='admin.d@civic.local';
> ```

Start the API:

```bash
npm run dev        # with nodemon, auto-restarts on change
# or
npm start
```

The API listens on `http://localhost:5000` by default. Check
`http://localhost:5000/api/health`.

---

## 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Vite serves the app on `http://localhost:5173` and proxies `/api` and
`/uploads` requests to the backend on port 5000 (see `vite.config.js`), so
no CORS configuration is needed in development.

Open `http://localhost:5173`, register a citizen account, and try
reporting an issue. Log in as an admin at `http://localhost:5173/admin/login`
with one of the seeded accounts above to review and close it out.

---

## 5. AI configuration — where it plugs in

All AI logic lives in `backend/services/ai.service.js`, isolated from the
Express controllers so the model/provider can be swapped freely.

Two modes, controlled by `.env`:

- **`AI_MODE=DEV_HEURISTIC`** (default): no AI account needed. Produces a
  deterministic "confidence" from the image bytes so the full pipeline —
  confidence thresholds, category-mismatch handling, AI_REVIEW routing —
  can be built, tested, and demoed end-to-end. This is **not** real
  computer vision; it exists purely so the rest of the system works
  out of the box.
- **`AI_MODE=EXTERNAL_API`**: set `AI_API_URL` and `AI_API_KEY`, and the
  service POSTs the raw image bytes to that URL, expecting back
  `{ category, confidence }`.

  **The `ai-model/` folder at the project root is a ready-to-train option
  for this** — a self-hosted MobileNetV2-based classifier you train on
  your own civic-issue photos, with a Flask server that already speaks
  the exact request/response shape this backend expects. See
  `ai-model/README.md` for the full walkthrough (dataset collection,
  training, serving, and wiring it into this `.env`). No third-party API
  key required — you own the model and the data.

  Other options for this slot, if you'd rather not train your own:
  - a Hugging Face Inference Endpoint running an image-classification
    model (fine-tuned on civic issue photos, or a general-purpose model
    with a category-mapping layer in front of it)
  - a cloud vision API (Google Cloud Vision, AWS Rekognition custom
    labels, Azure Custom Vision)

  Adjust `callExternalApi()` in `ai.service.js` to match your provider's
  actual request/response shape.

If the AI call fails for any reason, the issue is routed to `AI_REVIEW`
for manual admin handling instead of crashing the server or the request
(Section 45 / Rule 10 of the spec).

Confidence thresholds and duplicate-detection thresholds are configurable
via `.env` (`AI_CONFIDENCE_AUTO_PASS`, `AI_CONFIDENCE_REVIEW_MIN`,
`DUPLICATE_SCORE_THRESHOLD`, `DUPLICATE_GPS_RADIUS_METERS`) rather than
hard-coded in multiple places.

**AI-based rejection for likely duplicates** (`backend/services/duplicate.service.js`)
checks two independent signals against every open complaint in the same
category — GPS proximity and address-text similarity (`string-similarity`
package) — and treats either one alone clearing `DUPLICATE_SCORE_THRESHOLD`
as a match (an OR, not a weighted composite). A match is rejected by AI
**before it ever reaches an admin**: the citizen sees a confidence score
and which signal matched, and the report never gets a mandal assignment.
An earlier version of this also compared a basic image hash, but that
produced false positives on visually similar photos (e.g. two different
dark/low-detail test shots) and was removed in favor of this simpler,
more reliable pair of signals.

---

## 5.5. Single unified admin dashboard (all mandals) — with mandal-locked actions

By request, admin **browsing** is no longer locked to one mandal per admin
— any logged-in admin sees issues across **all** mandals in one queue,
with a Mandal dropdown as a filter (`listIssues`, `getIssueById`,
`statistics` in `backend/controllers/admin.controller.js`).

**Taking action is still restricted to the issue's own mandal.**
`updateStatus` (marking an issue Completed or Can't-take-up) checks
`issue.mandal_id === req.user.mandalId` and returns 403 otherwise — an
LB Nagar admin can *see* an Injapur issue in the unified queue, but
cannot close it out. The frontend mirrors this: the "Take action" buttons
only render for the matching admin, with an explanatory message shown to
everyone else instead of the buttons silently disappearing.

This split (unified viewing, scoped acting) is a deliberate middle ground
— a future "rank-based" permission layer (mentioned as a next step) can
extend or replace this scoping without changing the underlying data
model, since `mandal_id` is still recorded on every issue exactly as
before.

## 5.6. Where the AI logic lives

All AI classification logic is isolated in one file:
**`backend/services/ai.service.js`**. It currently runs in
`DEV_HEURISTIC` mode (see Section 5 above) — a deterministic,
image-hash-based fallback so the full confidence-threshold /
category-mismatch pipeline works without needing an actual AI account.
Nothing calls a real model until you set `AI_MODE=EXTERNAL_API` plus
`AI_API_URL`/`AI_API_KEY` in `.env`. The **`ai-model/`** folder at the
project root is a ready-to-train self-hosted model for exactly this slot
— see `ai-model/README.md`.

## 5.7. 3D visuals

Two small, dependency-light Three.js components were added for visual
identity, using the raw `three` package directly (no React renderer
wrapper):

- `frontend/src/components/ThreeHero.jsx` — a rotating wireframe
  "network" sphere on the Login / Register / Admin Login screens.
- `frontend/src/components/ThreeStatBars.jsx` — a 3D bar chart on the
  admin dashboard summarizing Pending / Completed / Can't-take-up counts.

Both mount into a plain `<div>` via a ref, run their own animation loop,
and clean up (dispose geometries/materials, cancel the animation frame,
remove the canvas) on unmount — so they're safe to drop into any other
page the same way.

## 6. Mandal boundaries

`backend/services/location.service.js` determines a complaint's mandal
from its GPS coordinates. For this prototype, each mandal is a simple
lat/lng bounding box (see `db/seed.js` — four boxes covering the Injapur /
Abdullapurmet / Ibrahimpatnam / LB Nagar area, southeast of Hyderabad, by
default). This is intentionally simple and **not** how real administrative
boundaries work; replace it with a real polygon-boundary check (e.g. a
`mandal_boundaries` GeoJSON table plus `@turf/boolean-point-in-polygon`)
when real boundary data is available. Every other part of the system only
depends on the resulting `mandal_id`, so this swap is isolated to one file.

---

## 7. Project structure

```
civic-issue-system/
├── backend/
│   ├── server.js
│   ├── config/db.js
│   ├── routes/            auth, issue, admin, rating
│   ├── controllers/       auth, issue, admin, rating
│   ├── middleware/        auth, admin, upload (multer)
│   ├── services/          ai, duplicate, location, ranking
│   ├── utils/             idGenerator (CIV-000001 codes), geo (haversine)
│   ├── db/                schema.sql, seed.js
│   └── uploads/           stored complaint photos
└── frontend/
    └── src/
        ├── api/axios.js
        ├── context/AuthContext.jsx
        ├── components/    CameraCapture, layouts, route guards, badges
        └── pages/         citizen + admin pages
```

---

## 8. What's implemented against the spec

- Citizen + admin roles with separate JWT-protected auth flows and
  role-based authorization (a citizen JWT is rejected by every admin
  route, and vice versa)
- Camera-only photo capture (no file-upload fallback for the main photo),
  with GPS captured and **visibly stamped onto the photo itself**
  (coordinates + timestamp burned into the image, not just stored
  alongside it), both validated again on the backend
- AI classification → confidence-threshold rules → category-mismatch
  handling, all backend-enforced
- AI rejection of likely-duplicate reports based on GPS proximity or
  address-text similarity, with a confidence score shown to the citizen,
  before the report ever reaches an admin
- Single unified admin dashboard across all mandals for browsing, with
  mandal-locked write access (only the matching mandal's admin can mark
  an issue Completed/Can't-take-up — Section 5.5)
- Automatic mandal routing from GPS, mandals stored in their own table
- Human-readable issue codes (`CIV-000001`) via a locked counter
- Full status history timeline, visible to both citizen and admin
- Mandatory reason enforced server-side for "Can't take up"
- One rating per citizen per completed issue, enforced by a DB unique
  constraint
- Configurable, weighted mandal ranking (resolution rate / rating /
  resolution speed)
- Parameterized queries throughout (no string-built SQL), bcrypt password
  hashing, file-type/size validation, server-generated filenames, `.env`
  for all secrets

## 9. Known simplifications (by design, documented above)

- AI classification runs in a deterministic dev-heuristic mode until you
  plug in a real model via `AI_API_URL` — see `ai-model/` for a
  ready-to-train self-hosted option
- Mandal boundaries are bounding boxes, not real administrative polygons
- Duplicate rejection compares GPS and address text only — it doesn't
  compare photos to each other at all (an earlier image-hash comparison
  was removed for being unreliable; a real perceptual-hash or embedding
  model could be added back as a third signal if needed)

These are the places the master prompt explicitly allows a
"pretrained/pluggable" or "simple for now, replace later" approach, and
they're isolated to single files/functions so upgrading each one doesn't
require touching the rest of the app.
