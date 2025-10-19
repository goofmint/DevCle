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
 * - Loader: Fetch settings from GET /api/system-settings
 * - Action: Update settings via PUT /api/system-settings
 * - Components: BasicSettingsForm, S3SettingsForm, SmtpSettingsForm
 */

import { useState } from 'react';
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from '@remix-run/node';
import { useLoaderData, useActionData, useFetcher } from '@remix-run/react';
import { requireAuth } from '~/auth.middleware.js';
import { Icon } from '@iconify/react';
import { BasicSettingsForm } from '~/components/settings/BasicSettingsForm';
import { S3SettingsForm } from '~/components/settings/S3SettingsForm';
import { SmtpSettingsForm } from '~/components/settings/SmtpSettingsForm';

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
 * Action Data Type
 */
interface ActionData {
  success?: boolean;
  error?: string;
  section?: string;
}

/**
 * Loader function
 *
 * Fetches system settings from API.
 * Only accessible to admin users.
 *
 * Steps:
 * 1. Authenticate user (requireAuth throws redirect if not authenticated)
 * 2. Check admin role (return 403 if not admin)
 * 3. Fetch settings from GET /api/system-settings
 * 4. Return settings data
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    const user = await requireAuth(request);

    // 2. Authorization check - admin only
    if (user.role !== 'admin') {
      return json({ error: 'Admin role required' }, { status: 403 });
    }

    // 3. Fetch settings from API
    const url = new URL(request.url);
    const apiUrl = `${url.origin}/api/system-settings`;

    const response = await fetch(apiUrl, {
      headers: {
        Cookie: request.headers.get('Cookie') || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }

    const settings = (await response.json()) as LoaderData;

    // 4. Return settings
    return json<LoaderData>(settings);
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response) {
      throw error;
    }

    // Handle fetch errors
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
 * - 'update-basic': Update basic settings
 * - 'update-s3': Update S3 settings
 * - 'update-smtp': Update SMTP settings
 * - 'test-s3': Test S3 connection
 * - 'test-smtp': Test SMTP connection
 *
 * Steps:
 * 1. Authenticate user
 * 2. Check admin role
 * 3. Parse FormData
 * 4. Route to appropriate action handler
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
    const url = new URL(request.url);

    if (intent === 'test-s3') {
      return await handleTestS3(url, request, formData);
    }

    if (intent === 'test-smtp') {
      return await handleTestSmtp(url, request, formData);
    }

    if (intent === 'update') {
      return await handleUpdate(url, request, formData, section);
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
 * Handle update action
 *
 * Updates system settings via PUT /api/system-settings.
 * Builds request body based on the section being updated.
 */
async function handleUpdate(
  url: URL,
  request: Request,
  formData: FormData,
  section: string
): Promise<Response> {
  const apiUrl = `${url.origin}/api/system-settings`;

  let body = {};

  if (section === 'basic') {
    body = {
      serviceName: formData.get('serviceName') as string,
      logoUrl: (formData.get('logoUrl') as string) || null,
      fiscalYearStartMonth: Number(formData.get('fiscalYearStartMonth')),
      timezone: formData.get('timezone') as string,
    };
  } else if (section === 's3') {
    body = {
      s3Settings: {
        bucket: formData.get('bucket') as string,
        region: formData.get('region') as string,
        accessKeyId: formData.get('accessKeyId') as string,
        secretAccessKey: formData.get('secretAccessKey') as string,
        endpoint: (formData.get('endpoint') as string) || undefined,
      },
    };
  } else if (section === 'smtp') {
    body = {
      smtpSettings: {
        host: formData.get('host') as string,
        port: Number(formData.get('port')),
        secure: formData.get('useTls') === 'true',
        user: formData.get('username') as string,
        password: formData.get('password') as string,
        from: formData.get('fromAddress') as string,
      },
    };
  }

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('Cookie') || '',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    return json<ActionData>(
      { error: errorData.error || 'Failed to update settings', section },
      { status: response.status }
    );
  }

  return json<ActionData>({ success: true, section });
}

/**
 * Handle test S3 connection
 *
 * Tests S3 connection via POST /api/system-settings/test-s3.
 */
async function handleTestS3(url: URL, request: Request, formData: FormData): Promise<Response> {
  const apiUrl = `${url.origin}/api/system-settings/test-s3`;

  const body = {
    bucket: formData.get('bucket') as string,
    region: formData.get('region') as string,
    accessKeyId: formData.get('accessKeyId') as string,
    secretAccessKey: formData.get('secretAccessKey') as string,
    endpoint: (formData.get('endpoint') as string) || undefined,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('Cookie') || '',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    return json<ActionData>(
      { error: result.error || 'S3 connection test failed', section: 's3-test' },
      { status: response.status }
    );
  }

  return json<ActionData>({ success: true, section: 's3-test' });
}

