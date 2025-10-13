# Task 3.8: 認証システム実装

**タスク番号**: 3.8
**依存タスク**: Task 3.7（テナントコンテキスト管理API実装）
**推定時間**: 4時間
**完了条件**: ログイン/ログアウトが機能し、セッションが保持される

---

## 概要

Remix Cookie-based Sessionを使用した認証システムを実装します。このシステムは、ユーザー認証とテナントIDの管理を統合し、Task 3.7で実装したテナントコンテキストAPIと連携します。

**Phase 3の位置づけ**:
Task 3.8は、Phase 3のデータベース設計と実装の最後のタスクです。このタスクで認証基盤が整い、Phase 4のAPI実装で認証チェックが可能になります。

---

## 背景・目的

### 現状の問題

Task 4.2（Developer API実装）以降、全てのAPIエンドポイントで認証・認可が必要ですが、現在：
- ❌ 認証APIが存在しない（ログイン/ログアウト）
- ❌ セッション管理が未実装
- ❌ テナントIDとユーザーの紐付けがない

### 目的

- Remix Sessionsによる安全なCookie-based認証の実装
- ユーザー認証（login/logout）の提供
- セッションとテナントIDの統合
- APIエンドポイントで使用できる認証ミドルウェアの提供

---

## 実装するファイルとインターフェース

### 1. `app/sessions.server.ts` - Remix Sessionsセットアップ

Remix Cookie-based Sessionを設定します。

```typescript
/**
 * Remix Sessions Setup
 *
 * Provides secure cookie-based session management for authentication.
 * Sessions store user ID and tenant ID for authenticated requests.
 *
 * Security:
 * - httpOnly: Prevents XSS attacks (JavaScript cannot access cookies)
 * - secure: Only sent over HTTPS in production
 * - sameSite: Prevents CSRF attacks
 * - secrets: Session data is encrypted
 */

import { createCookieSessionStorage } from '@remix-run/node';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

/**
 * Session storage configuration
 */
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

/**
 * Get session from request
 *
 * @param request - Remix request object
 * @returns Session object
 */
export async function getSession(request: Request) {
  // Implementation:
  // const cookie = request.headers.get('Cookie');
  // return sessionStorage.getSession(cookie);
  throw new Error('Not implemented');
}

/**
 * Commit session to response headers
 *
 * @param session - Session object to commit
 * @returns Set-Cookie header value
 */
export async function commitSession(session: any) {
  // Implementation:
  // return sessionStorage.commitSession(session);
  throw new Error('Not implemented');
}

/**
 * Destroy session (logout)
 *
 * @param session - Session object to destroy
 * @returns Set-Cookie header value to clear the cookie
 */
export async function destroySession(session: any) {
  // Implementation:
  // return sessionStorage.destroySession(session);
  throw new Error('Not implemented');
}
```

### 2. `core/services/auth.service.ts` - 認証サービス

ユーザー認証のビジネスロジックを実装します。

