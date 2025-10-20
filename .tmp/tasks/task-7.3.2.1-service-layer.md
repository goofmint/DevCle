# Task 7.3.2.1: System Settings Service Layer

**Parent Task:** 7.3.2
**Status:** Pending
**Estimated Time:** 2 hours

---

## Overview

Implement service layer for system settings management with encryption support.

---

## Implementation Files

### 1. `core/services/system-settings.service.ts`

Main service file implementing CRUD operations.

**Functions:**
- `getSystemSettings(tenantId: string)`: Get settings (returns defaults if not exist)
- `updateSystemSettings(tenantId, data)`: UPSERT operation with encryption
- `isS3Configured(tenantId)`: Check if S3 is configured
- `isSmtpConfigured(tenantId)`: Check if SMTP is configured
- `uploadLogo(tenantId, file)`: Upload logo to S3 and update settings

**Key Requirements:**
- Use `withTenantContext()` for RLS
- Encrypt sensitive fields before DB save:
  - `s3Settings.secretAccessKey`
  - `smtpSettings.password`
- Decrypt on read automatically
- Handle UPSERT with `ON CONFLICT(tenant_id) DO UPDATE`
- Validate input with Zod schemas
- Transaction support for logo upload (S3 + DB)
- Rollback S3 upload if DB save fails

### 2. Zod Schemas

**SystemSettingsSchema:**
```typescript
{
  serviceName: string (1-100 chars),
  logoUrl: string | null (URL format),
  fiscalYearStartMonth: number (1-12),
  timezone: string (IANA timezone),
  baseUrl: string | null,
  s3Settings: S3SettingsSchema | null,
  smtpSettings: SmtpSettingsSchema | null,
  shortlinkDomain: string | null
}
```

**S3SettingsSchema:**
```typescript
{
  bucket: string (required),
  region: string (required),
  accessKeyId: string (required),
  secretAccessKey: string (required),
  endpoint?: string (optional)
}
```

**SmtpSettingsSchema:**
```typescript
{
  host: string (required),
  port: number (required),
  secure: boolean (required),
  user: string (required),
  password: string (required),
  from: string (email format, required)
}
```

---

## Testing

**Unit Tests (Vitest):**
- Test all CRUD operations
- Test encryption/decryption of sensitive fields
- Test UPSERT behavior
- Test validation errors
- Test S3 upload with rollback
- Test configuration check functions

**Test File:** `core/services/system-settings.service.test.ts`

**Minimum Test Count:** 20 tests

---

## Completion Criteria

- [ ] Service layer implemented
- [ ] Zod schemas defined
- [ ] All sensitive fields encrypted
- [ ] Unit tests pass (20+ tests)
- [ ] TypeScript errors: 0
- [ ] No `any` or `unknown` types
- [ ] File length < 300 lines (split if needed)
