-- Standardize legacy mixed-case PK columns to snake_case.
USE iassess;

-- Drop foreign keys that reference renamed columns.
ALTER TABLE transaction_requests DROP FOREIGN KEY fk_tr_user;
ALTER TABLE request_documents DROP FOREIGN KEY fk_rd_request;
ALTER TABLE gis_plots DROP FOREIGN KEY fk_gis_user;
ALTER TABLE gis_plots DROP FOREIGN KEY fk_gis_transaction;
ALTER TABLE audit_logs DROP FOREIGN KEY fk_audit_user;

-- Rename columns.
ALTER TABLE users
  CHANGE COLUMN User_id user_id INT AUTO_INCREMENT NOT NULL;

ALTER TABLE transaction_requests
  CHANGE COLUMN Transaction_id transaction_id INT AUTO_INCREMENT NOT NULL;

ALTER TABLE request_documents
  CHANGE COLUMN Documents_id document_id INT AUTO_INCREMENT NOT NULL;

ALTER TABLE gis_plots
  CHANGE COLUMN Gis_id gis_id INT AUTO_INCREMENT NOT NULL,
  CHANGE COLUMN Perimeter perimeter DECIMAL(18, 4) DEFAULT NULL;

-- Re-create foreign keys against standardized columns.
ALTER TABLE transaction_requests
  ADD CONSTRAINT fk_tr_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE request_documents
  ADD CONSTRAINT fk_rd_request FOREIGN KEY (transaction_request_id) REFERENCES transaction_requests (transaction_id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE gis_plots
  ADD CONSTRAINT fk_gis_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT fk_gis_transaction FOREIGN KEY (transaction_request_id) REFERENCES transaction_requests (transaction_id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE audit_logs
  ADD CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE;