```typescript
/**
 * Authentication Service
 *
 * Provides business logic for user authentication.
 * Handles login, password verification, and user retrieval.
 *
 * Architecture:
 * - Remix action -> Auth Service -> Drizzle ORM -> PostgreSQL
 * - Password hashing: bcrypt
 * - Session management: Remix Sessions (app/sessions.server.ts)
 */

import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

/**
 * Zod schema for login credentials
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .email()
    .openapi({
      example: 'admin@example.com',
      description: 'User email address',
    }),
  password: z
    .string()
    .min(8)
    .openapi({
      example: '********',
      description: 'User password (min 8 characters)',
    }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * User type (simplified for authentication)
 */
export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: 'admin' | 'member';
}

/**
 * Verify user credentials and return user info
 *
 * @param email - User email address
 * @param password - Plain text password
 * @returns User object if credentials are valid, null otherwise
 * @throws {Error} If database error occurs
 *
 * Implementation:
 * 1. Validate input using LoginSchema
 * 2. Query users table by email (case-insensitive)
 * 3. Verify password using bcrypt.compare()
 * 4. If valid, return user object (without password hash)
 * 5. If invalid, return null
 *
 * Security:
 * - Always use bcrypt.compare() for password verification
 * - Never return password hash to caller
 * - Use constant-time comparison to prevent timing attacks
 * - Rate limit login attempts (implementation in route layer)
 */
export async function login(
  email: string,
  password: string
): Promise<AuthUser | null> {
  // Implementation will be added in coding phase
  // 1. Validate input
  // const validated = LoginSchema.parse({ email, password });
  //
  // 2. Query user by email
  // const db = getDb();
  // const [user] = await db
  //   .select()
  //   .from(schema.users)
  //   .where(eq(schema.users.email, validated.email))
  //   .limit(1);
  //
  // 3. Verify password
  // if (!user || !user.passwordHash) {
  //   return null; // User not found or no password set
  // }
  //
  // const isValid = await bcrypt.compare(validated.password, user.passwordHash);
  // if (!isValid) {
  //   return null; // Invalid password
  // }
  //
  // 4. Return user info (without password hash)
  // return {
  //   userId: user.userId,
  //   email: user.email,
  //   displayName: user.displayName,
  //   tenantId: user.tenantId,
  //   role: user.role,
  // };
  throw new Error('Not implemented');
}

/**
 * Get user by ID
 *
 * @param userId - User ID (UUID)
 * @returns User object or null if not found
 * @throws {Error} If database error occurs
 *
 * Implementation:
 * 1. Query users table by user_id
 * 2. Return user object (without password hash)
 * 3. Return null if not found
 *
 * Usage: Retrieve user info from session
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  // Implementation will be added in coding phase
  throw new Error('Not implemented');
}

/**
 * Hash password using bcrypt
 *
 * @param password - Plain text password
 * @returns Hashed password
 *
 * Usage: When creating or updating users
 */
export async function hashPassword(password: string): Promise<string> {
  // Implementation will be added in coding phase
  // const saltRounds = 10;
  // return bcrypt.hash(password, saltRounds);
  throw new Error('Not implemented');
}
```

### 3. `core/services/auth.middleware.ts` - 認証ミドルウェア

認証チェックを行うヘルパー関数を実装します。

```typescript
/**
 * Authentication Middleware
 *
 * Provides helper functions for authentication checks in Remix routes.
 * Used in loaders and actions to ensure authenticated access.
 */

import { redirect } from '@remix-run/node';
import { getSession } from '~/sessions.server.js';
import { getUserById, type AuthUser } from './auth.service.js';

/**
 * Require authentication for route
 *
 * This function checks if the request has a valid session.
 * If not authenticated, redirects to login page.
 *
 * Usage in Remix loaders/actions:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await requireAuth(request);
 *   // user is guaranteed to be authenticated here
 * }
 * ```
 *
 * @param request - Remix request object
 * @param redirectTo - Optional URL to redirect after login (default: current URL)
 * @returns Authenticated user object
 * @throws {Response} Redirects to /auth/login if not authenticated
 *
 * Implementation:
 * 1. Get session from request
 * 2. Extract userId from session
 * 3. If no userId, redirect to login with returnTo parameter
 * 4. Query user by userId
 * 5. If user not found, redirect to login (session invalid)
 * 6. Return user object
 */
export async function requireAuth(
  request: Request,
  redirectTo?: string
): Promise<AuthUser> {
  // Implementation will be added in coding phase
  // 1. Get session
  // const session = await getSession(request);
  // const userId = session.get('userId');
  //
  // 2. Check if authenticated
  // if (!userId) {
  //   const url = new URL(request.url);
  //   const returnTo = redirectTo || url.pathname + url.search;
  //   throw redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  // }
  //
  // 3. Get user info
  // const user = await getUserById(userId);
  // if (!user) {
  //   // Session invalid (user deleted)
  //   throw redirect('/auth/login');
  // }
  //
  // 4. Return user
  // return user;
  throw new Error('Not implemented');
}

/**
 * Get current user from session (optional authentication)
 *
 * Similar to requireAuth, but returns null instead of redirecting.
 * Useful for routes that work with or without authentication.
 *
 * Usage:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await getCurrentUser(request);
 *   // user may be null (not authenticated)
 * }
 * ```
 *
 * @param request - Remix request object
 * @returns User object or null if not authenticated
 */
