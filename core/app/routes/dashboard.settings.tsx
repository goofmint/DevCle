/**
 * System Settings Page
 *
 * Allows administrators to configure system-wide settings including:
 * - Basic settings (service name, logo, fiscal year, timezone)
 * - SMTP settings (email server configuration)
 * - AI settings (provider, API key, model)
 * - S3 settings (storage configuration)
 *
 * Access: Admin role only
 * Features:
 * - Dark/light mode support
 * - Real-time validation
 * - Secure password/key fields (masked)
 * - Browser timezone detection for defaults
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData } from '@remix-run/react';
import { requireAuth } from '~/auth.middleware';
import { getSystemSettings, updateSystemSettings } from '../../services/system-settings.service.js';
import { UpdateSystemSettingsSchema } from '../../services/system-settings.schemas.js';
import { validateLogoUrl } from '~/lib/logo-validator.server.js';
import { SystemSettingsForm } from '~/components/settings/SystemSettingsForm.js';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  // Admin only
  if (user.role !== 'admin') {
    throw new Response('Admin access required', { status: 403 });
  }

  const settings = await getSystemSettings(user.tenantId);

  return json({
    settings,
    defaultTimezone: 'Asia/Tokyo', // Will be overridden by client-side detection
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);

  if (user.role !== 'admin') {
    return json({ error: 'Admin access required' }, { status: 403 });
  }

  // Content-Length check
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
    return json({ error: 'Payload too large' }, { status: 413 });
  }

  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  // Convert empty strings to undefined
  const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value === '') {
      acc[key] = undefined;
    } else if (key === 'smtpPort' && typeof value === 'string') {
      acc[key] = parseInt(value, 10);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, unknown>);

  // Validate logoUrl if provided
  if (cleanedData['logoUrl'] && typeof cleanedData['logoUrl'] === 'string') {
    const logoValidation = validateLogoUrl(cleanedData['logoUrl']);
    if (!logoValidation.valid) {
      return json({ error: logoValidation.error }, { status: 400 });
    }
  }

  // Schema validation
  const parsed = UpdateSystemSettingsSchema.safeParse(cleanedData);
  if (!parsed.success) {
    return json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const updated = await updateSystemSettings(user.tenantId, parsed.data);
    return json({ success: true, settings: updated });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

export default function SettingsPage() {
  const { settings, defaultTimezone } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            System Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure system-wide settings for your DevCle instance
          </p>
        </div>

        {/* Success/Error Messages */}
        {actionData && 'success' in actionData && actionData.success && (
          <div className="mb-4 rounded-md bg-green-50 dark:bg-green-900/20 p-4">
            <p className="text-sm text-green-800 dark:text-green-300">
              Settings updated successfully
            </p>
          </div>
        )}

        {actionData && 'error' in actionData && actionData['error'] && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-800 dark:text-red-300">
              {actionData['error']}
            </p>
          </div>
        )}

        {/* Settings Form */}
        <SystemSettingsForm
          settings={settings}
          defaultTimezone={defaultTimezone}
        />
      </div>
    </div>
  );
}
