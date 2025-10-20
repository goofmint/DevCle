/**
 * System Settings API - Resource Route
 *
 * Provides endpoints for managing system settings.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> System Settings Service -> Drizzle ORM -> PostgreSQL
 * - Handles HTTP-specific concerns (request/response, status codes, error handling)
 * - Delegates business logic to System Settings Service
 * - Enforces tenant context via RLS
 *
 * Endpoints:
 * - GET /api/system-settings - Get system settings
 * - PUT /api/system-settings - Update system settings (admin only)
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import {
  getSystemSettings,
  updateSystemSettings,
} from '../../services/system-settings.service.js';
import { UpdateSystemSettingsSchema } from '../../services/system-settings.schemas.js';
import { ZodError } from 'zod';

/**
 * GET /api/system-settings - Get system settings
 *
 * Returns system settings with sensitive data hidden.
 * Instead of returning full S3/SMTP settings objects, returns boolean flags.
 *
 * Response:
 * 200 OK
 * {
 *   tenantId: "default",
 *   serviceName: "DevCle",
 *   logoUrl: "https://...",
 *   fiscalYearStartMonth: 4,
 *   timezone: "Asia/Tokyo",
 *   baseUrl: "https://devcle.example.com",
 *   s3Configured: true,       // Boolean flag instead of s3Settings object
 *   smtpConfigured: false,    // Boolean flag instead of smtpSettings object
 *   shortlinkDomain: "go.example.com",
 *   createdAt: "2024-01-01T00:00:00Z",
 *   updatedAt: "2024-01-01T00:00:00Z"
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

    // 2. Call service layer to get system settings
    const settings = await getSystemSettings(tenantId);

    // 3. Hide sensitive data - return boolean flags instead of full objects
    const response = {
      tenantId: settings.tenantId,
      serviceName: settings.serviceName,
      logoUrl: settings.logoUrl,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      timezone: settings.timezone,
      baseUrl: settings.baseUrl,
      s3Configured: settings.s3Settings !== null,
      smtpConfigured: settings.smtpSettings !== null,
      shortlinkDomain: settings.shortlinkDomain,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };

    // 4. Return success response
    return json(response, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect (API should return 401 instead of redirect)
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to get system settings:', error);
      return json({ error: 'Failed to fetch system settings' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/system-settings:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/system-settings - Update system settings
 *
 * Updates system settings. Admin role required.
 * Validates input using UpdateSystemSettingsSchema.
 *
 * Request Body:
 * {
 *   serviceName?: string,
 *   logoUrl?: string | null,
 *   fiscalYearStartMonth?: number,
 *   timezone?: string,
 *   baseUrl?: string | null,
 *   s3Settings?: {
 *     bucket: string,
 *     region: string,
 *     accessKeyId: string,
 *     secretAccessKey: string,  // Automatically encrypted before DB save
 *     endpoint?: string
 *   } | null,
 *   smtpSettings?: {
 *     host: string,
 *     port: number,
 *     secure: boolean,
 *     user: string,
 *     password: string,  // Automatically encrypted before DB save
 *     from: string
 *   } | null,
 *   shortlinkDomain?: string | null
 * }
 *
 * Response: Same as GET response
 *
 * Error Responses:
 * - 400 Bad Request: Invalid input (validation error)
 * - 401 Unauthorized: Missing or invalid authentication
 * - 403 Forbidden: Not admin
 * - 500 Internal Server Error: Database error
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only allow PUT method
  if (request.method !== 'PUT') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // 1. Authentication check
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Authorization check - admin only
    if (user.role !== 'admin') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = UpdateSystemSettingsSchema.parse(body);

    // 4. Call service layer to update settings
    const settings = await updateSystemSettings(tenantId, validated);

    // 5. Hide sensitive data in response
    const response = {
      tenantId: settings.tenantId,
      serviceName: settings.serviceName,
      logoUrl: settings.logoUrl,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      timezone: settings.timezone,
      baseUrl: settings.baseUrl,
      s3Configured: settings.s3Settings !== null,
      smtpConfigured: settings.smtpSettings !== null,
      shortlinkDomain: settings.shortlinkDomain,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };

    // 6. Return success response
    return json(response, { status: 200 });
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

    // Handle service layer errors
    if (error instanceof Error) {
      console.error('Failed to update system settings:', error);
      return json({ error: 'Failed to update system settings' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in PUT /api/system-settings:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
