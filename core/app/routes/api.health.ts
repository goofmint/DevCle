import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

/**
 * Health check endpoint for container health monitoring
 * Used by Docker healthcheck and load balancers
 *
 * Note: Request parameter is not used in this simple health check
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loader(_args: LoaderFunctionArgs) {
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
