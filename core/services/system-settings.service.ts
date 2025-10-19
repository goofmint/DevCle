/**
 * System Settings Service
 *
 * Manages per-tenant system settings with encryption support.
 *
 * Features:
 * - CRUD operations for system settings
 * - Automatic encryption/decryption of sensitive fields
 * - S3 logo upload with transaction rollback support
 * - Configuration status checks (S3, SMTP)
 *
 * Note: AI settings removed from OSS version (moved to commercial plugins).
 */

import { eq } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption.js';
import { uploadToS3, deleteFromS3 } from '../utils/s3-client.js';
import {
  UpdateSystemSettingsSchema,
  type UpdateSystemSettings,
  type SystemSettings,
  type S3Settings,
  type SmtpSettings,
  UploadLogoSchema,
  type UploadLogo,
} from './system-settings.schemas.js';

/**
 * Default system settings values
 *
 * Used when tenant has no settings record yet.
 */
const DEFAULT_SETTINGS = {
  serviceName: 'DevCle',
  logoUrl: null,
  fiscalYearStartMonth: 4, // April (typical in Japan)
  timezone: 'Asia/Tokyo',
  baseUrl: null,
  s3Settings: null,
  smtpSettings: null,
  shortlinkDomain: null,
} as const;

/**
 * Encrypt sensitive fields in S3 settings
 *
 * Encrypts secretAccessKey if not already encrypted.
 *
 * @param settings - S3 settings object
 * @returns S3 settings with encrypted secretAccessKey
 */
function encryptS3Settings(settings: S3Settings): S3Settings {
  return {
    ...settings,
    secretAccessKey: isEncrypted(settings.secretAccessKey)
      ? settings.secretAccessKey
      : encrypt(settings.secretAccessKey),
  };
}

/**
 * Decrypt sensitive fields in S3 settings
 *
 * Decrypts secretAccessKey if encrypted.
 *
 * @param settings - S3 settings object from database
 * @returns S3 settings with decrypted secretAccessKey
 */
function decryptS3Settings(settings: S3Settings): S3Settings {
  return {
    ...settings,
    secretAccessKey: isEncrypted(settings.secretAccessKey)
      ? decrypt(settings.secretAccessKey)
      : settings.secretAccessKey,
  };
}

/**
 * Encrypt sensitive fields in SMTP settings
 *
 * Encrypts password if not already encrypted.
 *
 * @param settings - SMTP settings object
 * @returns SMTP settings with encrypted password
 */
function encryptSmtpSettings(settings: SmtpSettings): SmtpSettings {
  return {
    ...settings,
    password: isEncrypted(settings.password) ? settings.password : encrypt(settings.password),
  };
}

/**
 * Decrypt sensitive fields in SMTP settings
 *
 * Decrypts password if encrypted.
 *
 * @param settings - SMTP settings object from database
 * @returns SMTP settings with decrypted password
 */
function decryptSmtpSettings(settings: SmtpSettings): SmtpSettings {
  return {
    ...settings,
    password: isEncrypted(settings.password) ? decrypt(settings.password) : settings.password,
  };
}

/**
 * Get System Settings
 *
 * Retrieves system settings for a tenant. Returns defaults if no settings exist yet.
 * Automatically decrypts sensitive fields (S3 secretAccessKey, SMTP password).
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns SystemSettings object with decrypted sensitive fields
 * @throws {Error} If database error occurs
 *
 * Example:
 * ```typescript
 * const settings = await getSystemSettings('default');
 * console.log(settings.serviceName); // "DevCle"
 * console.log(settings.s3Settings?.secretAccessKey); // Decrypted value
 * ```
 */
