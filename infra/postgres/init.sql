-- infra/postgres/init.sql
-- PostgreSQL initialization script for DevCle

-- Enable uuid-ossp extension for UUID generation (uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto extension for PII encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create initial schema (tables will be created by Drizzle ORM migrations)
-- This file is a placeholder for Task 1.4
