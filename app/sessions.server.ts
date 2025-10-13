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
 *
 * Usage:
 * 1. Login: Create session with userId and tenantId, commit to response headers
 * 2. Protected routes: Extract userId/tenantId from session
 * 3. Logout: Destroy session
 */

import { createCookieSessionStorage } from '@remix-run/node';

// Validate that SESSION_SECRET is set and capture it as string
const sessionSecret = process.env['SESSION_SECRET'];
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required');
}

/**
 * Session storage configuration
 *
 * This creates a cookie-based session storage with security best practices:
 * - name: Cookie name (prefixed with __ for added security)
 * - httpOnly: Prevents JavaScript access to cookies (XSS protection)
 * - path: Cookie available for all routes
 * - sameSite: 'lax' protects against CSRF while allowing normal navigation
 * - secrets: Array of secrets for cookie signing (integrity-protected, not encrypted)
 * - secure: HTTPS-only in production
 * - maxAge: Session expires after 7 days
 */
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [sessionSecret],
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  },
});

/**
 * Get session from request
 *
 * Extracts the session cookie from the request headers and parses it.
 * This is the first step in authentication checks.
 *
 * @param request - Remix request object
 * @returns Session object containing userId, tenantId, etc.
 *
 * Usage:
 * ```typescript
 * const session = await getSession(request);
 * const userId = session.get('userId');
 * ```
 */
export async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

/**
 * Commit session to response headers
 *
 * Serializes the session and returns a Set-Cookie header value.
 * Call this after modifying session data (e.g., after login).
 *
 * @param session - Session object to commit
 * @returns Set-Cookie header value
 *
 * Usage:
 * ```typescript
 * const session = await getSession(request);
 * session.set('userId', user.userId);
 * return redirect('/dashboard', {
 *   headers: {
 *     'Set-Cookie': await commitSession(session),
 *   },
 * });
 * ```
 */
export async function commitSession(session: ReturnType<typeof sessionStorage.getSession> extends Promise<infer T> ? T : never) {
  return sessionStorage.commitSession(session);
}

/**
 * Destroy session (logout)
 *
 * Generates a Set-Cookie header that clears the session cookie.
 * This effectively logs the user out by expiring the cookie.
 *
 * @param session - Session object to destroy
 * @returns Set-Cookie header value to clear the cookie
 *
 * Usage:
 * ```typescript
 * const session = await getSession(request);
 * return redirect('/', {
 *   headers: {
 *     'Set-Cookie': await destroySession(session),
 *   },
 * });
 * ```
 */
export async function destroySession(session: ReturnType<typeof sessionStorage.getSession> extends Promise<infer T> ? T : never) {
  return sessionStorage.destroySession(session);
}