export async function getSystemSettings(tenantId: string): Promise<SystemSettings> {
  const result = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.tenantId, tenantId));

    return rows[0];
  });

  // Return defaults if no settings exist
  if (!result) {
    return {
      tenantId,
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Decrypt sensitive fields before returning
  const s3Settings = result.s3Settings
    ? decryptS3Settings(result.s3Settings as S3Settings)
    : null;
  const smtpSettings = result.smtpSettings
    ? decryptSmtpSettings(result.smtpSettings as SmtpSettings)
    : null;

  return {
    tenantId: result.tenantId,
    serviceName: result.serviceName,
    logoUrl: result.logoUrl,
    fiscalYearStartMonth: result.fiscalYearStartMonth,
    timezone: result.timezone,
    baseUrl: result.baseUrl,
    s3Settings,
    smtpSettings,
    shortlinkDomain: result.shortlinkDomain,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Update System Settings
 *
 * Updates system settings using UPSERT (INSERT ON CONFLICT UPDATE).
 * Automatically encrypts sensitive fields before database save.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Settings update parameters (all fields optional)
 * @returns Updated SystemSettings object with decrypted sensitive fields
 * @throws {Error} If validation fails or database error occurs
 *
 * Implementation details:
 * 1. Validate input using UpdateSystemSettingsSchema
 * 2. Encrypt sensitive fields (S3 secretAccessKey, SMTP password)
 * 3. UPSERT into system_settings table with ON CONFLICT(tenant_id) DO UPDATE
 * 4. Decrypt and return updated settings
 *
 * Example:
 * ```typescript
 * const settings = await updateSystemSettings('default', {
 *   serviceName: 'My DevRel Tool',
 *   fiscalYearStartMonth: 1,
 *   s3Settings: {
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *     accessKeyId: 'AKIA...',
 *     secretAccessKey: 'secret...', // Automatically encrypted
 *   },
 * });
 * ```
 */
export async function updateSystemSettings(
  tenantId: string,
  input: UpdateSystemSettings
): Promise<SystemSettings> {
  // 1. Validate input
  const validated = UpdateSystemSettingsSchema.parse(input);

  // 2. Encrypt sensitive fields
  const s3SettingsToSave = validated.s3Settings
    ? encryptS3Settings(validated.s3Settings as S3Settings)
    : validated.s3Settings;
  const smtpSettingsToSave = validated.smtpSettings
    ? encryptSmtpSettings(validated.smtpSettings)
    : validated.smtpSettings;

  // 3. UPSERT into system_settings table
  const result = await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .insert(schema.systemSettings)
      .values({
        tenantId,
        serviceName: validated.serviceName ?? DEFAULT_SETTINGS.serviceName,
        logoUrl: validated.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
        fiscalYearStartMonth:
          validated.fiscalYearStartMonth ?? DEFAULT_SETTINGS.fiscalYearStartMonth,
        timezone: validated.timezone ?? DEFAULT_SETTINGS.timezone,
        baseUrl: validated.baseUrl ?? DEFAULT_SETTINGS.baseUrl,
        s3Settings: s3SettingsToSave ?? DEFAULT_SETTINGS.s3Settings,
        smtpSettings: smtpSettingsToSave ?? DEFAULT_SETTINGS.smtpSettings,
        shortlinkDomain: validated.shortlinkDomain ?? DEFAULT_SETTINGS.shortlinkDomain,
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.tenantId,
        set: {
          ...(validated.serviceName !== undefined && { serviceName: validated.serviceName }),
          ...(validated.logoUrl !== undefined && { logoUrl: validated.logoUrl }),
          ...(validated.fiscalYearStartMonth !== undefined && {
            fiscalYearStartMonth: validated.fiscalYearStartMonth,
          }),
          ...(validated.timezone !== undefined && { timezone: validated.timezone }),
          ...(validated.baseUrl !== undefined && { baseUrl: validated.baseUrl }),
          ...(validated.s3Settings !== undefined && { s3Settings: s3SettingsToSave }),
          ...(validated.smtpSettings !== undefined && { smtpSettings: smtpSettingsToSave }),
          ...(validated.shortlinkDomain !== undefined && {
            shortlinkDomain: validated.shortlinkDomain,
          }),
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0];
  });

  if (!result) {
    throw new Error('Failed to update system settings');
  }

  // 4. Decrypt and return updated settings
  return getSystemSettings(tenantId);
}

/**
 * Check if S3 is configured
 *
 * Verifies that all required S3 settings are present.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns true if S3 is fully configured, false otherwise
 *
 * Example:
 * ```typescript
 * const configured = await isS3Configured('default');
 * if (!configured) {
 *   console.log('Please configure S3 settings first');
 * }
 * ```
 */
export async function isS3Configured(tenantId: string): Promise<boolean> {
  const settings = await getSystemSettings(tenantId);
  return settings.s3Settings !== null;
}

/**
 * Check if SMTP is configured
 *
 * Verifies that all required SMTP settings are present.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @returns true if SMTP is fully configured, false otherwise
 *
 * Example:
 * ```typescript
 * const configured = await isSmtpConfigured('default');
 * if (!configured) {
 *   console.log('Please configure SMTP settings first');
 * }
 * ```
 */
export async function isSmtpConfigured(tenantId: string): Promise<boolean> {
  const settings = await getSystemSettings(tenantId);
  return settings.smtpSettings !== null;
}

/**
 * Upload Logo to S3
 *
 * Uploads logo file to S3 and updates system settings with new logo URL.
 * Uses transaction to ensure atomicity - if DB update fails, S3 upload is rolled back.
 *
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param input - Upload parameters (buffer, contentType, filename)
 * @returns Updated SystemSettings with new logo URL
 * @throws {Error} If S3 not configured or upload/DB error occurs
 *
 * Implementation details:
 * 1. Check S3 configuration
 * 2. Upload to S3 with key format: `tenants/{tenantId}/logo-{timestamp}.{ext}`
 * 3. Update system settings with new logo URL in transaction
 * 4. If DB update fails, delete uploaded file from S3 (rollback)
 *
 * Example:
 * ```typescript
 * const buffer = await fs.readFile('logo.png');
 * const settings = await uploadLogo('default', {
 *   buffer,
 *   contentType: 'image/png',
 *   filename: 'logo.png',
 * });
 * console.log(settings.logoUrl); // "https://bucket.s3.region.amazonaws.com/tenants/default/logo-123456.png"
 * ```
 */
export async function uploadLogo(tenantId: string, input: UploadLogo): Promise<SystemSettings> {
  // 1. Validate input
  const validated = UploadLogoSchema.parse(input);

  // 2. Check S3 configuration
  const settings = await getSystemSettings(tenantId);
  if (!settings.s3Settings) {
    throw new Error('S3 settings not configured. Please configure S3 settings first.');
  }

  // 3. Generate S3 key with timestamp to avoid collisions
  const timestamp = Date.now();
  const ext = validated.filename.split('.').pop() || 'png';
  const s3Key = `tenants/${tenantId}/logo-${timestamp}.${ext}`;

  // 4. Upload to S3
  const s3Config = settings.s3Settings;
  let uploadedUrl: string;
  try {
    uploadedUrl = await uploadToS3(
      s3Config,
      s3Key,
      validated.buffer,
      validated.contentType
    );
  } catch (error) {
    throw new Error(
      `Failed to upload logo to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 5. Update system settings with new logo URL (with rollback on failure)
  try {
    const updated = await updateSystemSettings(tenantId, {
      logoUrl: uploadedUrl,
    });

    return updated;
  } catch (error) {
    // Rollback: Delete uploaded file from S3
    try {
      await deleteFromS3(s3Config, s3Key);
    } catch (deleteError) {
      // Log delete error but don't throw (original error is more important)
      console.error(
        `Failed to rollback S3 upload (key: ${s3Key}):`,
        deleteError instanceof Error ? deleteError.message : 'Unknown error'
      );
    }

    throw new Error(
      `Failed to update system settings after S3 upload: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
