/**
 * System Settings S3 Connection Test API - Resource Route
 *
 * Provides endpoint for testing S3 connection before saving settings.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> S3 Client -> AWS S3
 * - Tests connection by creating and deleting a test object
 * - Does not save settings to database
 *
 * Endpoints:
 * - POST /api/system-settings/test-s3 - Test S3 connection
 */

import { json, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { testS3Connection } from '../../utils/s3-client.js';
import { S3SettingsSchema } from '../../services/system-settings.schemas.js';
import { ZodError } from 'zod';

/**
 * POST /api/system-settings/test-s3 - Test S3 connection
 *
 * Tests S3 connection with provided settings.
 * Does not save settings to database.
 *
 * Request Body:
 * {
 *   bucket: string,
 *   region: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   endpoint?: string  // For S3-compatible services (MinIO, etc.)
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
    const validated = S3SettingsSchema.parse(body);

    // Convert to S3Settings type (handle optional endpoint properly)
    const s3Settings: Parameters<typeof testS3Connection>[0] = {
      bucket: validated.bucket,
      region: validated.region,
      accessKeyId: validated.accessKeyId,
      secretAccessKey: validated.secretAccessKey,
      ...(validated.endpoint && { endpoint: validated.endpoint }),
    };

    // 4. Test S3 connection
    await testS3Connection(s3Settings);

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
      console.error('S3 connection test failed:', error);
      return json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/system-settings/test-s3:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
