-- ShoeLab.de — add profile fields to the users table.
-- Run this ONCE in the D1 Console (Storage & Databases → shoelab → Console).
-- Safe to run on the existing database; it only adds columns.

ALTER TABLE users ADD COLUMN phone   TEXT;
ALTER TABLE users ADD COLUMN address TEXT;
ALTER TABLE users ADD COLUMN city    TEXT;
ALTER TABLE users ADD COLUMN postal  TEXT;
ALTER TABLE users ADD COLUMN country TEXT;
