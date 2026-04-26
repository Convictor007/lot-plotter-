-- Add rejected ID verification outcome (staff can set after review).
ALTER TABLE users
  MODIFY COLUMN verification_status
    ENUM('unverified', 'pending', 'verified', 'rejected')
    NOT NULL DEFAULT 'unverified';
