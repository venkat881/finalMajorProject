require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const { testConnection } = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const issueRoutes = require('./routes/issue.routes');
const adminRoutes = require('./routes/admin.routes');
const ratingRoutes = require('./routes/rating.routes');
const mandalRoutes = require('./routes/mandal.routes');

const app = express();

// ---- Core middleware ----
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded complaint photos (read-only static files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Civic Issue API is running' });
});

// ---- Routes ----
app.use('/api', authRoutes);
app.use('/api', issueRoutes);
app.use('/api', adminRoutes);
app.use('/api', ratingRoutes);
app.use('/api', mandalRoutes);

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ---- Central error handler ----
// Catches multer errors (bad file type/size) and anything else that
// bubbles up, so a single failed request never crashes the server
// (Section 45 / Rule 10 applies to the whole app, not just AI calls).
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    console.error('[unhandled error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
  next();
});

const PORT = process.env.PORT || 5000;

testConnection().then(() => {
  app.listen(PORT, () => {
    console.log(`Civic Issue API listening on port ${PORT}`);
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
