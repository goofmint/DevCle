/**
 * Logout Route
 *
 * Handles logout action (no UI).
 * Accessible at: /auth/logout
 *
 * Features:
 * - Clears session cookie
 * - Clears tenant context from database connection
 * - Redirects to home page
 *
 * Security:
 * - POST-only action (GET redirects to home)
 * - Clears all session data
 * - Sets cookie expiration to destroy session
 *
 * Usage:
 * ```tsx
 * <Form method="post" action="/auth/logout">
 *   <button type="submit">Logout</button>
 * </Form>
 * ```
 */

import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { getSession, destroySession } from '~/sessions.server.js';
import { clearTenantContext } from '~/core/db/connection.js';

/**
 * Action function
 *
 * Handles POST /auth/logout - Logout action
 *
 * Workflow:
 * 1. Get current session
 * 2. Clear tenant context from database connection
 * 3. Destroy session (generates expired cookie)
 * 4. Redirect to home page with Set-Cookie header
 *
 * Note: Tenant context is cleared before session destruction
 * to ensure database cleanup happens before losing tenant ID.
 */
export async function action({ request }: ActionFunctionArgs) {
  // 1. Get current session
  const session = await getSession(request);

  // 2. Clear tenant context
  // This clears the PostgreSQL session variable (app.current_tenant_id)
  // Important: Do this before destroying the session
  try {
    await clearTenantContext();
  } catch (error) {
    // Log error but continue with logout
    // Even if tenant context clearing fails, we should log the user out
    console.error('Failed to clear tenant context during logout:', error);
  }

  // 3. Destroy session and redirect to home
  // destroySession() generates a Set-Cookie header with expired date
  return redirect('/', {
    headers: {
      'Set-Cookie': await destroySession(session),
    },
  });
}

/**
 * Loader function
 *
 * Handles GET /auth/logout - Redirect to home
 *
 * Logout requires POST for security (prevents CSRF via image src, etc.)
 * If user navigates to /auth/logout directly, redirect to home page.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // GET requests to /auth/logout should redirect to home
  // Actual logout must be done via POST
  return redirect('/');
}
