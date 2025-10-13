/**
 * Login Route
 *
 * Provides login form and handles login action.
 * Accessible at: /auth/login
 *
 * Features:
 * - Login form with email and password inputs
 * - Form validation (client and server-side)
 * - Error message display
 * - Redirect to returnTo URL after successful login
 * - Session creation with userId and tenantId
 * - Tenant context initialization
 *
 * Security:
 * - HTTPS only in production (cookie secure flag)
 * - httpOnly cookies (XSS protection)
 * - sameSite cookies (CSRF protection)
 * - Password verification via bcrypt (constant-time comparison)
 */

import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useSearchParams } from '@remix-run/react';
import { login } from '~/core/services/auth.service.js';
import { getSession, commitSession } from '~/sessions.server.js';
import { setTenantContext } from '~/core/db/connection.js';

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
 * Handles POST /auth/login - Login form submission
 *
 * Workflow:
 * 1. Parse form data (email, password)
 * 2. Validate input format
 * 3. Verify credentials via auth.service.login()
 * 4. Create session with userId and tenantId
 * 5. Set tenant context for database RLS
 * 6. Redirect to returnTo URL or /dashboard
 * 7. Set session cookie in response headers
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

    // 5. Set tenant context for database RLS
    // This ensures all subsequent database queries are filtered by tenant
    await setTenantContext(user.tenantId);

    // 6. Determine redirect URL
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo') || '/dashboard';

    // 7. Redirect with session cookie
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
 * - Email input (type="email" for browser validation)
 * - Password input (type="password" for masking)
 * - Submit button
 * - Error message display (from action response)
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

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h1>Login</h1>

      {/* Display error message if present */}
      {actionData?.error && (
        <div
          style={{
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#fee',
            border: '1px solid #c00',
            borderRadius: '4px',
            color: '#c00',
          }}
          role="alert"
        >
          {actionData.error}
        </div>
      )}

      {/* Login form */}
      <Form method="post">
        {/* Email input */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
            Email
          </label>
          <input
            type="email"
            name="email"
            id="email"
            required
            autoComplete="email"
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Password input */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>
            Password
          </label>
          <input
            type="password"
            name="password"
            id="password"
            required
            autoComplete="current-password"
            minLength={8}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Login
        </button>
      </Form>

      {/* Return to link (if returnTo is set) */}
      {returnTo && (
        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          You will be redirected to {returnTo} after login
        </p>
      )}
    </div>
  );
}
