-- infra/postgres/init.sql
-- PostgreSQL initialization script for DevCle

-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create initial schema (tables will be created by Drizzle ORM migrations)
-- This file is a placeholder for Task 1.4
