# Task 7.3.2.2: System Settings API Layer

**Parent Task:** 7.3.2
**Status:** Pending
**Estimated Time:** 2 hours

---

## Overview

Implement API routes for system settings management and connection testing.

---

## Implementation Files

### 1. `app/routes/api/system-settings.ts`

Main API route for GET/PUT system settings.

**Endpoints:**
- `GET /api/system-settings`: Get settings (hide sensitive data, return boolean flags)
- `PUT /api/system-settings`: Update settings (admin only)

**Response Format (GET):**
```typescript
{
  tenantId: string,
  serviceName: string,
  logoUrl: string | null,
  fiscalYearStartMonth: number,
  timezone: string,
  baseUrl: string | null,
  s3Configured: boolean,      // NOT s3Settings object
  smtpConfigured: boolean,    // NOT smtpSettings object
  aiConfigured: boolean,      // NOT aiSettings object
  shortlinkDomain: string | null,
  createdAt: string,
  updatedAt: string
}
```

**Security:**
- Require authentication (`requireAuth()`)
- Require admin role for PUT
- Never return sensitive data (API keys, passwords)
- Validate all inputs with Zod

### 2. `app/routes/api/system-settings.upload-logo.ts`

Logo upload endpoint.

**Endpoint:**
- `POST /api/system-settings/upload-logo`

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (image/*, max 2MB)

**Flow:**
1. Parse multipart data with `unstable_parseMultipartFormData`
2. Validate file type (PNG/JPEG/SVG) and size (max 2MB)
3. Call service layer `uploadLogo()`
4. Return new logo URL

**Error Handling:**
- 400: Invalid file type or size
- 401: Unauthorized
- 403: Not admin
- 500: S3 not configured or upload failed

### 3. Connection Test APIs

**3.1 `app/routes/api/system-settings.test-s3.ts`**
- `POST /api/system-settings/test-s3`
- Body: S3Settings
- Returns: `{ success: boolean, error?: string }`
- Calls `testS3Connection()` from s3-client

**3.2 `app/routes/api/system-settings.test-smtp.ts`**
- `POST /api/system-settings/test-smtp`
- Body: SmtpSettings
- Returns: `{ success: boolean, error?: string }`
- Sends test email to verify SMTP config

**3.3 `app/routes/api/system-settings.test-ai.ts`**
- `POST /api/system-settings/test-ai`
- Body: AiSettings
- Returns: `{ success: boolean, error?: string }`
- Makes test API call to verify AI config

---

## Testing

**Integration Tests (Vitest):**
- Test GET endpoint (with/without settings)
- Test PUT endpoint (admin/non-admin)
- Test logo upload (valid/invalid files)
- Test connection test endpoints
- Test authentication/authorization
- Test validation errors

**Test Files:**
- `app/routes/api/system-settings.test.ts`
- `app/routes/api/system-settings.upload-logo.test.ts`

**Minimum Test Count:** 15 tests

---

## Completion Criteria

- [ ] API routes implemented (5 files)
- [ ] Authentication/authorization enforced
- [ ] Sensitive data hidden in responses
- [ ] File upload validation working
- [ ] Connection test APIs working
- [ ] Integration tests pass (15+ tests)
- [ ] TypeScript errors: 0
- [ ] No `any` or `unknown` types
- [ ] File length < 300 lines each
