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
import { getUserById, type AuthUser, verifyPluginToken, type PluginAuthContext } from '../services/auth.service.js';

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
 * 3. If no userId, redirect to /login with returnTo parameter
 * 4. Query user by userId
 * 5. If user not found (invalid session), redirect to /login
 * 6. Return user object
 *
 * @param request - Remix request object
 * @param redirectTo - Optional URL to redirect after login (default: current URL)
 * @returns Authenticated user object
 * @throws {Response} Redirects to /login if not authenticated
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
    throw redirect(`/login?returnTo=${encodeURIComponent(returnToPath)}`);
  }

  // 3. Get user info from database
  const user = await getUserById(userId);
  if (!user) {
    // Session is invalid (user deleted or disabled): destroy session and redirect to login
    throw redirect('/login', {
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

/**
 * Require Plugin Authentication
 *
 * Validates plugin authentication token from Authorization header.
 * Used by plugin webhook routes and internal plugin API calls.
 *
 * Workflow:
 * 1. Extract Authorization header from request
 * 2. Parse Bearer token
 * 3. Verify plugin token (HMAC signature, timestamp, nonce)
 * 4. Return plugin auth context
 *
 * Security features:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation (5 min + ±30s clock skew)
 * - Anti-replay protection (nonce storage in DB)
 *
 * @param request - Remix request object
 * @returns Plugin auth context (pluginId, tenantId, nonce)
 * @throws {Response} Returns 401 Unauthorized if token invalid
 *
 * Usage in plugin API routes:
 * ```typescript
 * export async function action({ request }: ActionFunctionArgs) {
 *   const pluginContext = await requirePluginAuth(request);
 *   // pluginContext.pluginId and pluginContext.tenantId are now available
 *   // Use them to identify the plugin and tenant making the request
 *   return json({ success: true });
 * }
 * ```
 */
export async function requirePluginAuth(
  request: Request
): Promise<PluginAuthContext> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    throw new Response('Unauthorized: Missing Authorization header', {
      status: 401,
    });
  }

  // 2. Parse Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match || !match[1]) {
    throw new Response('Unauthorized: Invalid Authorization header format', {
      status: 401,
    });
  }

  const token = match[1];

  // 3. Get PLUGIN_INTERNAL_SECRET and verify it's configured
  const envSecret = process.env['PLUGIN_INTERNAL_SECRET'];
  if (!envSecret) {
    console.error('PLUGIN_INTERNAL_SECRET not configured');
    throw new Response('Internal Server Error: Auth not configured', {
      status: 500,
    });
  }

  // 4. Verify plugin token
  try {
    // Cast to string after validation - TypeScript control flow doesn't narrow process.env properly
    const pluginContext = await verifyPluginToken(token, envSecret as string);
    return pluginContext;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Response(`Unauthorized: ${message}`, {
      status: 401,
    });
  }
}

