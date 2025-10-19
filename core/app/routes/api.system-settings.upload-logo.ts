/**
 * System Settings Logo Upload API - Resource Route
 *
 * Provides endpoint for uploading tenant logo to S3.
 *
 * Architecture:
 * - HTTP Request -> Resource Route (this file) -> System Settings Service -> S3 Client -> AWS S3
 * - Handles multipart/form-data parsing
 * - Validates file type and size
 * - Delegates upload logic to System Settings Service
 *
 * Endpoints:
 * - POST /api/system-settings/upload-logo - Upload logo file
 */

import {
  json,
  unstable_parseMultipartFormData,
  type ActionFunctionArgs,
} from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { uploadLogo } from '../../services/system-settings.service.js';
import { ZodError } from 'zod';

/**
 * Maximum file size: 2MB
 */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Allowed MIME types (PNG, JPEG, WebP only - NO SVG)
 */
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * POST /api/system-settings/upload-logo - Upload logo file
 *
 * Accepts multipart/form-data with a file field.
 * Uploads file to S3 and updates system settings with new logo URL.
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Field: file (image/png, image/jpeg, image/webp, max 2MB)
 *
 * Response:
 * 200 OK
 * {
 *   logoUrl: "https://bucket.s3.region.amazonaws.com/tenants/default/logo-123456.png"
 * }
 *
 * Error Responses:
 * - 400 Bad Request: Invalid file type or size, or missing file
 * - 401 Unauthorized: Missing or invalid authentication
 * - 403 Forbidden: Not admin
 * - 500 Internal Server Error: S3 not configured or upload failed
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST method
  if (request.method !== 'POST') {
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

    // 3. Parse multipart/form-data
    // Temporary storage for file data
    let fileBuffer: Buffer | null = null;
    let fileContentType: string | null = null;
    let fileFilename: string | null = null;

    // Custom upload handler to validate file before processing
    const uploadHandler = async ({
      name,
      contentType,
      data,
      filename,
    }: {
      name: string;
      contentType: string;
      data: AsyncIterable<Uint8Array>;
      filename?: string;
    }): Promise<string | null> => {
      // Only process 'file' field
      if (name !== 'file') {
        return null;
      }

      // Validate filename
      if (!filename) {
        throw new Error('Filename is required');
      }

      // Validate content type
      if (!ALLOWED_MIME_TYPES.includes(contentType)) {
        throw new Error(
          `Invalid file type: ${contentType}. Only PNG, JPEG, and WebP are allowed.`
        );
      }

      // Read file data into buffer
      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      for await (const chunk of data) {
        totalSize += chunk.length;

        // Check file size limit
        if (totalSize > MAX_FILE_SIZE) {
          throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        }

        chunks.push(chunk);
      }

      // Combine chunks into single buffer
      const buffer = Buffer.concat(chunks);

      // Store file data in outer scope
      fileBuffer = buffer;
      fileContentType = contentType;
      fileFilename = filename;

      return 'file'; // Return placeholder string
    };

    // Parse form data
    await unstable_parseMultipartFormData(request, uploadHandler);

    // Check if file was uploaded
    const fileData =
      fileBuffer && fileContentType && fileFilename
        ? {
            buffer: fileBuffer,
            contentType: fileContentType,
            filename: fileFilename,
          }
        : null;

    // Validate file was uploaded
    if (!fileData) {
      return json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 4. Call service layer to upload logo
    const settings = await uploadLogo(tenantId, {
      buffer: fileData.buffer,
      contentType: fileData.contentType as 'image/png' | 'image/jpeg' | 'image/webp',
      filename: fileData.filename,
    });

    // 5. Return new logo URL
    return json({ logoUrl: settings.logoUrl }, { status: 200 });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle validation errors (from uploadHandler or service layer)
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
      // Check for specific error messages from uploadHandler or service layer
      if (error.message.includes('Invalid file type') || error.message.includes('File size exceeds') || error.message.includes('Filename is required')) {
        return json({ error: error.message }, { status: 400 });
      }

      if (error.message.includes('S3 settings not configured')) {
        return json({ error: error.message }, { status: 500 });
      }

      console.error('Failed to upload logo:', error);
      return json({ error: 'Failed to upload logo' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/system-settings/upload-logo:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
