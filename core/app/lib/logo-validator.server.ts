/**
 * Logo URL Validation Utility
 *
 * Handler-level validation for logo URLs and file uploads.
 * Implements security checks beyond schema validation:
 * - File size limits (≤2MB)
 * - MIME type whitelist
 * - XSS protection (scheme denylist)
 * - Magic number validation for file uploads
 */

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

// Magic numbers for file type detection
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]); // JPEG
const SVG_START_XML = '<?xml';
const SVG_START_TAG = '<svg';

/**
 * Validate data URI
 * Checks MIME type and payload size
 */
export function validateDataUri(dataUri: string): { valid: boolean; error?: string } {
  // Extract MIME type
  const mimeMatch = dataUri.match(/^data:([^;,]+)/);
  if (!mimeMatch) {
    return { valid: false, error: 'Invalid data URI format' };
  }

  const mimeType = mimeMatch[1];
  if (!mimeType) {
    return { valid: false, error: 'Missing MIME type in data URI' };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `Invalid MIME type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }

  // Check payload size
  const base64Match = dataUri.match(/^data:[^;,]+;base64,(.+)$/);
  if (!base64Match) {
    return { valid: false, error: 'Data URI must be base64-encoded' };
  }

  const base64Data = base64Match[1];
  if (!base64Data) {
    return { valid: false, error: 'Missing base64 data in data URI' };
  }

  const payloadSize = Buffer.from(base64Data, 'base64').length;

  if (payloadSize > MAX_LOGO_SIZE) {
    return { valid: false, error: `Payload too large: ${payloadSize} bytes (max ${MAX_LOGO_SIZE})` };
  }

  return { valid: true };
}

/**
 * Validate plain URL
 * Checks for dangerous schemes (XSS protection)
 */
export function validatePlainUrl(url: string): { valid: boolean; error?: string } {
  const dangerousSchemes = ['javascript:', 'data:text/html', 'vbscript:', 'file:'];

  for (const scheme of dangerousSchemes) {
    if (url.toLowerCase().startsWith(scheme)) {
      return { valid: false, error: `Dangerous URL scheme detected: ${scheme}` };
    }
  }

  return { valid: true };
}

/**
 * Validate file buffer by checking magic numbers
 * Returns detected MIME type or null if invalid
 */
export function detectMimeType(buffer: Buffer): string | null {
  // Check PNG signature
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  // Check JPEG signature
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }

  // Check SVG (text-based, starts with <?xml or <svg)
  const textStart = buffer.toString('utf8', 0, Math.min(100, buffer.length));
  if (textStart.includes(SVG_START_XML) || textStart.includes(SVG_START_TAG)) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Validate logo URL (data URI or plain URL)
 * Performs handler-level security checks
 */
export function validateLogoUrl(logoUrl: string): { valid: boolean; error?: string } {
  if (logoUrl.startsWith('data:')) {
    return validateDataUri(logoUrl);
  }

  return validatePlainUrl(logoUrl);
}
