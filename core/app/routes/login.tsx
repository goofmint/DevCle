/**
 * Login Route
 *
 * Provides login form and handles login action.
 * Accessible at: /login
 *
 * Features:
 * - Login form with email and password inputs
 * - Form validation (client and server-side)
 * - Error message display
 * - Redirect to returnTo URL after successful login
 * - Session creation with userId and tenantId
 * - Tenant context initialization
 * - Header and Footer with dark mode support
 *
 * Security:
 * - HTTPS only in production (cookie secure flag)
 * - httpOnly cookies (XSS protection)
 * - sameSite cookies (CSRF protection)
 * - Password verification via bcrypt (constant-time comparison)
 */

import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useSearchParams } from '@remix-run/react';
import { login } from '~/services/auth.service.js';
import { getSession, commitSession } from '~/sessions.server.js';
import Header from '~/components/header';
import Footer from '~/components/footer';
import { useDarkMode } from '~/contexts/dark-mode-context';

/**
 * Loader function
 *
 * Checks if user is already authenticated.
 * If authenticated, redirect to dashboard.
 * If not authenticated, show login form.
 *
 * This prevents authenticated users from seeing the login form.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Check if already authenticated
  const session = await getSession(request);
  const userId = session.get('userId');

  if (userId) {
    // Already authenticated, redirect to dashboard
    return redirect('/dashboard');
  }

  // Not authenticated, show login form
  return null;
}

/**
 * Action function
 *
 * Handles POST /login - Login form submission
 *
 * Workflow:
 * 1. Parse form data (email, password)
 * 2. Validate input format
 * 3. Verify credentials via auth.service.login()
 * 4. Create session with userId and tenantId
 * 5. Redirect to returnTo URL or /dashboard
 * 6. Set session cookie in response headers
 *
 * Error handling:
 * - Missing fields: Return 400 with error message
 * - Invalid credentials: Return 401 with error message
 * - Database errors: Return 500 with generic error message
 *
 * Security:
 * - Password never logged or returned in response
 * - Same error message for "user not found" and "invalid password"
 * - Session cookie is httpOnly and secure in production
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Parse form data
    const formData = await request.formData();
    const email = formData.get('email');
    const password = formData.get('password');

    // 2. Validate input presence
    if (typeof email !== 'string' || typeof password !== 'string') {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    // 3. Verify credentials
    const user = await login(email, password);
    if (!user) {
      // Invalid credentials (either user not found or password incorrect)
      // Use same error message to prevent user enumeration
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 4. Create session
    const session = await getSession(request);
    session.set('userId', user.userId);
    session.set('tenantId', user.tenantId);

    // 5. Determine redirect URL
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo') || '/dashboard';

    // 6. Redirect with session cookie
    return redirect(returnTo, {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch (error) {
    // Log error for debugging (in production, use proper logging service)
    console.error('Login error:', error);

    // Return generic error message (don't expose internal details)
    return json(
      { error: 'An error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Login Page Component
 *
 * Renders a login form with:
 * - Header with logo and dark mode toggle
 * - Email input (type="email" for browser validation)
 * - Password input (type="password" for masking)
 * - Submit button
 * - Error message display (from action response)
 * - Footer with links
 *
 * Uses Remix Form component for:
 * - Automatic form submission handling
 * - Progressive enhancement (works without JS)
 * - Pending state management
 */
export default function Login() {
  // Get action response data (error message, if any)
  const actionData = useActionData<typeof action>();

  // Get returnTo URL from query params
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  // Dark mode state from app-level context
  const { isDark, toggleDark } = useDarkMode();

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header with logo and dark mode toggle */}
      <Header isDark={isDark} toggleDark={toggleDark} />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16">
        <div className="w-full max-w-md">
          {/* Login card */}
          <div className={`p-8 rounded-lg shadow-lg ${isDark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
            <h1 className={`text-3xl font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Log In
            </h1>

            {/* Display error message if present */}
            {actionData?.error && (
              <div
                className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                role="alert"
              >
                <p className="text-sm text-red-600 dark:text-red-400">{actionData.error}</p>
              </div>
            )}

            {/* Login form */}
            <Form method="post">
              {/* Email input */}
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                  autoComplete="email"
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                  placeholder="you@example.com"
                />
              </div>

              {/* Password input */}
              <div className="mb-6">
                <label
                  htmlFor="password"
                  className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                >
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  id="password"
                  required
                  autoComplete="current-password"
                  minLength={8}
                  className={`w-full px-4 py-2 rounded-lg border ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                  placeholder="Enter your password"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Log In
              </button>
            </Form>

            {/* Return to link (if returnTo is set) */}
            {returnTo && (
              <p className={`mt-4 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                You will be redirected to {returnTo} after login
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer isDark={isDark} />
    </div>
  );
}
