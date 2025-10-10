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

# Edit the .env file and change the passwords
# IMPORTANT: Use strong passwords in production!
vim .env
```

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

### Production Deployment

For production environments:

```bash
# 1. Setup environment variables
cp .env.example .env
vim .env  # Set strong passwords!

# 2. Start services in production mode
docker compose up -d

# 3. Check health status
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# 4. View logs
docker compose logs -f
```

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
