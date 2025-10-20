# Task 7.3.2.3: System Settings UI and E2E Tests

**Parent Task:** 7.3.2
**Status:** Pending
**Estimated Time:** 4 hours

---

## Overview

Implement system settings UI with dark/light mode support and comprehensive E2E tests.

---

## Implementation Files

### 1. `app/routes/dashboard.settings.tsx`

System settings page with tabbed interface.

**Sections:**
1. **Basic Settings:**
   - Service Name (text input)
   - Logo (file upload if S3 configured, URL input otherwise)
   - Fiscal Year Start (month dropdown: January-December)
   - Timezone (dropdown from `Intl.supportedValuesOf('timeZone')`)

2. **S3 Settings:**
   - Bucket (text input)
   - Region (text input)
   - Access Key ID (text input)
   - Secret Access Key (password input)
   - Endpoint (text input, optional)
   - Status indicator (✅ Configured / ⚠️ Not configured)
   - Test Connection button

3. **SMTP Settings:**
   - Host (text input)
   - Port (number input)
   - Use TLS (checkbox)
   - Username (text input)
   - Password (password input)
   - From Address (email input)
   - Status indicator
   - Test Connection button

**Note:** AI settings section removed - AI features are not included in OSS version.

**UI Requirements:**
- Use Iconify for all icons (NO inline SVG)
- Dark/Light mode support (use DarkModeProvider)
- Responsive design (mobile-friendly)
- Form validation (client + server)
- Loading states for all actions
- Toast notifications for success/error
- Confirm dialogs for destructive actions

**Component Structure:**
```typescript
// Main component
export default function SystemSettingsPage() {
  // loader から初期データ取得
  // 各セクションごとに独立したForm
  // Remix action でサブミット処理
}

// Loader: 設定データ取得
export async function loader({ request })

// Action: フォーム送信処理
export async function action({ request })
```

**Split Components (if > 300 lines):**
- `app/components/settings/BasicSettingsForm.tsx`
- `app/components/settings/S3SettingsForm.tsx`
- `app/components/settings/SmtpSettingsForm.tsx`

---

## E2E Tests

**Test File:** `e2e/dashboard-settings.spec.ts`

**Test Groups:**

### 1. Basic Settings (6 tests)
```typescript
test('should display system settings page (admin only)')
test('should prevent non-admin access')
test('should load existing settings')
test('should update service name')
test('should update fiscal year')
test('should update timezone')
```

### 2. S3 Settings (3 tests)
```typescript
test('should save S3 settings')
test('should show upload button when S3 is configured')
test('should test S3 connection')
```

### 3. SMTP Settings (2 tests)
```typescript
test('should save SMTP settings')
test('should test SMTP connection')
```

### 5. Validation (3 tests)
```typescript
test('should show validation error for invalid fiscal year')
test('should show validation error for invalid timezone')
test('should mask sensitive fields on reload')
```

**Dark/Light Mode Tests:**
Each form section should verify:
- Text color differs between light/dark mode
- Background color differs between light/dark mode
- No design issues (alignment, overflow, etc.)

**Total Test Count:** 14 tests (AI settings tests removed)

**Test Requirements:**
- NO Safari browser (Chromium only)
- NO mocking
- NO skipped tests
- Check design integrity (no visual bugs)
- Verify color contrast (light vs dark mode)

---

## Completion Criteria

- [ ] UI implemented (1-5 files, each < 300 lines)
- [ ] Dark/Light mode working
- [ ] All icons use Iconify
- [ ] Responsive design
- [ ] Form validation working
- [ ] E2E tests pass (16 tests)
- [ ] All tests pass (unit + integration + E2E)
- [ ] TypeScript errors: 0
- [ ] ESLint errors: 0
- [ ] No design issues verified

---

## Final Checklist

Before marking task 7.3.2 complete:
- [ ] Run `docker compose exec core pnpm test` → ALL PASS
- [ ] Run `docker compose exec core pnpm typecheck` → NO ERRORS
- [ ] Run `pnpm test:e2e` → ALL PASS (including new 16 tests)
- [ ] Verify dark/light mode visually
- [ ] Git commit with detailed message
