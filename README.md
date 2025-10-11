# DRM (Developer Relationship Management)

DevRel analytics and management platform

## Repository Structure

This is the main integration repository that contains all DRM packages as Git submodules:

- **core/** - [@drm/core](../drm-core) - Core API, DB, Services, Plugin System, UI (OSS - MIT)
- **posthog/** - [@drm/posthog](../drm-posthog) - PostHog integration (OSS - MIT)
- **plugins/** - [@drm-plugin/webhook](../drm-plugins) - Example webhook plugin (Commercial - Proprietary)

## Repository Separation

Each package is maintained in a **separate Git repository** with independent version control:

- **OSS Packages** (core, posthog): MIT licensed, publicly available
- **Commercial Plugins** (plugins): Proprietary, closed-source

This separation ensures:
- Clear license boundaries
- Independent development cycles
- Flexible deployment options (use core+posthog OSS without commercial plugins)

## Getting Started

### Clone with submodules

```bash
git clone --recurse-submodules https://github.com/yourorg/devcle.git
cd devcle/app
```

### Initialize submodules (if already cloned)

```bash
git submodule update --init --recursive
```

### Quick Start with Docker Compose

The easiest way to run DevCle is using Docker Compose:

#### 1. Setup environment variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file and configure:
# - Change all passwords (POSTGRES_PASSWORD, REDIS_PASSWORD, SESSION_SECRET)
# - Set APP_DOMAIN (devcle.com for production, devcle.test for development)
# IMPORTANT: Use strong passwords in production!
vim .env
```

**Important variables:**
- `APP_DOMAIN`: Application domain for nginx server_name and URLs (default: `devcle.com` for production, `devcle.test` for development)

#### 1.5. Setup SSL certificates (for HTTPS)

**Development certificates (devcle.test):**
- Already exists: `certs/devcle.test+3.pem` (certificate)
- Already exists: `certs/devcle.test+3-key.pem` (private key)

**Production certificates (devcle.com):**

```bash
# Place your production SSL certificates with the correct names
# Example: Using Let's Encrypt certificates
cp /path/to/fullchain.pem certs/devcle.com.pem
cp /path/to/privkey.pem certs/devcle.com-key.pem

# Or generate with mkcert for testing
mkcert devcle.com
mv devcle.com.pem certs/
mv devcle.com-key.pem certs/
```

**Note:**
- **Development** (`docker-compose-dev.yml`): Uses `certs/devcle.test+3.pem` and `certs/devcle.test+3-key.pem`
- **Production** (`docker-compose.yml`): Uses `certs/devcle.com.pem` and `certs/devcle.com-key.pem`

#### 2. Start the services (Development mode)

```bash
# Start all services in development mode with hot reload
docker compose -f docker-compose.yml -f docker-compose-dev.yml up -d

# View logs
docker compose logs -f

# Check container status
docker compose ps
```

#### 3. Access the application

- **Core application**: http://localhost:3000
- **Nginx (dev)**: http://localhost:8080
- **PostgreSQL**: localhost:5432 (for local tools like pgAdmin, DBeaver)
- **Redis**: localhost:6379 (for local tools like Redis Commander)

#### 4. Stop the services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: This will delete all data)
docker compose down -v
```

### Database Setup (PostgreSQL)

The PostgreSQL database is automatically initialized when you first start the services. The initialization script (`infra/postgres/init.sh`) performs the following setup:

#### Automatic Initialization

When the PostgreSQL container starts for the first time:

1. **pgcrypto Extension**: Enabled for UUID generation and PII encryption
2. **Timezone Configuration**: Set to UTC persistently across all connections
3. **Permissions**: Database user granted all necessary privileges
4. **Row Level Security**: RLS policy templates created for multi-tenant isolation

#### Verification Steps

After starting the services, verify the database setup:

```bash
# 1. Check PostgreSQL container status
docker compose ps postgres
# Expected: Status shows "Up (healthy)"

# 2. Verify database connection
docker compose exec postgres psql -U devcle -d devcle -c "SELECT version();"
# Expected: PostgreSQL 15.x version information

# 3. Verify pgcrypto extension
docker compose exec postgres psql -U devcle -d devcle -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';"
# Expected: pgcrypto | 1.3

# 4. Test UUID generation
docker compose exec postgres psql -U devcle -d devcle -c "SELECT gen_random_uuid();"
# Expected: A valid UUID like "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"

# 5. Verify timezone setting
docker compose exec postgres psql -U devcle -d devcle -c "SHOW timezone;"
# Expected: UTC

# 6. Check database volume persistence
docker volume inspect app_postgres-data
# Expected: Volume information with Mountpoint
```

#### Troubleshooting

**Problem: Initialization script not running**

If the initialization script doesn't run (database already exists):

```bash
# Stop services and remove the postgres volume
docker compose down
docker volume rm app_postgres-data

# Start services again (initialization will run)
docker compose up -d postgres

# Check initialization logs
docker compose logs postgres | grep "Initializing PostgreSQL"
docker compose logs postgres | grep "Database initialized"
```

**Expected initialization logs:**
```
Initializing PostgreSQL database: devcle for user: devcle
CREATE EXTENSION
ALTER DATABASE
GRANT
Database initialized successfully
Extensions enabled: pgcrypto
Timezone set to: UTC (persistent via ALTER DATABASE)
PostgreSQL initialization completed successfully
```

**Problem: Connection refused**

If you can't connect to PostgreSQL:

```bash
# Check if PostgreSQL is ready
docker compose exec postgres pg_isready -U devcle

# Check container logs
docker compose logs postgres

# Verify healthcheck status
docker compose ps postgres
```

**Problem: pgcrypto extension not found**

```bash
# Manually enable the extension
docker compose exec postgres psql -U devcle -d devcle -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

#### Database Configuration

The database configuration is managed through environment variables in `.env`:

```bash
# PostgreSQL Configuration
POSTGRES_DB=devcle              # Database name
POSTGRES_USER=devcle            # Database user
POSTGRES_PASSWORD=your_password # Database password (change in production!)

# Database URL for application (Drizzle ORM)
DATABASE_URL=postgresql://devcle:your_password@postgres:5432/devcle
```

#### Data Persistence

Database data is persisted using Docker named volumes:

- **Volume name**: `app_postgres-data`
- **Mount point**: `/var/lib/postgresql/data`

**Backup strategy:**

```bash
# Backup database
docker compose exec postgres pg_dump -U devcle -d devcle > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker compose exec -T postgres psql -U devcle -d devcle < backup.sql
```

#### Row Level Security (RLS)

The database is prepared for multi-tenant isolation using Row Level Security. RLS policy templates are available in `infra/postgres/rls-template.sql` and will be applied during migration (Task 3.5).

**RLS Features:**
- Tenant-level data isolation at the database layer
- Automatic query filtering based on `tenant_id`
- Protection against SQL injection and data leakage
- Application-independent security enforcement

### Production Deployment

#### External Database and Redis Servers

**IMPORTANT**: In production, PostgreSQL and Redis are **NOT** included in `docker-compose.yml`. You must use external managed services.

**Why external services?**
- **Scalability**: Dedicated servers with proper resources
- **High availability**: Built-in replication and failover
- **Managed backups**: Automated backup and recovery
- **Performance**: Optimized for production workloads
- **Security**: Managed security patches and updates

#### Recommended Managed Services

**PostgreSQL:**
- AWS RDS for PostgreSQL
- Google Cloud SQL for PostgreSQL
- Azure Database for PostgreSQL
- Supabase
- Neon

**Redis:**
- AWS ElastiCache for Redis
- Google Cloud Memorystore for Redis
- Azure Cache for Redis
- Redis Cloud
- Upstash Redis

#### Configuration

1. **Setup environment variables** pointing to external servers:

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file and configure:
vim .env
```

**Required configuration:**

```bash
# PostgreSQL Configuration (External Server)
# Example: AWS RDS endpoint
DATABASE_URL=postgresql://username:password@your-postgres-server.rds.amazonaws.com:5432/devcle

# Redis Configuration (External Server)
# Example: AWS ElastiCache endpoint
REDIS_URL=redis://:password@your-redis-server.cache.amazonaws.com:6379/0
REDIS_PASSWORD=your_redis_password

# Application Configuration
APP_DOMAIN=devcle.com
SESSION_SECRET=your_strong_session_secret
NODE_ENV=production
```

2. **Initialize external PostgreSQL database**:

```bash
# Connect to your external PostgreSQL server
psql $DATABASE_URL

# Run initialization commands manually:
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
ALTER DATABASE devcle SET timezone TO 'UTC';
-- See infra/postgres/init.sh for full setup
```

3. **Configure external Redis**:

```bash
# Connect to your external Redis server
redis-cli -h your-redis-server.cache.amazonaws.com -a your_password

# Verify configuration:
CONFIG GET maxmemory
CONFIG GET maxmemory-policy
CONFIG GET appendonly
```

4. **Start services in production mode**:

```bash
# Start only nginx and core services (no postgres/redis)
docker compose up -d

# 3. Check health status
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# 4. View logs
docker compose logs -f
```

#### Health Checks

The core service automatically checks external PostgreSQL and Redis connectivity via `/api/health` endpoint.

#### Security Considerations for External Services

**PostgreSQL:**
- Enable SSL/TLS connections
- Use strong passwords (32+ characters)
- Restrict network access (security groups/firewall)
- Enable connection pooling
- Regular security updates

**Redis:**
- Enable password authentication (requirepass)
- Use SSL/TLS connections
- Disable dangerous commands (FLUSHDB, FLUSHALL)
- Restrict network access
- Enable AOF persistence

### Development (Without Docker)

Each submodule has its own development environment:

```bash
# Core package
cd core
pnpm install
pnpm dev

# PostHog integration
cd posthog
pnpm install
pnpm build

# Webhook plugin
cd plugins
pnpm install
pnpm build
```

### Useful Commands

```bash
# Run tests
cd core && pnpm test

# Type check
cd core && pnpm typecheck

# Lint check
cd core && pnpm lint

# Format code
cd core && pnpm format
```

## Architecture

```
┌─────────────────────────────────────────┐
│            DRM Platform                 │
├─────────────────────────────────────────┤
│  Dashboard UI (Remix)                   │
├─────────────────────────────────────────┤
│  Core API (Hono)                        │
├─────────────────────────────────────────┤
│  Plugin System                          │
│  ├─ Webhook Plugin (Commercial)        │
│  └─ ... other plugins                   │
├─────────────────────────────────────────┤
│  PostHog Integration (OSS)              │
├─────────────────────────────────────────┤
│  Database Layer (Drizzle ORM)           │
│  PostgreSQL 15+                         │
└─────────────────────────────────────────┘
```

## Tech Stack

- **Language**: TypeScript 5.9+ (strict mode)
- **Runtime**: Node.js 20+
- **API**: Hono
- **UI**: Remix
- **Database**: PostgreSQL 15+ with Drizzle ORM
- **Analytics**: PostHog
- **Testing**: Vitest
- **Linting**: ESLint 9 (flat config)
- **Formatting**: Prettier

## License

- **Core & PostHog packages**: MIT License
- **Plugin packages**: Proprietary (see individual repositories)

## Contributing

Please refer to individual package repositories for contribution guidelines.
