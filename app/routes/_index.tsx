/**
 * Home Page Route
 *
 * Landing page of the application.
 * Accessible at: /
 *
 * Provides links to login and dashboard.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import { getCurrentUser } from '~/auth.middleware.js';

/**
 * Loader function
 *
 * Checks if user is authenticated (optional).
 * If authenticated, shows personalized content.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Get current user (returns null if not authenticated)
  const user = await getCurrentUser(request);

  return json({ user });
}

/**
 * Home Page Component
 */
export default function Index() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Welcome to DRM</h1>
      <p style={{ fontSize: '20px', color: '#666', marginBottom: '40px' }}>
        Developer Relationship Management System
      </p>

      {user ? (
        // Authenticated user view
        <div>
          <p style={{ fontSize: '18px', marginBottom: '20px' }}>
            Welcome back, <strong>{user.displayName}</strong>!
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <Link
              to="/dashboard"
              style={{
                padding: '12px 24px',
                backgroundColor: '#0070f3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '16px',
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        // Guest user view
        <div>
          <p style={{ fontSize: '18px', marginBottom: '20px' }}>
            Please login to continue
          </p>
          <Link
            to="/auth/login"
            style={{
              padding: '12px 24px',
              backgroundColor: '#0070f3',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '16px',
            }}
          >
            Login
          </Link>
        </div>
      )}
    </div>
  );
}
