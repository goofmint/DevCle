/**
 * System Settings API Routes
 *
 * GET  /api/settings - Get system settings for current tenant
 * PUT  /api/settings - Update system settings (partial update)
 *
 * Handler-level validation:
 * - Authentication + admin role check
 * - Content-Length check (>2MB → 413)
 * - CSRF protection (Remix built-in)
 * - logoUrl security validation (XSS, MIME, size)
 * - Sensitive field encryption before storage
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs, json } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware';
import { getSystemSettings, updateSystemSettings } from '../../../services/system-settings.service.js';
import { UpdateSystemSettingsSchema } from '../../../services/system-settings.schemas.js';
import { validateLogoUrl } from '~/lib/logo-validator.server.js';

const MAX_CONTENT_LENGTH = 2 * 1024 * 1024; // 2MB

/**
 * GET /api/settings
 * Get system settings for the current tenant
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Authentication check
  const user = await requireAuth(request);

  // Admin role check
  if (user.role !== 'admin') {
    return json({ error: 'Admin access required' }, { status: 403 });
  }

  // Get settings
  const settings = await getSystemSettings(user.tenantId);

  if (!settings) {
    // Return empty settings structure if not found
    return json({
      tenantId: user.tenantId,
      baseUrl: null,
      shortlinkDomain: null,
      serviceName: null,
      logoUrl: null,
      fiscalYearStart: null,
      fiscalYearEnd: null,
      timezone: null,
      smtpHost: null,
      smtpPort: null,
      smtpUsername: null,
      smtpPassword: null,
      aiProvider: null,
      aiApiKey: null,
      aiModel: null,
      s3Bucket: null,
      s3Region: null,
      s3AccessKeyId: null,
      s3SecretAccessKey: null,
      s3Endpoint: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return json(settings);
}

/**
 * PUT /api/settings
 * Update system settings (partial update)
 *
 * Handler-level validation:
 * 1. Authentication + admin role check
 * 2. Content-Length check (reject >2MB)
 * 3. CSRF protection (Remix automatic)
 * 4. logoUrl validation (MIME, size, XSS)
 * 5. Zod schema validation
 * 6. Sensitive field encryption (automatic in service layer)
 */
export async function action({ request }: ActionFunctionArgs) {
  // Only allow PUT method
  if (request.method !== 'PUT') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // 1. Authentication check
  const user = await requireAuth(request);

  // Admin role check
  if (user.role !== 'admin') {
    return json({ error: 'Admin access required' }, { status: 403 });
  }

  // 2. Content-Length check (reject >2MB before reading body)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_CONTENT_LENGTH) {
    return json({ error: 'Payload too large' }, { status: 413 });
  }

  // 3. CSRF protection is handled automatically by Remix

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 4. Handler-level logoUrl validation (if provided)
  if (body.logoUrl) {
    const logoValidation = validateLogoUrl(body.logoUrl);
    if (!logoValidation.valid) {
      return json({ error: logoValidation.error }, { status: 400 });
    }
  }

  // 5. Zod schema validation
  const parsed = UpdateSystemSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  // 6. Update settings (encryption happens in service layer)
  try {
    const updated = await updateSystemSettings(user.tenantId, parsed.data);
    return json(updated);
  } catch (error) {
    console.error('Failed to update settings:', error);
    return json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
