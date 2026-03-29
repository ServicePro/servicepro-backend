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

-- ============================================================
--  SEED DATA — for development/testing
-- ============================================================

-- Seed provider (password: Provider@123)
INSERT INTO providers (name, email, password, phone, category, bio, rating, total_reviews) VALUES
(
  'Alex Johnson',
  'alex@servicepro.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHG',
  '+1 555-100-2000',
  'Plumbing',
  'Professional plumber with 10+ years of experience in residential and commercial projects.',
  4.80,
  142
);

-- Seed test user (password: User@123)
INSERT INTO users (name, email, password, phone, address) VALUES
(
  'Sarah Mitchell',
  'sarah@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHG',
  '+1 555-201-1234',
  '124 Elm St, Springfield'
);

-- Seed services
INSERT INTO services (provider_id, name, category, description, price, duration_minutes, max_bookings_per_day, available_days, start_time, end_time, tags, status, total_bookings, rating, total_reviews) VALUES
(1, 'Pipe Leak Repair',           'Plumbing', 'Professional pipe leak detection and repair for residential and commercial properties.',           120.00, 60,  4, 'Mon,Tue,Wed,Thu,Fri',     '08:00:00', '18:00:00', 'emergency,same-day,residential', 'active',   34, 4.90, 34),
(1, 'Bathroom Fitting',           'Plumbing', 'Complete bathroom fixtures installation including taps, showers, and toilets.',                    250.00, 120, 3, 'Mon,Tue,Wed,Thu,Fri,Sat', '09:00:00', '17:00:00', 'installation,bathroom',          'active',   18, 4.70, 18),
(1, 'Water Heater Installation',  'Plumbing', 'Installation and setup of electric and gas water heaters with warranty.',                          320.00, 90,  3, 'Mon,Tue,Wed,Thu,Fri',     '08:00:00', '16:00:00', 'installation,heater,warranty',   'active',   12, 4.80, 12),
(1, 'Drain Cleaning',             'Plumbing', 'Thorough drain cleaning and blockage removal using professional equipment.',                         80.00, 45,  6, 'Mon,Tue,Wed,Thu,Fri,Sat', '07:00:00', '19:00:00', 'cleaning,drain,unblock',         'active',   28, 4.60, 28),
(1, 'Emergency Plumbing',         'Plumbing', '24/7 emergency plumbing services for urgent issues.',                                              200.00, 90,  4, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun','00:00:00','23:59:00','emergency,24-7,urgent',         'inactive',  9, 5.00,  9),
(1, 'Pipe Insulation',            'Plumbing', 'Insulation of exposed pipes to prevent freezing and energy loss.',                                  95.00, 60,  4, 'Mon,Tue,Wed,Thu,Fri',     '09:00:00', '17:00:00', 'insulation,energy,pipes',        'active',    7, 4.50,  7);

-- Seed appointments
INSERT INTO appointments (service_id, provider_id, user_id, client_name, client_email, client_phone, client_address, appointment_date, appointment_time, duration_minutes, amount, status) VALUES
(1, 1, 1,    'Sarah Mitchell',  'sarah@example.com',   '+1 555-201-1234', '124 Elm St, Springfield',       '2026-03-28', '10:00:00', 60,  120.00, 'confirmed'),
(2, 1, NULL, 'James Kowalski',  'james@example.com',   '+1 555-309-5678', '45 Oak Ave, Shelbyville',        '2026-03-28', '14:00:00', 120, 250.00, 'pending'),
(3, 1, NULL, 'Angela Davis',    'angela@example.com',  '+1 555-412-9012', '78 Maple Dr, Capital City',      '2026-03-29', '09:30:00', 90,  320.00, 'confirmed'),
(4, 1, NULL, 'Robert Kim',      'robert@example.com',  '+1 555-514-3456', '33 Pine Rd, Ogdenville',         '2026-03-29', '15:00:00', 45,  80.00,  'completed'),
(1, 1, NULL, 'Mia Thompson',    'mia@example.com',     '+1 555-617-7890', '89 Cedar Ln, North Haverbrook',  '2026-03-30', '11:00:00', 60,  120.00, 'pending'),
(5, 1, NULL, 'David Wong',      'david@example.com',   '+1 555-720-2345', '56 Birch Blvd, Brockway',        '2026-03-31', '08:00:00', 90,  200.00, 'confirmed'),
(6, 1, NULL, 'Laura Sanchez',   'laura@example.com',   '+1 555-823-6789', '12 Willow Way, Shelbyville',     '2026-04-01', '13:00:00', 60,  95.00,  'cancelled');
