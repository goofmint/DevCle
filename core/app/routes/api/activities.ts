/**
 * Activity API - Main Resource Route
 *
 * Provides RESTful API for activity management (collection endpoints).
 * Uses Activity Service (Task 4.4) for business logic.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Handler -> Activity Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to Activity Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET    /api/activities - List activities (with pagination, filtering, sorting)
 * - POST   /api/activities - Create a new activity
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { handleListActivities } from './activities/list.handler.js';
import { handleCreateActivity } from './activities/create.handler.js';

/**
 * GET /api/activities - List activities
 *
 * Delegates to list.handler.ts for implementation.
 * See list.handler.ts for detailed documentation.
 */
export async function loader(args: LoaderFunctionArgs) {
  return handleListActivities(args);
}

/**
 * POST /api/activities - Create a new activity
 *
 * Delegates to create.handler.ts for implementation.
 * See create.handler.ts for detailed documentation.
 */
export async function action(args: ActionFunctionArgs) {
  const method = args.request.method;

  if (method === 'POST') {
    return handleCreateActivity(args);
  }

  // Method not allowed
  return json({ error: 'Method not allowed' }, { status: 405 });
}
