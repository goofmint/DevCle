/**
 * Dashboard Index Route
 *
 * Main dashboard page (placeholder for now).
 * Accessible at: /dashboard
 *
 * This is a protected route that requires authentication.
 * Unauthenticated users will be redirected to /auth/login.
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { requireAuth } from '~/auth.middleware';

/**
 * Loader function
 *
 * Requires authentication. If not authenticated, redirects to login page.
 * Returns the authenticated user information to display in the dashboard.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Require authentication (redirects to /auth/login if not authenticated)
  const user = await requireAuth(request);

  return json({ user });
}

/**
 * Dashboard Component
 *
 * Simple placeholder dashboard that displays user information.
 */
export default function Dashboard() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>Dashboard</h1>

      <div style={{
        padding: '20px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '20px',
      }}>
        <h2>Welcome, {user.displayName}!</h2>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Tenant ID:</strong> {user.tenantId}</p>
      </div>

      <div style={{ marginTop: '30px' }}>
        <p>This is a protected route. You are successfully authenticated.</p>
      </div>
    </div>
  );
}
