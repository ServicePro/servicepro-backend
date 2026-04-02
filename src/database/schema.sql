-- ============================================================
--  ServicePro Database Schema
--  Database: servicepro_db
--  Engine: MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS servicepro_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE servicepro_db;

-- ─────────────────────────────────────────────────────────────
-- TABLE: providers
--   Stores service provider accounts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id              INT           NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  password        VARCHAR(255)  NOT NULL,
  phone           VARCHAR(20)   DEFAULT NULL,
  category        VARCHAR(100)  DEFAULT NULL,
  bio             TEXT          DEFAULT NULL,
  profile_image   VARCHAR(500)  DEFAULT NULL,
  rating          DECIMAL(3,2)  DEFAULT 0.00,
  total_reviews   INT           DEFAULT 0,
  is_active       TINYINT(1)    DEFAULT 1,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TABLE: users
--   Stores regular user (client) accounts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT           NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  password        VARCHAR(255)  NOT NULL,
  phone           VARCHAR(20)   DEFAULT NULL,
  address         TEXT          DEFAULT NULL,
  profile_image   VARCHAR(500)  DEFAULT NULL,
  is_active       TINYINT(1)    DEFAULT 1,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TABLE: services
--   Services listed by providers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                    INT           NOT NULL AUTO_INCREMENT,
  provider_id           INT           NOT NULL,
  name                  VARCHAR(200)  NOT NULL,
  category              VARCHAR(100)  NOT NULL,
  description           TEXT          DEFAULT NULL,
  price                 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duration_minutes      INT           NOT NULL DEFAULT 60,
  max_bookings_per_day  INT           DEFAULT 5,
  available_days        VARCHAR(100)  DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  start_time            TIME          DEFAULT '08:00:00',
  end_time              TIME          DEFAULT '18:00:00',
  tags                  VARCHAR(500)  DEFAULT NULL,
  image_url             VARCHAR(500)  DEFAULT NULL,
  status                ENUM('active','inactive') DEFAULT 'active',
  total_bookings        INT           DEFAULT 0,
  rating                DECIMAL(3,2)  DEFAULT 0.00,
  total_reviews         INT           DEFAULT 0,
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  INDEX idx_provider (provider_id),
  INDEX idx_category (category),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TABLE: appointments
--   Bookings made by users for provider services
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              INT           NOT NULL AUTO_INCREMENT,
  service_id      INT           NOT NULL,
  provider_id     INT           NOT NULL,
  user_id         INT           DEFAULT NULL,
  client_name     VARCHAR(150)  NOT NULL,
  client_email    VARCHAR(255)  DEFAULT NULL,
  client_phone    VARCHAR(20)   DEFAULT NULL,
  client_address  TEXT          DEFAULT NULL,
  appointment_date DATE          NOT NULL,
  appointment_time TIME          NOT NULL,
  duration_minutes INT          DEFAULT 60,
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status          ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  notes           TEXT          DEFAULT NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_provider   (provider_id),
  INDEX idx_service    (service_id),
  INDEX idx_status     (status),
  INDEX idx_date       (appointment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- TABLE: reviews
--   Client reviews for services
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              INT           NOT NULL AUTO_INCREMENT,
  appointment_id  INT           NOT NULL,
  service_id      INT           NOT NULL,
  provider_id     INT           NOT NULL,
  user_id         INT           DEFAULT NULL,
  client_name     VARCHAR(150)  DEFAULT 'Anonymous',
  rating          TINYINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT          DEFAULT NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_appointment_review (appointment_id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id)     REFERENCES services(id)     ON DELETE CASCADE,
  FOREIGN KEY (provider_id)    REFERENCES providers(id)    ON DELETE CASCADE,
  FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE SET NULL,
  INDEX idx_service  (service_id),
  INDEX idx_provider (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;