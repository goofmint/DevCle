/**
 * Authentication Middleware
 *
 * Provides helper functions for authentication checks in Remix routes.
 * Used in loaders and actions to ensure authenticated access.
 *
 * Two main functions:
 * 1. requireAuth(): Enforces authentication (redirects if not authenticated)
 * 2. getCurrentUser(): Optional authentication (returns null if not authenticated)
 *
 * Usage in Remix routes:
 * - Protected routes: Use requireAuth() in loader/action
 * - Conditional routes: Use getCurrentUser() for optional authentication
 */

import { redirect } from '@remix-run/node';
import { getSession, destroySession } from './sessions.server';
import { getUserById, type AuthUser } from '../services/auth.service.js';

/**
 * Require authentication for route
 *
 * This function checks if the request has a valid session with a user ID.
 * If authenticated, returns the user object.
 * If not authenticated, redirects to the login page with a returnTo parameter.
 *
 * Workflow:
 * 1. Extract session cookie from request
 * 2. Get userId from session
 * 3. If no userId, redirect to /auth/login with returnTo parameter
 * 4. Query user by userId
 * 5. If user not found (invalid session), redirect to /auth/login
 * 6. Return user object
 *
 * @param request - Remix request object
 * @param redirectTo - Optional URL to redirect after login (default: current URL)
 * @returns Authenticated user object
 * @throws {Response} Redirects to /auth/login if not authenticated
 *
 * Usage in protected routes:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await requireAuth(request);
 *   // user is guaranteed to be authenticated here
 *   // Access user.userId, user.tenantId, user.role, etc.
 *   return json({ user });
 * }
 * ```
 */
export async function requireAuth(
  request: Request,
  redirectTo?: string
): Promise<AuthUser> {
  // 1. Get session from request
  const session = await getSession(request);
  const userId = session.get('userId') as string | undefined;

  // 2. Check if authenticated
  if (!userId) {
    // Not authenticated: redirect to login with returnTo parameter
    const url = new URL(request.url);
    const returnToPath = redirectTo || url.pathname + url.search;
    throw redirect(`/auth/login?returnTo=${encodeURIComponent(returnToPath)}`);
  }

  // 3. Get user info from database
  const user = await getUserById(userId);
  if (!user) {
    // Session is invalid (user deleted or disabled): destroy session and redirect to login
    throw redirect('/auth/login', {
      headers: {
        'Set-Cookie': await destroySession(session),
      },
    });
  }

  // 4. Return authenticated user
  return user;
}

/**
 * Get current user from session (optional authentication)
 *
 * Similar to requireAuth, but returns null instead of redirecting.
 * Useful for routes that work with or without authentication.
 *
 * Workflow:
 * 1. Extract session cookie from request
 * 2. Get userId from session
 * 3. If no userId, return null
 * 4. Query user by userId
 * 5. If user not found, return null
 * 6. Return user object
 *
 * @param request - Remix request object
 * @returns User object or null if not authenticated
 *
 * Usage in conditional routes:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const user = await getCurrentUser(request);
 *   // user may be null (not authenticated)
 *   if (user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 *   return json({ user });
 * }
 * ```
 */
export async function getCurrentUser(
  request: Request
): Promise<AuthUser | null> {
  try {
    // 1. Get session from request
    const session = await getSession(request);
    const userId = session.get('userId') as string | undefined;

    // 2. Check if authenticated
    if (!userId) {
      return null; // Not authenticated
    }

    // 3. Get user info from database
    const user = await getUserById(userId);
    if (!user) {
      return null; // Session invalid
    }

    // 4. Return user
    return user;
  } catch (error) {
    // If any error occurs, treat as not authenticated
    // This prevents authentication errors from breaking the page
    return null;
  }
}
