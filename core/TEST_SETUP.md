# Test Setup Guide

## Overview

This document describes how to set up and run tests in the DRM project.

## Test Environment Architecture

The test environment runs in Docker containers using docker-compose. There are two configuration files:
- `docker-compose.yml` - Base/production configuration
- `docker-compose-test.yml` - Test environment overrides

**IMPORTANT**: Always use `--env-file .env.test` when running test environment commands.

## Prerequisites

### 1. Environment Variables

Ensure `.env.test` has the correct `LOCAL_WORKSPACE_FOLDER`:

```bash
# For DevContainer environments
LOCAL_WORKSPACE_FOLDER=/workspace

# For local development (macOS/Linux)
LOCAL_WORKSPACE_FOLDER=/path/to/your/workspace
```

### 2. Plugin Submodules

Ensure plugin submodules are initialized:

```bash
git submodule update --init --recursive
```

## Running Tests

### Integration Tests (Vitest) - IN DOCKER

```bash
# Start test environment (MUST use --env-file .env.test)
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# Run tests
docker compose --env-file .env.test exec core pnpm test

# Run typecheck
docker compose --env-file .env.test exec core pnpm typecheck
```

**Note**: Source code changes are mounted via volume, so changes to `.ts` files are immediately reflected. No rebuild is required.

### E2E Tests (Playwright) - ON HOST

E2E tests run on the host machine and access the application running in Docker containers.

```bash
# Start test environment
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d

# Seed database INSIDE Docker (ensures test DB is used)
docker compose --env-file .env.test exec core pnpm db:seed

# Run E2E tests from host
cd core && BASE_URL=https://devcle.test pnpm test:e2e --max-failures=1
```

**Why BASE_URL is required:**
- Tests use `https://devcle.test` (resolved via /etc/hosts to nginx container)
- Without `BASE_URL`, tests will try `http://localhost:3000` and fail

## Troubleshooting

### Volume Mount Issues

If source code changes are not reflected in the container:

1. Check `LOCAL_WORKSPACE_FOLDER` in `.env.test`
2. Restart containers:
   ```bash
   docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml down
   docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d
   ```

3. Verify mount:
   ```bash
   docker inspect devcle-core-test --format='{{json .Mounts}}' | python3 -m json.tool
   ```

### TypeScript Errors

If you see module resolution errors:

1. Check `tsconfig.json` paths configuration
2. Ensure `allowImportingTsExtensions: true` is set
3. Restart TypeScript server (in your editor)

### Database Connection Errors

If tests fail with database connection errors:

1. Ensure containers are healthy:
   ```bash
   docker compose --env-file .env.test ps
   ```

2. Check database is ready:
   ```bash
   docker compose --env-file .env.test exec postgres pg_isready -U devcle
   ```

## Before Commit Checklist

- [ ] All integration tests pass: `docker compose --env-file .env.test exec core pnpm test`
- [ ] Typecheck passes: `docker compose --env-file .env.test exec core pnpm typecheck`
- [ ] Database seeded: `docker compose --env-file .env.test exec core pnpm db:seed`
- [ ] E2E tests pass: `cd core && BASE_URL=https://devcle.test pnpm test:e2e`

## Common Patterns

### Running a Specific Test File

```bash
# Integration test
docker compose --env-file .env.test exec core pnpm vitest run path/to/test.test.ts

# E2E test
cd core && BASE_URL=https://devcle.test pnpm playwright test e2e/specific.spec.ts
```

### Debugging Tests

```bash
# Run tests with verbose output
docker compose --env-file .env.test exec core pnpm vitest run --reporter=verbose

# Run E2E tests in headed mode
cd core && BASE_URL=https://devcle.test pnpm playwright test --headed
```

### Clean Test Environment

```bash
# Stop and remove all containers and volumes
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml down -v

# Start fresh
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose-test.yml up -d
docker compose --env-file .env.test exec core pnpm db:migrate
docker compose --env-file .env.test exec core pnpm db:seed
```
