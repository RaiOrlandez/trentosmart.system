-- Create database and user for the Trike system
CREATE DATABASE IF NOT EXISTS `transport` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Create dedicated user (adjust host and password as needed)
CREATE USER IF NOT EXISTS 'trike_user'@'%' IDENTIFIED BY 'trike_pass';
GRANT ALL PRIVILEGES ON `transport`.* TO 'trike_user'@'%';
FLUSH PRIVILEGES;

-- Note: On some MySQL installations you may need to run 'FLUSH PRIVILEGES' separately.