/**
 * Handle test SMTP connection
 *
 * Tests SMTP connection via POST /api/system-settings/test-smtp.
 */
async function handleTestSmtp(url: URL, request: Request, formData: FormData): Promise<Response> {
  const apiUrl = `${url.origin}/api/system-settings/test-smtp`;

  const body = {
    host: formData.get('host') as string,
    port: Number(formData.get('port')),
    secure: formData.get('useTls') === 'true',
    user: formData.get('username') as string,
    password: formData.get('password') as string,
    from: formData.get('fromAddress') as string,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('Cookie') || '',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    return json<ActionData>(
      { error: result.error || 'SMTP connection test failed', section: 'smtp-test' },
      { status: response.status }
    );
  }

  return json<ActionData>({ success: true, section: 'smtp-test' });
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
 * Uses Remix forms for progressive enhancement.
 */
export default function SystemSettingsPage() {
  // Get loader data (current settings)
  const loaderData = useLoaderData<typeof loader>();

  // Get action data (form submission result)
  const actionData = useActionData<typeof action>();

  // Create fetchers for form submissions
  const basicFetcher = useFetcher<ActionData>();
  const s3Fetcher = useFetcher<ActionData>();
  const smtpFetcher = useFetcher<ActionData>();

  // Use fetcher for async connection tests without navigation
  const s3TestFetcher = useFetcher<ActionData>();
  const smtpTestFetcher = useFetcher<ActionData>();

  // Local state for toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  // Show toast on action completion
  if (actionData && !toast) {
    if (actionData.success) {
      const messages: Record<string, string> = {
        basic: 'Basic settings saved successfully',
        s3: 'S3 settings saved successfully',
        smtp: 'SMTP settings saved successfully',
        's3-test': 'S3 connection test passed',
        'smtp-test': 'SMTP connection test passed',
      };
      setToast({ message: messages[actionData.section || ''] || 'Success', type: 'success' });
    } else if (actionData.error) {
      setToast({ message: actionData.error, type: 'error' });
    }

    // Auto-dismiss toast after 5 seconds
    setTimeout(() => setToast(null), 5000);
  }

  // Handle basic settings form submission
  const handleBasicSubmit = (formData: FormData) => {
    formData.append('intent', 'update');
    basicFetcher.submit(formData, { method: 'post' });
  };

  // Handle S3 settings form submission
  const handleS3Submit = (formData: FormData) => {
    formData.append('intent', 'update');
    s3Fetcher.submit(formData, { method: 'post' });
  };

  // Handle SMTP settings form submission
  const handleSmtpSubmit = (formData: FormData) => {
    formData.append('intent', 'update');
    smtpFetcher.submit(formData, { method: 'post' });
  };

  // Handle S3 connection test
  const handleS3Test = (formData: FormData) => {
    formData.append('intent', 'test-s3');
    s3TestFetcher.submit(formData, { method: 'post' });
  };

  // Handle SMTP connection test
  const handleSmtpTest = (formData: FormData) => {
    formData.append('intent', 'test-smtp');
    smtpTestFetcher.submit(formData, { method: 'post' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage system configuration and integrations
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`
            mb-6 p-4 rounded-md flex items-center gap-2
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
      )}

      {/* Settings Forms */}
      <div className="space-y-8">
        {/* Basic Settings Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <BasicSettingsForm
            serviceName={loaderData.serviceName}
            logoUrl={loaderData.logoUrl}
            fiscalYearStartMonth={loaderData.fiscalYearStartMonth}
            timezone={loaderData.timezone}
            s3Configured={loaderData.s3Configured}
            onSubmit={handleBasicSubmit}
            isSubmitting={isBasicSubmitting}
          />
        </div>

        {/* S3 Settings Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <S3SettingsForm
            s3Configured={loaderData.s3Configured}
            onSubmit={handleS3Submit}
            onTestConnection={handleS3Test}
            isSubmitting={isS3Submitting}
            isTesting={isS3Testing}
          />
        </div>

        {/* SMTP Settings Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <SmtpSettingsForm
            smtpConfigured={loaderData.smtpConfigured}
            onSubmit={handleSmtpSubmit}
            onTestConnection={handleSmtpTest}
            isSubmitting={isSmtpSubmitting}
            isTesting={isSmtpTesting}
          />
        </div>
      </div>
    </div>
  );
}