export async function getCurrentUser(
  request: Request
): Promise<AuthUser | null> {
  // Implementation will be added in coding phase
  // Similar to requireAuth, but return null instead of redirect
  throw new Error('Not implemented');
}
```

### 4. `app/routes/auth/login.tsx` - ログインフォーム

ログインUIとアクション処理を実装します。

```typescript
/**
 * Login Route
 *
 * Provides login form and handles login action.
 * Accessible at: /auth/login
 */

import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useSearchParams } from '@remix-run/react';
import { login } from '~/services/auth.service.js';
import { getSession, commitSession } from '~/sessions.server.js';
import { setTenantContext } from '~/db/connection.js';

/**
 * POST /auth/login - Handle login form submission
 *
 * Request Body:
 * - email: string
 * - password: string
 *
 * Success:
 * - Redirect to returnTo URL or /dashboard
 * - Set session cookie with userId and tenantId
 *
 * Error:
 * - Return error message to display in form
 */
export async function action({ request }: ActionFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Parse form data
  // const formData = await request.formData();
  // const email = formData.get('email');
  // const password = formData.get('password');
  //
  // 2. Validate input
  // if (!email || !password) {
  //   return json({ error: 'Email and password are required' }, { status: 400 });
  // }
  //
  // 3. Verify credentials
  // const user = await login(email, password);
  // if (!user) {
  //   return json({ error: 'Invalid email or password' }, { status: 401 });
  // }
  //
  // 4. Create session
  // const session = await getSession(request);
  // session.set('userId', user.userId);
  // session.set('tenantId', user.tenantId);
  //
  // 5. Set tenant context for this session
  // await setTenantContext(user.tenantId);
  //
  // 6. Redirect to returnTo or dashboard
  // const url = new URL(request.url);
  // const returnTo = url.searchParams.get('returnTo') || '/dashboard';
  //
  // return redirect(returnTo, {
  //   headers: {
  //     'Set-Cookie': await commitSession(session),
  //   },
  // });
  throw new Error('Not implemented');
}

/**
 * Login Page Component
 */
export default function Login() {
  // Implementation will be added in coding phase
  // Display login form with:
  // - Email input
  // - Password input
  // - Submit button
  // - Error message display (from useActionData)
  // - Link to signup (future)
  return (
    <div>
      <h1>Login</h1>
      <Form method="post">
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </Form>
    </div>
  );
}
```

### 5. `app/routes/auth/logout.ts` - ログアウト処理

ログアウトアクションを実装します。

```typescript
/**
 * Logout Route
 *
 * Handles logout action (no UI).
 * Accessible at: /auth/logout (POST only)
 */

import { redirect, type ActionFunctionArgs } from '@remix-run/node';
import { getSession, destroySession } from '~/sessions.server.js';
import { clearTenantContext } from '~/db/connection.js';

/**
 * POST /auth/logout - Handle logout
 *
 * Success:
 * - Clear session cookie
 * - Clear tenant context
 * - Redirect to home page
 */
export async function action({ request }: ActionFunctionArgs) {
  // Implementation will be added in coding phase
  // 1. Get current session
  // const session = await getSession(request);
  //
  // 2. Clear tenant context
  // await clearTenantContext();
  //
  // 3. Destroy session and redirect
  // return redirect('/', {
  //   headers: {
  //     'Set-Cookie': await destroySession(session),
  //   },
  // });
  throw new Error('Not implemented');
}

/**
 * GET /auth/logout - Redirect to home (logout requires POST)
 */
