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
cd devcle
```

### Initialize submodules (if already cloned)

```bash
git submodule update --init --recursive
```

### Development

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
