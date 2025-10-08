# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DRM (Developer Relationship Management)** is a DevRel analytics tool with a 3-tier architecture:
- `/core/` - OSS core functionality (ID resolution, funnel analysis, data management)
- `/plugins/` - Cloud plugins for external API integrations and AI analysis
- `/posthog/` - Anonymous analytics module for PostHog API integration

The project aims to provide both individual/organization funnel analysis and anonymous campaign contribution analysis without first-party cookies, using server-to-server integration.

## Current Status

This is an **early-stage project** with specification documents in `.tmp/` but minimal implementation. The architecture is defined in `.tmp/requirements.md`.

## Architecture Principles

### Core (`/core/`)
- **Self-contained OSS** that runs independently on self-hosted environments
- Data models: Person, Organization, Activity, Identifier
- PostgreSQL + Prisma with RLS for tenant isolation
- Remix-based dashboard UI
- Plugin loader at `/core/plugin-loader.ts` for extensibility

### Plugins (`/plugins/`)
- All cloud modules distributed as **independent plugins**
- Add API/UI/Job/ETL without modifying core
- Signed plugins for commercial distribution
- Plugin definition via `plugin.json` and `definePlugin()` API

### PostHog Integration (`/posthog/`)
- Integrates anonymous behavioral data with DRM funnels
- Server-to-server Capture API (distinct_id = click_id)
- Merges anonymous + authenticated funnels for campaign ROI

## Development Phases

| Phase | Focus |
|-------|-------|
| Phase 1 | Core completion, plugin API definition, PostHog connection |
| Phase 2 | Cloud plugins (Slack, connpass, CRM) |
| Phase 3 | Dashboard integration, AI attribution |
| Phase 4 | OSS release, Cloud launch |
| Phase 5 | OSS Marketplace for external plugin developers |

## Key Design Decisions

### No First-Party Cookies
- Use server-to-server integration and temporary IDs (click_id, etc.)
- Anonymous tracking via PostHog, authenticated tracking via DRM core

### Plugin System
- Core never changes; all extensions via plugins
- OSS plugins from `/plugins`, Cloud plugins from `/var/lib/drm/cloud-plugins`
- Signature verification (RSA256) for commercial plugins

### Multi-Tenant by Default
- Always include `tenant_id` in data paths
- Use PostgreSQL RLS for tenant isolation

## Entity Relationships

```
Person ||--o{ Activity : has
Person ||--o{ Identifier : has
Organization ||--o{ Person : includes
```

### Person
- `person_id` (uuid), `display_name`, `primary_email`, `org_id`, `consent_analytics`

### Activity
- `activity_id` (uuid), `type`, `source`, `metadata` (jsonb), `ts` (timestamptz)

### Identifier
- `identifier_id` (uuid), `kind`, `value`, `confidence` (float)

## Funnel Stages

1. **Awareness** - First contact with product/community
2. **Engagement** - Active participation (posts, events, contributions)
3. **Adoption** - Product usage, API calls
4. **Advocacy** - Evangelism, content creation

## Security & Privacy

- PII encrypted at rest
- Anonymous metrics aggregated for statistics
- Plugin operations logged to audit table
- Never commit secrets; use `.env.example`

## Licensing Model

| Component | License |
|-----------|---------|
| Core | MIT or BSL (TBD) |
| Plugins | Commercial (signed + cloud auth) |
| Plugin signatures | RSA256 verification |

## Commercial Plans

- **Community (OSS)**: Core features, CSV import, manual analysis (Free)
- **Cloud Standard**: + Slack/Discord/connpass/X integration (~$300/mo)
- **Cloud Pro**: + CRM sync, AI attribution, team features (~$1000/mo)
- **Enterprise**: SLA, SSO, audit, dedicated VPC ($10k+/yr)

## When Implementation Begins

Once actual code exists, update this file with:
- Build/test/lint commands (likely pnpm-based monorepo)
- Database migration commands
- Development server startup
- Plugin installation/verification commands
- API endpoint structure
- Testing approach (unit vs integration)
