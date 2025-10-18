/**
 * System Settings Form Component
 *
 * Main form container for system-wide settings.
 * Delegates rendering to section-specific components:
 * - BasicSettingsSection: Service name, logo, fiscal year, timezone
 * - SMTPSettingsSection: Email server configuration
 * - AISettingsSection: AI provider, API key, model
 * - S3SettingsSection: Storage configuration
 *
 * Features:
 * - Dark/light mode support
 * - Client-side timezone detection for defaults
 * - Remix Form for progressive enhancement
 * - Sectioned layout with clear visual separation
 */

import { Form } from '@remix-run/react';
import { useEffect, useState } from 'react';
import type { SystemSettings } from '../../../services/system-settings.service.js';
import { BasicSettingsSection } from './BasicSettingsSection.js';
import { SMTPSettingsSection } from './SMTPSettingsSection.js';
import { AISettingsSection } from './AISettingsSection.js';
import { S3SettingsSection } from './S3SettingsSection.js';

// Remix serializes dates as strings, so we need to adjust the type
export interface SerializedSystemSettings extends Omit<SystemSettings, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingsFormProps {
  settings: SerializedSystemSettings | null;
  defaultTimezone: string;
}

/**
 * Main settings form component
 * Detects browser timezone on mount and renders four settings sections
 */
export function SystemSettingsForm({ settings, defaultTimezone }: SystemSettingsFormProps) {
  const [browserTimezone, setBrowserTimezone] = useState(defaultTimezone);

  // Detect browser timezone on client-side only
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) {
      setBrowserTimezone(detected);
    }
  }, []);

  // Use browser timezone if no saved setting exists
  const effectiveTimezone = settings?.timezone || browserTimezone;

  return (
    <Form method="post" className="space-y-8">
      {/* Basic Settings Section */}
      <BasicSettingsSection
        serviceName={settings?.serviceName || ''}
        logoUrl={settings?.logoUrl || ''}
        fiscalYearStart={settings?.fiscalYearStart || ''}
        fiscalYearEnd={settings?.fiscalYearEnd || ''}
        timezone={effectiveTimezone}
      />

      {/* SMTP Settings Section */}
      <SMTPSettingsSection
        smtpHost={settings?.smtpHost || ''}
        smtpPort={settings?.smtpPort || 587}
        smtpUsername={settings?.smtpUsername || ''}
        smtpPassword={settings?.smtpPassword || ''}
      />

      {/* AI Settings Section */}
      <AISettingsSection
        aiProvider={settings?.aiProvider || ''}
        aiApiKey={settings?.aiApiKey || ''}
        aiModel={settings?.aiModel || ''}
      />

      {/* S3 Settings Section */}
      <S3SettingsSection
        s3Bucket={settings?.s3Bucket || ''}
        s3Region={settings?.s3Region || ''}
        s3AccessKeyId={settings?.s3AccessKeyId || ''}
        s3SecretAccessKey={settings?.s3SecretAccessKey || ''}
        s3Endpoint={settings?.s3Endpoint || ''}
      />

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </Form>
  );
}
