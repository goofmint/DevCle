/**
 * System Settings SMTP Connection Test API - Resource Route
 *
 * Provides endpoint for testing SMTP connection before saving settings.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> SMTP Client -> SMTP Server
 * - Tests connection by verifying credentials
 * - Does not save settings to database
 *
 * Endpoints:
 * - POST /api/system-settings/test-smtp - Test SMTP connection
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { testSmtpConnection } from '../../utils/smtp-client.js';
import { SmtpSettingsSchema } from '../../services/system-settings.schemas.js';
import { ZodError } from 'zod';

/**
 * POST /api/system-settings/test-smtp - Test SMTP connection
 *
 * Tests SMTP connection with provided settings.
 * Does not save settings to database.
 *
 * Request Body:
 * {
 *   host: string,
 *   port: number,
 *   secure: boolean,
 *   user: string,
 *   password: string,
 *   from: string
 * }
 *
 * Response:
 * 200 OK
 * {
 *   success: true
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid input (validation error)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 403 Forbidden: Not admin
 * - 500 Internal Server Error: Connection test failed
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST method
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // 1. Authentication check
    const user = await requireAuth(request);

    // 2. Authorization check - admin only
    if (user.role !== 'admin') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = SmtpSettingsSchema.parse(body);

    // 4. Test SMTP connection
    await testSmtpConnection(validated);

    // 5. Return success response
    return json({ success: true }, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle validation errors
    if (error instanceof ZodError) {
      return json(
        {
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle connection test errors
    if (error instanceof Error) {
      console.error('SMTP connection test failed:', error);
      return json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/system-settings/test-smtp:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
