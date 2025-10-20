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
 * Detect actual file type from magic bytes
 *
 * @param buffer - File buffer
 * @returns Detected MIME type or null if not recognized
 */
function detectFileType(buffer: Buffer): string | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: 52 49 46 46 (RIFF) + offset 8: 57 45 42 50 (WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}


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

      // Detect actual file type from magic bytes
      let detectedType: string | null;
      try {
        detectedType = detectFileType(buffer);
      } catch (err) {
        throw new Error(`File type detection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      if (!detectedType) {
        throw new Error('Unable to detect file type. File may be corrupted or invalid.');
      }

      // Verify detected type matches provided contentType
      if (detectedType !== contentType) {
        throw new Error(
          `File type mismatch: provided ${contentType} but detected ${detectedType}. Please upload a valid image file.`
        );
      }

      // Verify detected type is in allowed list
      if (!ALLOWED_MIME_TYPES.includes(detectedType)) {
        throw new Error(
          `Invalid file type: ${detectedType}. Only PNG, JPEG, and WebP are allowed.`
        );
      }

      // Store file data in outer scope (use detected type instead of provided contentType)
      fileBuffer = buffer;
      fileContentType = detectedType;
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

    // 4. Generate deterministic filename from validated contentType
    // Use contentType (validated via magic bytes) instead of original filename
    let extension: string = 'png'; // default
    switch (fileData.contentType) {
      case 'image/png':
        extension = 'png';
        break;
      case 'image/jpeg':
        extension = 'jpg';
        break;
      case 'image/webp':
        extension = 'webp';
        break;
      default:
        throw new Error(`Unsupported content type: ${fileData.contentType}`);
    }
    const timestamp = Date.now();
    const generatedFilename = `logo-${timestamp}.${extension}`;

    // 5. Call service layer to upload logo
    // Note: fileData.contentType is already validated to be one of the allowed types
    const settings = await uploadLogo(tenantId, {
      buffer: fileData.buffer,
      contentType: fileData.contentType,
      filename: generatedFilename,
    });

    // 6. Return new logo URL
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
      // S3 configuration errors are server errors (500)
      if (error.message.includes('S3 settings not configured')) {
        return json({ error: error.message }, { status: 500 });
      }

      // S3 upload errors are also server errors (500)
      if (error.message.includes('Failed to upload to S3') || error.message.includes('Failed to upload logo to S3')) {
        return json({ error: error.message }, { status: 500 });
      }

      // All other errors are client errors (400)
      // This includes:
      // - Invalid file type
      // - File size exceeded
      // - Missing filename
      // - Unable to detect file type
      // - File type mismatch
      // - Malformed multipart data
      // - Missing file
      return json({ error: error.message }, { status: 400 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in POST /api/system-settings/upload-logo:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
