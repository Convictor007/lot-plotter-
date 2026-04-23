-- 1. Create the database
CREATE DATABASE IF NOT EXISTS iassess
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE iassess;

-- ---------------------------------------------------------------------------
-- 2. USERS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  User_id INT AUTO_INCREMENT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'assessor', 'admin') NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(40) DEFAULT NULL,
  gender VARCHAR(40) DEFAULT NULL,
  age TINYINT UNSIGNED DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  street_address VARCHAR(255) DEFAULT NULL,
  region VARCHAR(120) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  barangay VARCHAR(120) DEFAULT NULL,
  municipality VARCHAR(120) NOT NULL,
  province VARCHAR(120) NOT NULL,
  verification_status ENUM('unverified', 'pending', 'verified') NOT NULL DEFAULT 'unverified',
  id_document_file_name VARCHAR(512) DEFAULT NULL,
  id_document_mime_type VARCHAR(128) DEFAULT NULL,
  profile_picture_file_name VARCHAR(512) DEFAULT NULL,
  profile_picture_mime_type VARCHAR(128) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (User_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_municipality (municipality),
  KEY idx_users_province (province)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. TRANSACTION REQUESTS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction_requests (
  Transaction_id INT AUTO_INCREMENT NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  user_id INT NOT NULL,
  type VARCHAR(64) DEFAULT NULL,
  status ENUM(
    'draft', 'submitted', 'under_review', 'pending_documents',
    'approved', 'rejected', 'ready_for_payment', 'completed', 'cancelled'
  ) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  assessor_notes TEXT DEFAULT NULL,
  submitted_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (Transaction_id),
  UNIQUE KEY uq_tr_reference (reference_number),
  KEY idx_tr_user (user_id),
  CONSTRAINT fk_tr_user FOREIGN KEY (user_id) REFERENCES users (User_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. REQUEST DOCUMENTS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_documents (
  Documents_id INT AUTO_INCREMENT NOT NULL,
  transaction_request_id INT NOT NULL,
  type VARCHAR(48) NOT NULL,
  file_name VARCHAR(512) NOT NULL,
  file_url VARCHAR(2048) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  uploaded_at DATETIME NOT NULL,
  verified TINYINT(1) DEFAULT 0,
  PRIMARY KEY (Documents_id),
  KEY idx_rd_request (transaction_request_id),
  CONSTRAINT fk_rd_request FOREIGN KEY (transaction_request_id) REFERENCES transaction_requests (Transaction_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. GIS PLOTS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gis_plots (
  Gis_id INT AUTO_INCREMENT NOT NULL,
  user_id INT NOT NULL,
  transaction_request_id INT DEFAULT NULL,
  barangay VARCHAR(120) DEFAULT NULL,
  municipality VARCHAR(120) DEFAULT NULL,
  province VARCHAR(120) DEFAULT NULL,
  tie_points JSON DEFAULT NULL,
  center_lat DECIMAL(10, 7) DEFAULT NULL,
  center_lng DECIMAL(10, 7) DEFAULT NULL,
  zoom DECIMAL(5, 2) DEFAULT NULL,
  polygon JSON DEFAULT NULL,
  area DECIMAL(18, 4) DEFAULT NULL,
  Perimeter DECIMAL(18, 4) DEFAULT NULL,
  extracted_from_title TINYINT(1) DEFAULT 0,
  title_file_name VARCHAR(512) DEFAULT NULL,
  historical_comparison_notes TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (Gis_id),
  KEY idx_gis_user (user_id),
  KEY idx_gis_transaction (transaction_request_id),
  CONSTRAINT fk_gis_user FOREIGN KEY (user_id) REFERENCES users (User_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_gis_transaction FOREIGN KEY (transaction_request_id) REFERENCES transaction_requests (Transaction_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. AUDIT LOGS TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id INT AUTO_INCREMENT NOT NULL,
  user_id INT DEFAULT NULL,
  action VARCHAR(120) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  details JSON DEFAULT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (audit_id),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (User_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;