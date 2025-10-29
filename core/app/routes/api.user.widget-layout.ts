/**
 * User Widget Layout API
 *
 * Provides API to manage user-specific widget layout preferences.
 * Layout is stored in user_preferences table (Task 8.10).
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> Widgets Service -> Drizzle ORM
 * - Uses Swapy layout format (slot-to-item mapping)
 * - Stores in user_preferences table with key "widget_layout"
 * - Enforces tenant isolation via RLS
 *
 * Endpoints:
 * - GET /api/user/widget-layout - Get user's widget layout
 * - PUT /api/user/widget-layout - Save user's widget layout
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getWidgetLayout,
  saveWidgetLayout,
} from '../services/widgets.service.js';

/**
 * GET /api/user/widget-layout - Get user's widget layout
 *
 * Returns the saved widget layout from user_preferences table.
 * Layout format is compatible with Swapy drag-and-drop library.
 *
 * Response:
 * 200 OK
 * {
 *   layout: {
 *     "slot-1": "item-github-activities",
 *     "slot-2": "item-slack-messages",
 *     ...
 *   }
 * }
 *
 * If no layout is saved yet:
 * {
 *   layout: null
 * }
 *
 * Error Responses:
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;
    const userId = user.userId;

    // 2. Get widget layout from user_preferences
    const layout = await getWidgetLayout(tenantId, userId);

    // 3. Return success response
    return json({ layout }, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to get widget layout:', error);
      return json({ error: 'Failed to fetch widget layout' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/user/widget-layout:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/user/widget-layout - Save user's widget layout
 *
 * Saves widget layout configuration to user_preferences table.
 * Uses upsert pattern (insert or update on conflict).
 *
 * Request Body:
 * {
 *   layout: {
 *     "slot-1": "item-github-activities",
 *     "slot-2": "item-slack-messages",
 *     ...
 *   }
 * }
 *
 * Response:
 * 200 OK
 * {
 *   success: true
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid request body (missing layout field)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 500 Internal Server Error: Database error
 */
export async function action({ request }: ActionFunctionArgs) {
  const method = request.method;

  // Only PUT method is allowed
  if (method !== 'PUT') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;
    const userId = user.userId;

    // 2. Parse and validate request body
    let requestData: { layout: Record<string, string> };
    try {
      requestData = await request.json();
    } catch (parseError) {
      return json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate layout field exists
    if (!requestData.layout || typeof requestData.layout !== 'object') {
      return json(
        { error: 'Missing or invalid "layout" field in request body' },
        { status: 400 }
      );
    }

    // 3. Save widget layout
    await saveWidgetLayout(tenantId, userId, requestData.layout);

    // 4. Return success response
    return json({ success: true }, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to save widget layout:', error);
      return json({ error: 'Failed to save widget layout' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in PUT /api/user/widget-layout:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
