/**
 * Activity API - Single Resource Route
 *
 * Handles operations on a single activity by ID.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Handler -> Activity Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Activity Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/activities/:id - Get activity by ID
 * - PUT    /api/activities/:id - Update activity (rare - data correction only)
 * - DELETE /api/activities/:id - Delete activity (rare - GDPR compliance only)
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { handleGetActivity } from './activities/get.handler.js';
import { handleUpdateActivity } from './activities/update.handler.js';
import { handleDeleteActivity } from './activities/delete.handler.js';

/**
 * GET /api/activities/:id - Get activity by ID
 *
 * Delegates to get.handler.ts for implementation.
 * See get.handler.ts for detailed documentation.
 */
export async function loader(args: LoaderFunctionArgs) {
  return handleGetActivity(args);
}

/**
 * PUT /api/activities/:id - Update activity
 * DELETE /api/activities/:id - Delete activity
 *
 * Delegates to update.handler.ts or delete.handler.ts for implementation.
 * See respective handler files for detailed documentation.
 */
export async function action(args: ActionFunctionArgs) {
  const method = args.request.method;

  if (method === 'PUT') {
    return handleUpdateActivity(args);
  }

  if (method === 'DELETE') {
    return handleDeleteActivity(args);
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}