export async function loader() {
  return redirect('/');
}
```

---

## アーキテクチャ層の責務

### セッション層（`app/sessions.server.ts`）

**責務**:
- Cookie-based Sessionの設定
- セッションの暗号化・復号化
- セッションCookieのライフサイクル管理

**実装しないこと**:
- ビジネスロジック（認証サービスが担当）
- データベース操作

### サービス層（`core/services/auth.service.ts`）

**責務**:
- パスワード検証（bcrypt）
- ユーザー情報の取得
- パスワードハッシュ化

**実装しないこと**:
- セッション管理（Remixが担当）
- HTTPレスポンス処理（Resource Routeが担当）

### ミドルウェア層（`core/services/auth.middleware.ts`）

**責務**:
- 認証チェック
- セッションからユーザー情報取得
- 未認証時のリダイレクト

**実装しないこと**:
- パスワード検証（サービス層が担当）

### HTTP層（`app/routes/auth/*.tsx`）

**責務**:
- HTTPリクエスト/レスポンス処理
- フォームデータのパース
- セッションCookieの設定
- リダイレクト処理

**実装しないこと**:
- パスワード検証（サービス層が担当）

---

## セキュリティ考慮事項

### 1. パスワード保護

**bcryptによるハッシュ化**:
```typescript
// Hashing (user registration)
const hash = await bcrypt.hash(password, 10); // 10 = salt rounds

// Verification (login)
const isValid = await bcrypt.compare(password, hash);
```

**注意事項**:
- ❌ 平文でパスワードを保存しない
- ❌ MD5やSHA-1は使用しない（脆弱）
- ✅ bcryptを使用（レインボーテーブル攻撃に強い）
- ✅ Salt roundsは10以上推奨

### 2. セッションCookie保護

**Cookie設定**:
```typescript
cookie: {
  httpOnly: true,      // XSS攻撃防止（JavaScriptからアクセス不可）
  secure: true,        // HTTPS通信のみ（本番環境）
  sameSite: 'lax',     // CSRF攻撃防止
  secrets: [SECRET],   // セッションデータの暗号化
  maxAge: 7 * 24 * 60 * 60, // 7日間有効
}
```

### 3. CSRF対策

Remixは自動的にCSRF保護を提供します：
- `<Form>`コンポーネントが自動的にCSRFトークンを含める
- `sameSite: 'lax'`設定でさらに保護

### 4. タイミング攻撃対策

パスワード検証時、ユーザーの存在チェックと password検証を分離しない：

```typescript
// ✅ 正しい実装（constant-time）
const user = await getUserByEmail(email);
if (!user || !await bcrypt.compare(password, user.passwordHash)) {
  return null; // Same error for both cases
}

// ❌ 間違った実装（timing attack vulnerable）
const user = await getUserByEmail(email);
if (!user) {
  return null; // Fast response
}
if (!await bcrypt.compare(password, user.passwordHash)) {
  return null; // Slow response (reveals user exists)
}
```

### 5. Rate Limiting（将来実装）

**ブルートフォース攻撃対策**:
- ログイン試行回数を制限（例: 5回/分）
- IPアドレスごとに制限
- アカウントロックアウト（例: 10回失敗で30分ロック）

---

## データフロー

### ログインフロー

```
1. User submits login form
   ↓
2. POST /auth/login (action)
   ↓
3. auth.service.login(email, password)
   ↓
4. Query users table + bcrypt.compare()
   ↓
5. Create session (userId, tenantId)
   ↓
6. Set tenant context (setTenantContext)
   ↓
7. Redirect to dashboard with Set-Cookie header
```

### 認証チェックフロー

```
1. Request to protected route (e.g., /api/developers)
   ↓
2. requireAuth(request)
   ↓
3. Extract userId from session cookie
   ↓
4. Query user by userId
   ↓
5. If authenticated: return user
   If not: redirect to /auth/login
```

### ログアウトフロー

```
1. POST /auth/logout
   ↓
2. clearTenantContext()
   ↓
3. destroySession(session)
   ↓
4. Redirect to home with Set-Cookie: (expired)
```

---

## 環境変数

### 必須環境変数

```bash
# .env.example
SESSION_SECRET=your-super-secret-key-minimum-32-characters
```

**生成方法**:
```bash
# Generate random secret
openssl rand -base64 32
```

**注意事項**:
- ❌ `.env`ファイルをgitにコミットしない
- ✅ 本番環境では環境変数として設定
- ✅ 最低32文字の強力なランダム文字列を使用

---

## テスト方針

### 単体テスト（`core/services/auth.service.test.ts`）

#### 1. `login()`のテスト

```typescript
describe('login', () => {
  it('should return user for valid credentials', async () => {
    // Test successful login
  });

  it('should return null for invalid email', async () => {
    // Test with non-existent email
  });

  it('should return null for invalid password', async () => {
    // Test with wrong password
  });

  it('should return null for inactive user', async () => {
    // Test with deactivated account
  });
});
```

#### 2. `getUserById()`のテスト

```typescript
describe('getUserById', () => {
  it('should return user by ID', async () => {
    // Test user retrieval
  });

  it('should return null for non-existent ID', async () => {
    // Test with invalid UUID
  });
});
```

#### 3. `hashPassword()`のテスト

```typescript
describe('hashPassword', () => {
  it('should hash password with bcrypt', async () => {
    const hash = await hashPassword('password123');
    expect(hash).not.toBe('password123');
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  it('should generate different hashes for same password', async () => {
    // Test that salt is used (different hash each time)
    const hash1 = await hashPassword('password123');
    const hash2 = await hashPassword('password123');
    expect(hash1).not.toBe(hash2);
  });
});
```

### 統合テスト（`app/routes/auth/login.test.ts`）

```typescript
describe('POST /auth/login', () => {
  it('should login with valid credentials', async () => {
    // Test successful login flow
  });

  it('should return 401 for invalid credentials', async () => {
    // Test failed login
  });

  it('should set session cookie on success', async () => {
    // Test that Set-Cookie header is present
  });

  it('should redirect to returnTo URL', async () => {
    // Test redirect with returnTo parameter
  });
});

describe('POST /auth/logout', () => {
  it('should clear session cookie', async () => {
    // Test logout flow
  });

  it('should redirect to home page', async () => {
    // Test redirect after logout
  });
});
```

### E2Eテスト（Playwright）

```typescript
test('user can login and logout', async ({ page }) => {
  // 1. Navigate to login page
  await page.goto('/auth/login');

  // 2. Fill login form
  await page.fill('input[name="email"]', 'admin@example.com');
  await page.fill('input[name="password"]', 'password123');

  // 3. Submit form
  await page.click('button[type="submit"]');

  // 4. Verify redirect to dashboard
  await expect(page).toHaveURL('/dashboard');

  // 5. Logout
  await page.click('button[data-action="logout"]');

  // 6. Verify redirect to home
  await expect(page).toHaveURL('/');
});
```

---

## 開発環境での認証

開発環境では、固定ユーザーを使用して認証をスキップすることもできます。

### オプション1: シードデータで管理者ユーザー作成

```typescript
// core/db/seed.ts
await setTenantContext('default');

const passwordHash = await bcrypt.hash('password123', 10);

await db.insert(schema.users).values({
  userId: crypto.randomUUID(),
  tenantId: 'default',
  email: 'admin@example.com',
  passwordHash,
  displayName: 'Admin User',
  role: 'admin',
});
```

### オプション2: 開発環境で認証バイパス

```typescript
// core/services/auth.middleware.ts
export async function requireAuth(request: Request): Promise<AuthUser> {
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
    // Development only: bypass authentication
    return {
      userId: '00000000-0000-4000-8000-000000000000',
      email: 'dev@example.com',
      displayName: 'Dev User',
      tenantId: 'default',
      role: 'admin',
    };
  }

  // Normal authentication flow
  // ...
}
```

---

## 完了チェックリスト

- [ ] `app/sessions.server.ts`ファイル作成
- [ ] `core/services/auth.service.ts`ファイル作成
- [ ] `core/services/auth.middleware.ts`ファイル作成
- [ ] `app/routes/auth/login.tsx`ファイル作成
- [ ] `app/routes/auth/logout.ts`ファイル作成
- [ ] `login()`実装とテスト
- [ ] `getUserById()`実装とテスト
- [ ] `hashPassword()`実装とテスト
- [ ] `requireAuth()`実装とテスト
- [ ] `getCurrentUser()`実装とテスト
- [ ] ログインフォームUI実装
- [ ] ログインアクション実装
- [ ] ログアウトアクション実装
- [ ] セッションとテナントIDの統合テスト
- [ ] 環境変数（SESSION_SECRET）設定
- [ ] シードデータに管理者ユーザー追加
- [ ] 全テストが成功（`pnpm test`）
- [ ] TypeScriptエラーなし（`pnpm typecheck`）
- [ ] Lintエラーなし（`pnpm lint`）

---

## 次のタスク

Task 3.8完了後、以下のタスクに進みます：

- **Task 4.1**: DRMサービス基盤実装
- **Task 4.2**: Developer API実装（認証チェック付き）

---

## 参考資料

- [Remix Sessions](https://remix.run/docs/en/main/utils/sessions)
- [bcrypt.js](https://github.com/dcodeIO/bcrypt.js)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
