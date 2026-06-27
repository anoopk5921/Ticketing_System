-- Complaint & Ticketing Management System
-- Run this script in MariaDB to create the database

CREATE DATABASE IF NOT EXISTS ticketing_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ticketing_db;

-- Sample master data (optional - tables are auto-created by the app)

INSERT INTO departments (description) VALUES
  ('IT Department'),
  ('HR Department'),
  ('Maintenance'),
  ('Administration');

INSERT INTO roles (role_name) VALUES
  ('Admin'),
  ('Manager'),
  ('Staff'),
  ('Technician');

INSERT INTO locations (location_name) VALUES
  ('Building A - Floor 1'),
  ('Building A - Floor 2'),
  ('Building B - Ground Floor'),
  ('Warehouse');

INSERT INTO complaint_categories (category_description) VALUES
  ('Hardware Issue'),
  ('Software Issue'),
  ('Network Problem'),
  ('Facility Maintenance'),
  ('General Complaint');

-- Employees (after departments and roles exist)
INSERT INTO employees (name, user_id, password, dept_id, role_id) VALUES
  ('John Smith', 'jsmith', 'pass123', 1, 1),
  ('Jane Doe', 'jdoe', 'pass123', 1, 3),
  ('Mike Johnson', 'mjohnson', 'pass123', 3, 4),
  ('Sarah Williams', 'swilliams', 'pass123', 2, 2);
