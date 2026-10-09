CREATE DATABASE IF NOT EXISTS mindcircuit
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mindcircuit;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  work_status ENUM('Student','Employee') NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- For deployment, create a separate least-privilege app user and grant access only to this database.
-- Example (run as a MySQL administrator; replace password securely):
-- CREATE USER 'mindcircuit_app'@'%' IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON mindcircuit.* TO 'mindcircuit_app'@'%';
-- FLUSH PRIVILEGES;
