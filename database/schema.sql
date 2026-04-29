-- 1) Database
CREATE DATABASE IF NOT EXISTS iassess
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE iassess;

-- ============================================================================
-- 2) IDENTITY / AUTH LAYER
-- ============================================================================
-- Keep only authentication + core role metadata here.
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'assessor', 'admin') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB;

-- ============================================================================
-- 3) SHARED USER PROFILE
-- ============================================================================
-- Common profile fields shared by all roles.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INT NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(40) DEFAULT NULL,
  gender VARCHAR(40) DEFAULT NULL,
  date_of_birth DATE DEFAULT NULL,
  profile_picture_file_name VARCHAR(512) DEFAULT NULL,
  profile_picture_mime_type VARCHAR(128) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 4) ADDRESS TABLE
-- ============================================================================
-- Normalized address to avoid repeating location fields in multiple tables.
CREATE TABLE IF NOT EXISTS user_addresses (
  address_id INT AUTO_INCREMENT NOT NULL,
  user_id INT NOT NULL,
  street_address VARCHAR(255) DEFAULT NULL,
  barangay VARCHAR(120) DEFAULT NULL,
  municipality VARCHAR(120) NOT NULL,
  province VARCHAR(120) NOT NULL,
  region VARCHAR(120) DEFAULT NULL,
  postal_code VARCHAR(20) DEFAULT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (address_id),
  KEY idx_user_addresses_user (user_id),
  KEY idx_user_addresses_primary (user_id, is_primary),
  KEY idx_addresses_municipality (municipality),
  KEY idx_addresses_province (province),
  CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 5) ROLE-SPECIFIC TABLES
-- ============================================================================
-- Property owner (citizen) specific data.
CREATE TABLE IF NOT EXISTS property_owners (
  owner_id INT AUTO_INCREMENT NOT NULL,
  user_id INT NOT NULL,
  verification_status ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'unverified',
  id_document_file_name VARCHAR(512) DEFAULT NULL,
  id_document_mime_type VARCHAR(128) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (owner_id),
  UNIQUE KEY uq_property_owner_user (user_id),
  KEY idx_property_owner_verification (verification_status),
  CONSTRAINT fk_property_owner_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Assessor specific data.
CREATE TABLE IF NOT EXISTS assessors (
  assessor_id INT AUTO_INCREMENT NOT NULL,
  user_id INT NOT NULL,
  employee_code VARCHAR(80) DEFAULT NULL,
  office_name VARCHAR(120) DEFAULT NULL,
  is_head_assessor TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (assessor_id),
  UNIQUE KEY uq_assessor_user (user_id),
  UNIQUE KEY uq_assessor_employee_code (employee_code),
  CONSTRAINT fk_assessor_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Admin specific data.
CREATE TABLE IF NOT EXISTS admins (
  admin_id INT AUTO_INCREMENT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admin_user (user_id),
  CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- 6) BUSINESS FLOW TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS transaction_requests (
  transaction_id INT AUTO_INCREMENT NOT NULL,
  reference_number VARCHAR(80) NOT NULL,
  owner_user_id INT NOT NULL,
  assigned_assessor_user_id INT DEFAULT NULL,
  type VARCHAR(64) DEFAULT NULL,
  status ENUM('canceled', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  assessor_notes TEXT DEFAULT NULL,
  submitted_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  PRIMARY KEY (transaction_id),
  UNIQUE KEY uq_tr_reference (reference_number),
  KEY idx_tr_status (status),
  KEY idx_tr_owner_user (owner_user_id),
  KEY idx_tr_assessor_user (assigned_assessor_user_id),
  CONSTRAINT fk_tr_owner_user FOREIGN KEY (owner_user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tr_assessor_user FOREIGN KEY (assigned_assessor_user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_documents (
  document_id INT AUTO_INCREMENT NOT NULL,
  transaction_request_id INT NOT NULL,
  type VARCHAR(48) NOT NULL,
  status ENUM('canceled', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  file_name VARCHAR(512) NOT NULL,
  file_url VARCHAR(2048) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  uploaded_by_user_id INT DEFAULT NULL,
  uploaded_at DATETIME NOT NULL,
  PRIMARY KEY (document_id),
  KEY idx_rd_request (transaction_request_id),
  KEY idx_rd_status (status),
  KEY idx_rd_uploaded_by (uploaded_by_user_id),
  CONSTRAINT fk_rd_request FOREIGN KEY (transaction_request_id) REFERENCES transaction_requests (transaction_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rd_uploaded_by FOREIGN KEY (uploaded_by_user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gis_plots (
  gis_id INT AUTO_INCREMENT NOT NULL,
  owner_user_id INT NOT NULL,
  tie_points JSON DEFAULT NULL,
  center_lat DECIMAL(10, 7) DEFAULT NULL,
  center_lng DECIMAL(10, 7) DEFAULT NULL,
  zoom DECIMAL(5, 2) DEFAULT NULL,
  polygon JSON DEFAULT NULL,
  area DECIMAL(18, 4) DEFAULT NULL,
  perimeter DECIMAL(18, 4) DEFAULT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (gis_id),
  KEY idx_gis_owner_user (owner_user_id),
  CONSTRAINT fk_gis_owner_user FOREIGN KEY (owner_user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

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
  KEY idx_audit_action (action),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;