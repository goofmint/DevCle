#!/bin/bash
# init.sh
# PostgreSQL database initialization script for DevCle
# This script runs only once when the database is first created
# Uses shell script to properly interpolate environment variables

set -e

# Read environment variables with defaults
DB_NAME="${POSTGRES_DB:-devcle}"
DB_USER="${POSTGRES_USER:-devcle}"

echo "Initializing PostgreSQL database: $DB_NAME for user: $DB_USER"

# Execute SQL statements with environment variable substitution
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- Enable pgcrypto extension for UUID generation and encryption
  -- Used for: generating UUIDs for primary keys, encrypting PII
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Set default timezone to UTC for all new connections (persistent)
  -- This ensures consistent timestamp handling across the application
  ALTER DATABASE ${DB_NAME} SET timezone TO 'UTC';

  -- Grant necessary permissions to the database user
  -- Ensures the application can create tables and perform operations
  GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
  GRANT ALL PRIVILEGES ON SCHEMA public TO ${DB_USER};

  -- Log initialization completion
  DO \$\$
  BEGIN
    RAISE NOTICE 'Database initialized successfully';
    RAISE NOTICE 'Extensions enabled: pgcrypto';
    RAISE NOTICE 'Timezone set to: UTC (persistent via ALTER DATABASE)';
  END \$\$;
EOSQL

echo "PostgreSQL initialization completed successfully"
