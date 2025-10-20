/**
 * Dashboard Settings - Server-side Handlers
 *
 * Server-side logic for system settings updates and connection testing.
 * Separated from the main route file for better organization.
 */

import { json } from '@remix-run/node';
import { updateSystemSettings } from '../../services/system-settings.service.js';
import { testS3Connection } from '../../utils/s3-client.js';
import { testSmtpConnection } from '../../utils/smtp-client.js';

/**
 * Action Data Type
 */
export interface ActionData {
  success?: boolean;
  error?: string;
  section?: string;
}

/**
 * Handle update action
 *
 * Updates system settings directly via service layer.
 * Builds request body based on the section being updated.
 *
 * @param tenantId - Tenant ID for RLS context
 * @param formData - Form data from client
 * @param section - Section being updated (basic, s3, smtp)
 * @returns Response with success/error
 */
export async function handleUpdate(
  tenantId: string,
  formData: FormData,
  section: string
): Promise<Response> {
  try {
    let updateData = {};

    if (section === 'basic') {
      updateData = {
        serviceName: formData.get('serviceName') as string,
        logoUrl: (formData.get('logoUrl') as string) || null,
        fiscalYearStartMonth: Number(formData.get('fiscalYearStartMonth')),
        timezone: formData.get('timezone') as string,
      };
    } else if (section === 's3') {
      updateData = {
        s3Settings: {
          bucket: formData.get('bucket') as string,
          region: formData.get('region') as string,
          accessKeyId: formData.get('accessKeyId') as string,
          secretAccessKey: formData.get('secretAccessKey') as string,
          endpoint: (formData.get('endpoint') as string) || undefined,
        },
      };
    } else if (section === 'smtp') {
      updateData = {
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

    await updateSystemSettings(tenantId, updateData);
    return json<ActionData>({ success: true, section });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return json<ActionData>(
      { error: error instanceof Error ? error.message : 'Failed to update settings', section },
      { status: 500 }
    );
  }
}

/**
 * Handle test S3 connection
 *
 * Tests S3 connection directly using s3-client utility.
 *
 * @param formData - Form data with S3 credentials
 * @returns Response with success/error
 */
export async function handleTestS3(formData: FormData): Promise<Response> {
  try {
    const endpointValue = formData.get('endpoint') as string;
    const settings = {
      bucket: formData.get('bucket') as string,
      region: formData.get('region') as string,
      accessKeyId: formData.get('accessKeyId') as string,
      secretAccessKey: formData.get('secretAccessKey') as string,
      ...(endpointValue && { endpoint: endpointValue }),
    };

    await testS3Connection(settings);
    return json<ActionData>({ success: true, section: 's3-test' });
  } catch (error) {
    console.error('S3 connection test failed:', error);
    return json<ActionData>(
      { error: error instanceof Error ? error.message : 'S3 connection test failed', section: 's3-test' },
      { status: 500 }
    );
  }
}

/**
 * Handle test SMTP connection
 *
 * Tests SMTP connection directly using smtp-client utility.
 *
 * @param formData - Form data with SMTP credentials
 * @returns Response with success/error
 */
export async function handleTestSmtp(formData: FormData): Promise<Response> {
  try {
    const settings = {
      host: formData.get('host') as string,
      port: Number(formData.get('port')),
      secure: formData.get('useTls') === 'true',
      user: formData.get('username') as string,
      password: formData.get('password') as string,
      from: formData.get('fromAddress') as string,
    };

    await testSmtpConnection(settings);
    return json<ActionData>({ success: true, section: 'smtp-test' });
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    return json<ActionData>(
      { error: error instanceof Error ? error.message : 'SMTP connection test failed', section: 'smtp-test' },
      { status: 500 }
    );
  }
}
