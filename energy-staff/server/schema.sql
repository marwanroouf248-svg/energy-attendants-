CREATE TABLE IF NOT EXISTS es_users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 full_name VARCHAR(120) NOT NULL,
 phone VARCHAR(20) NOT NULL,
 password_hash VARCHAR(255) NOT NULL,
 requested_position VARCHAR(40) NOT NULL,
 requested_branch VARCHAR(120) NOT NULL,
 position VARCHAR(40) NULL,
 branch VARCHAR(120) NULL,
 role ENUM('employee','manager','admin') NOT NULL DEFAULT 'employee',
 status ENUM('pending','approved','rejected','disabled') NOT NULL DEFAULT 'pending',
 review_reason VARCHAR(1000) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at DATETIME NULL,
 INDEX es_users_review(status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS es_sessions (
 token_hash CHAR(64) PRIMARY KEY,
 user_id BIGINT UNSIGNED NULL,
 csrf CHAR(64) NOT NULL,
 expires_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX es_sessions_expiry(expires_at),
 INDEX es_sessions_user(user_id),
 FOREIGN KEY(user_id) REFERENCES es_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS es_limits (
 limit_key CHAR(64) PRIMARY KEY,
 attempts INT NOT NULL,
 resets_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS es_state (
 state_key VARCHAR(40) PRIMARY KEY,
 payload LONGTEXT NOT NULL,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS es_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 actor_id BIGINT UNSIGNED NULL,
 action VARCHAR(60) NOT NULL,
 subject_id BIGINT UNSIGNED NULL,
 reason VARCHAR(1000) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX es_audit_actor(actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO es_state(state_key,payload) VALUES('workspace','{}');
INSERT IGNORE INTO es_state(state_key,payload) VALUES('bootstrap','{}');
