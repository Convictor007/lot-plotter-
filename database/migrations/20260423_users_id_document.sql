-- Run against existing DBs (schema.sql already includes these for fresh installs).
USE iassess;

ALTER TABLE users
  ADD COLUMN id_document_file_name VARCHAR(512) DEFAULT NULL AFTER verification_status,
  ADD COLUMN id_document_mime_type VARCHAR(128) DEFAULT NULL AFTER id_document_file_name;
