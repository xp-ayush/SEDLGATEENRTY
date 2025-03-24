-- Add view role to existing enum
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'user', 'view') NOT NULL DEFAULT 'view';
