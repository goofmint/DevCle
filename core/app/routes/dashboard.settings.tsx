/**
 * System Settings Page
 *
 * Admin-only page for managing system settings.
 * Accessible at: /dashboard/settings
 *
 * Features:
 * - Basic settings (service name, logo, fiscal year, timezone)
 * - S3 settings (bucket, credentials, endpoint)
 * - SMTP settings (host, port, credentials)
 * - Connection testing for S3 and SMTP
 * - Dark/Light mode support
 * - Admin-only access (403 for non-admin users)
 *
 * Architecture:
 * - Loader: Fetch settings from service layer
 * - Action: Update settings via service layer
 * - Components: BasicSettingsForm, S3SettingsForm, SmtpSettingsForm
 * - Server handlers: Separated to dashboard.settings.server.ts
 * - Toast logic: Separated to useSettingsToast hook
 */

import React from 'react';
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from '@remix-run/node';
import { useLoaderData, useFetcher, useRevalidator, Link, useLocation } from '@remix-run/react';
import { requireAuth } from '~/auth.middleware.js';
import { Icon } from '@iconify/react';
import { BasicSettingsForm } from '~/components/settings/BasicSettingsForm';
import { S3SettingsForm } from '~/components/settings/S3SettingsForm';
import { SmtpSettingsForm } from '~/components/settings/SmtpSettingsForm';
import { getSystemSettings } from '../../services/system-settings.service.js';
import { handleUpdate, handleTestS3, handleTestSmtp, type ActionData } from './dashboard.settings.server.js';
import { useSettingsToast } from '~/hooks/useSettingsToast.js';

/**
 * Meta function - Sets page title
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'System Settings - Dashboard - DevCle' },
    { name: 'description', content: 'Manage system settings and integrations' },
  ];
};

/**
 * Loader Data Type
 */
interface LoaderData {
  serviceName: string;
  logoUrl: string | null;
  fiscalYearStartMonth: number;
  timezone: string;
  s3Configured: boolean;
  smtpConfigured: boolean;
}

/**
 * Loader function
 *
 * Fetches system settings from service layer.
 * Only accessible to admin users.
 *
 * Steps:
 * 1. Authenticate user (requireAuth throws redirect if not authenticated)
 * 2. Check admin role (return 403 if not admin)
 * 3. Fetch settings from service layer
 * 4. Return settings data with sensitive fields masked
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);

    // 2. Authorization check - admin only
    if (user.role !== 'admin') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    // 3. Get settings directly from service layer
    const settings = await getSystemSettings(user.tenantId);

    // 4. Return settings with sensitive data hidden
    const response: LoaderData = {
      serviceName: settings.serviceName,
      logoUrl: settings.logoUrl,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      timezone: settings.timezone,
      s3Configured: settings.s3Settings !== null,
      smtpConfigured: settings.smtpSettings !== null,
    };

    return json<LoaderData>(response);
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response) {
      throw error;
    }

    // Handle service layer errors
    console.error('Failed to load system settings:', error);
    throw new Response('Failed to load system settings', { status: 500 });
  }
}

/**
 * Action function
 *
 * Handles form submissions for updating settings or testing connections.
 * Routes actions based on the 'intent' field in FormData.
 *
 * Intents:
 * - 'update': Update settings (basic, s3, smtp)
 * - 'test-s3': Test S3 connection
 * - 'test-smtp': Test SMTP connection
 *
 * Steps:
 * 1. Authenticate user
 * 2. Check admin role
 * 3. Parse FormData
 * 4. Route to appropriate action handler (defined in .server.ts)
 * 5. Return result
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);

    // 2. Authorization check - admin only
    if (user.role !== 'admin') {
      return json<ActionData>({ error: 'Admin role required' }, { status: 403 });
    }

    // 3. Parse FormData
    const formData = await request.formData();
    const intent = formData.get('intent') as string;
    const section = formData.get('section') as string;

    // 4. Route to appropriate action handler
    if (intent === 'test-s3') {
      return await handleTestS3(formData);
    }

    if (intent === 'test-smtp') {
      return await handleTestSmtp(formData);
    }

    if (intent === 'update') {
      return await handleUpdate(user.tenantId, formData, section);
    }

    // Unknown intent
    return json<ActionData>({ error: 'Invalid intent' }, { status: 400 });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response) {
      throw error;
    }

    // Handle errors
    console.error('Action error:', error);
    return json<ActionData>(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * System Settings Page Component
 *
 * Renders the system settings page with three sections:
 * 1. Basic Settings
 * 2. S3 Settings
 * 3. SMTP Settings
 *
 * Each section has its own form component and submission handler.
 * Uses Remix fetchers for async form submissions without navigation.
 */
