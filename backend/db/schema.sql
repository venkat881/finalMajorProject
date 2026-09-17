-- =========================================================
-- AI-Based Civic Issue Detection & Routing System
-- MySQL Schema
-- =========================================================

CREATE DATABASE IF NOT EXISTS civic_issue_system
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE civic_issue_system;

-- ---------------------------------------------------------
-- MANDALS
-- Boundaries are stored as a simple lat/lng bounding box for
-- this prototype. Replace with real polygon/administrative
-- boundary data later (see services/location.service.js).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS mandals (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  min_lat       DECIMAL(10,7) NULL,  -- NULL for manually-added mandals (no boundary, selected by name only)
  max_lat       DECIMAL(10,7) NULL,
  min_lng       DECIMAL(10,7) NULL,
  max_lng       DECIMAL(10,7) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- USERS (citizens)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(20)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- ADMINS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  mandal_id     INT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_mandal FOREIGN KEY (mandal_id) REFERENCES mandals(id)
);

-- ---------------------------------------------------------
-- ISSUES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  issue_code        VARCHAR(20) NOT NULL UNIQUE,          -- CIV-000001
  user_id           INT NOT NULL,
  mandal_id         INT NULL,
  category          VARCHAR(50) NOT NULL,                 -- citizen-selected
  description       TEXT NOT NULL,
  address           VARCHAR(255) NOT NULL,
  landmark          VARCHAR(255),
  latitude          DECIMAL(10,7) NOT NULL,
  longitude         DECIMAL(10,7) NOT NULL,
  status            ENUM('AI_REVIEW','PENDING','DUPLICATE','REJECTED','COMPLETED','CANT_TAKEUP')
                      NOT NULL DEFAULT 'AI_REVIEW',
  ai_category       VARCHAR(50),
  ai_confidence     DECIMAL(5,2),                         -- 0.00 - 100.00
  duplicate_score   DECIMAL(5,2),
  duplicate_of      INT NULL,
  admin_reason      TEXT NULL,
  reported_count    INT NOT NULL DEFAULT 1,                -- how many citizens linked to this issue
  completed_at      TIMESTAMP NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_issue_user   FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_issue_mandal FOREIGN KEY (mandal_id) REFERENCES mandals(id),
  CONSTRAINT fk_issue_dup    FOREIGN KEY (duplicate_of) REFERENCES issues(id)
);

-- ---------------------------------------------------------
-- ISSUE IMAGES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_images (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  issue_id      INT NOT NULL,
  image_path    VARCHAR(255) NOT NULL,
  image_hash    VARCHAR(64),                -- perceptual hash, used for duplicate/image similarity
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  captured_at   TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_image_issue FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- ISSUE LINKS (duplicate reporters of the same real-world issue)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_links (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  primary_issue_id  INT NOT NULL,
  linked_issue_id   INT NOT NULL,
  duplicate_score   DECIMAL(5,2),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_link_primary FOREIGN KEY (primary_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_link_linked  FOREIGN KEY (linked_issue_id)  REFERENCES issues(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- STATUS HISTORY
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_status_history (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  issue_id      INT NOT NULL,
  admin_id      INT NULL,
  old_status    VARCHAR(30),
  new_status    VARCHAR(30) NOT NULL,
  reason        TEXT NULL,
  note          VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_issue FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_admin FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- ---------------------------------------------------------
-- RATINGS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  issue_id      INT NOT NULL,
  user_id       INT NOT NULL,
  rating        TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_issue_rating (issue_id, user_id),
  CONSTRAINT fk_rating_issue FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_rating_user  FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- ---------------------------------------------------------
-- COUNTERS (used to generate CIV-000001 style human-readable IDs)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS counters (
  name          VARCHAR(50) PRIMARY KEY,
  value         BIGINT NOT NULL DEFAULT 0
);

INSERT INTO counters (name, value) VALUES ('issue_code', 0)
  ON DUPLICATE KEY UPDATE name = name;

-- Helpful indexes
CREATE INDEX idx_issues_mandal_status ON issues (mandal_id, status);
CREATE INDEX idx_issues_user ON issues (user_id);
CREATE INDEX idx_issues_category ON issues (category);
