import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

/**
 * Health check endpoint for container health monitoring
 * Used by Docker healthcheck and load balancers
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Basic health check - can be extended to check database, redis, etc.
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  return json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