export default function SystemSettingsPage() {
  // Get loader data (current settings)
  const loaderData = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  // Create fetchers for form submissions
  const basicFetcher = useFetcher<ActionData>();
  const s3Fetcher = useFetcher<ActionData>();
  const smtpFetcher = useFetcher<ActionData>();

  // Use fetcher for async connection tests without navigation
  const s3TestFetcher = useFetcher<ActionData>();
  const smtpTestFetcher = useFetcher<ActionData>();

  // Use custom hook for toast notifications
  const { toast } = useSettingsToast({
    basicFetcher,
    s3Fetcher,
    smtpFetcher,
    s3TestFetcher,
    smtpTestFetcher,
  });

  // Revalidate loader data after S3/SMTP settings are saved successfully
  React.useEffect(() => {
    if (s3Fetcher.data?.success && s3Fetcher.state === 'idle') {
      revalidator.revalidate();
    }
  }, [s3Fetcher.data, s3Fetcher.state, revalidator]);

  React.useEffect(() => {
    if (smtpFetcher.data?.success && smtpFetcher.state === 'idle') {
      revalidator.revalidate();
    }
  }, [smtpFetcher.data, smtpFetcher.state, revalidator]);

  // Check if loader returned error (403 Forbidden)
  if ('error' in loaderData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-6 rounded-lg">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:alert-circle" className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
          </div>
          <p className="mt-2">Admin role required to access system settings.</p>
        </div>
      </div>
    );
  }

  // Check if form is submitting (using fetchers now)
  const isBasicSubmitting = basicFetcher.state === 'submitting';
  const isS3Submitting = s3Fetcher.state === 'submitting';
  const isSmtpSubmitting = smtpFetcher.state === 'submitting';

  // Check if connection tests are running
  const isS3Testing = s3TestFetcher.state === 'submitting';
  const isSmtpTesting = smtpTestFetcher.state === 'submitting';

  // Helper function to render toast for specific section
  const renderToast = (section: 'basic' | 's3' | 'smtp' | 's3-test' | 'smtp-test') => {
    if (!toast || toast.section !== section) return null;

    return (
      <div
        className={`
          mb-4 p-4 rounded-md flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' : ''}
          ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400' : ''}
        `}
        role="alert"
        data-testid="toast-notification"
      >
        <Icon
          icon={toast.type === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'}
          className="w-5 h-5"
        />
        <span>{toast.message}</span>
      </div>
    );
  };

  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage system configuration and integrations
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Settings tabs">
          <Link
            to="/dashboard/settings"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                currentPath === '/dashboard/settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            System
          </Link>
          <Link
            to="/dashboard/settings/activity-types"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                currentPath === '/dashboard/settings/activity-types'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            Activity Types
          </Link>
        </nav>
      </div>

      {/* Settings Forms */}
      <div className="space-y-8">
        {/* Basic Settings Section */}
        {renderToast('basic')}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <BasicSettingsForm
            serviceName={loaderData.serviceName}
            logoUrl={loaderData.logoUrl}
            fiscalYearStartMonth={loaderData.fiscalYearStartMonth}
            timezone={loaderData.timezone}
            s3Configured={loaderData.s3Configured}
            onSubmit={(formData) => {
              formData.append('intent', 'update');
              basicFetcher.submit(formData, { method: 'post' });
            }}
            isSubmitting={isBasicSubmitting}
          />
        </div>

        {/* S3 Settings Section */}
        {renderToast('s3')}
        {renderToast('s3-test')}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <S3SettingsForm
            s3Configured={loaderData.s3Configured}
            onSubmit={(formData) => {
              formData.append('intent', 'update');
              s3Fetcher.submit(formData, { method: 'post' });
            }}
            onTestConnection={(formData) => {
              formData.append('intent', 'test-s3');
              s3TestFetcher.submit(formData, { method: 'post' });
            }}
            isSubmitting={isS3Submitting}
            isTesting={isS3Testing}
          />
        </div>

        {/* SMTP Settings Section */}
        {renderToast('smtp')}
        {renderToast('smtp-test')}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <SmtpSettingsForm
            smtpConfigured={loaderData.smtpConfigured}
            onSubmit={(formData) => {
              formData.append('intent', 'update');
              smtpFetcher.submit(formData, { method: 'post' });
            }}
            onTestConnection={(formData) => {
              formData.append('intent', 'test-smtp');
              smtpTestFetcher.submit(formData, { method: 'post' });
            }}
            isSubmitting={isSmtpSubmitting}
            isTesting={isSmtpTesting}
          />
        </div>
      </div>
    </div>
  );
}
