-- Migration: Add is_superuser field to users table
-- Date: 2026-02-07
-- Description: Adds superuser flag for admin panel access

-- Add the column with default value
ALTER TABLE users ADD COLUMN is_superuser BOOLEAN DEFAULT FALSE;

-- Optional: Create an initial superuser (update username as needed)
-- UPDATE users SET is_superuser = TRUE WHERE username = 'admin';

-- Verify the change
-- SELECT id, username, role, is_active, is_superuser FROM users LIMIT 5;
