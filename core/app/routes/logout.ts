/**
 * Logout Route
 *
 * Handles logout action (no UI).
 * Accessible at: /logout
 *
 * Features:
 * - Clears session cookie
 * - Redirects to home page
 *
 * Security:
 * - POST-only action (GET redirects to home)
 * - Clears all session data
 * - Sets cookie expiration to destroy session
 *
 * Usage:
 * ```tsx
 * <Form method="post" action="/logout">
 *   <button type="submit">Logout</button>
 * </Form>
 * ```
 */

import { redirect, type ActionFunctionArgs } from '@remix-run/node';
import { getSession, destroySession } from '~/sessions.server.js';

/**
 * Action function
 *
 * Handles POST /logout - Logout action
 *
 * Workflow:
 * 1. Get current session
 * 2. Destroy session (generates expired cookie)
 * 3. Redirect to home page with Set-Cookie header
 */
export async function action({ request }: ActionFunctionArgs) {
  // 1. Get current session
  const session = await getSession(request);

  // 2. Destroy session and redirect to home
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
 * Handles GET /logout - Redirect to home
 *
 * Logout requires POST for security (prevents CSRF via image src, etc.)
 * If user navigates to /logout directly, redirect to home page.
 */
export async function loader() {
  // GET requests to /logout should redirect to home
  // Actual logout must be done via POST
  return redirect('/');
}
