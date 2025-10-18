/**
 * System Settings Service
 *
 * Manages system-wide settings including basic config, SMTP, AI, and S3 settings.
 * All sensitive fields (passwords, API keys) are encrypted before storage.
 *
 * Key features:
 * - Tenant-scoped settings (one row per tenant)
 * - Automatic encryption of sensitive fields
 * - Partial updates supported
 * - RLS-compliant (uses withTenantContext)
 */

import { eq } from 'drizzle-orm';
import { withTenantContext } from '../db/connection.js';
import { systemSettings } from '../db/schema/admin.js';
import { encrypt, decrypt, isEncrypted } from '../app/lib/crypto.server.js';
import type { UpdateSystemSettingsInput } from './system-settings.schemas.js';

export interface SystemSettings {
  tenantId: string;
  baseUrl: string | null;
  shortlinkDomain: string | null;
  // Basic settings
  serviceName: string | null;
  logoUrl: string | null;
  fiscalYearStart: string | null;
  fiscalYearEnd: string | null;
  timezone: string | null;
  // SMTP settings
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null; // DECRYPTED for return
  // AI settings
  aiProvider: string | null;
  aiApiKey: string | null; // DECRYPTED for return
  aiModel: string | null;
  // S3 settings
  s3Bucket: string | null;
  s3Region: string | null;
  s3AccessKeyId: string | null; // DECRYPTED for return
  s3SecretAccessKey: string | null; // DECRYPTED for return
  s3Endpoint: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Decrypt sensitive fields from database row
 * Returns decrypted values for client consumption
 */
function decryptSensitiveFields(row: typeof systemSettings.$inferSelect): SystemSettings {
  return {
    tenantId: row.tenantId,
    baseUrl: row.baseUrl,
    shortlinkDomain: row.shortlinkDomain,
    serviceName: row.serviceName,
    logoUrl: row.logoUrl,
    fiscalYearStart: row.fiscalYearStart,
    fiscalYearEnd: row.fiscalYearEnd,
    timezone: row.timezone,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUsername: row.smtpUsername,
    smtpPassword: row.smtpPassword && isEncrypted(row.smtpPassword)
      ? decrypt(row.smtpPassword)
      : row.smtpPassword,
    aiProvider: row.aiProvider,
    aiApiKey: row.aiApiKey && isEncrypted(row.aiApiKey)
      ? decrypt(row.aiApiKey)
      : row.aiApiKey,
    aiModel: row.aiModel,
    s3Bucket: row.s3Bucket,
    s3Region: row.s3Region,
    s3AccessKeyId: row.s3AccessKeyId && isEncrypted(row.s3AccessKeyId)
      ? decrypt(row.s3AccessKeyId)
      : row.s3AccessKeyId,
    s3SecretAccessKey: row.s3SecretAccessKey && isEncrypted(row.s3SecretAccessKey)
      ? decrypt(row.s3SecretAccessKey)
      : row.s3SecretAccessKey,
    s3Endpoint: row.s3Endpoint,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Encrypt sensitive fields before database storage
 * Only encrypts if value is provided and not already encrypted
 */
function encryptSensitiveFields(input: UpdateSystemSettingsInput): Partial<typeof systemSettings.$inferInsert> {
  const encrypted: Partial<typeof systemSettings.$inferInsert> = {
    ...input,
  };

  // Encrypt SMTP password
  if (input.smtpPassword && !isEncrypted(input.smtpPassword)) {
    encrypted.smtpPassword = encrypt(input.smtpPassword);
  }

  // Encrypt AI API key
  if (input.aiApiKey && !isEncrypted(input.aiApiKey)) {
    encrypted.aiApiKey = encrypt(input.aiApiKey);
  }

  // Encrypt S3 access key ID (recommended)
  if (input.s3AccessKeyId && !isEncrypted(input.s3AccessKeyId)) {
    encrypted.s3AccessKeyId = encrypt(input.s3AccessKeyId);
  }

  // Encrypt S3 secret access key (required)
  if (input.s3SecretAccessKey && !isEncrypted(input.s3SecretAccessKey)) {
    encrypted.s3SecretAccessKey = encrypt(input.s3SecretAccessKey);
  }

  return encrypted;
}

/**
 * Get system settings for a tenant
 * Returns decrypted settings or null if not found
 */
export async function getSystemSettings(tenantId: string): Promise<SystemSettings | null> {
  return await withTenantContext(tenantId, async (tx) => {
    const [row] = await tx
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.tenantId, tenantId))
      .limit(1);

    if (!row) {
      return null;
    }

    return decryptSensitiveFields(row);
  });
}

/**
 * Update system settings (partial update)
 * Creates settings row if it doesn't exist (UPSERT)
 * Encrypts sensitive fields before storage
 */
export async function updateSystemSettings(
  tenantId: string,
  input: UpdateSystemSettingsInput,
): Promise<SystemSettings> {
  return await withTenantContext(tenantId, async (tx) => {
    const encrypted = encryptSensitiveFields(input);

    // UPSERT: Insert or update
    const rows = await tx
      .insert(systemSettings)
      .values({
        tenantId,
        ...encrypted,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.tenantId,
        set: {
          ...encrypted,
          updatedAt: new Date(),
        },
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to update system settings');
    }

    return decryptSensitiveFields(row);
  });
}

/**
 * Create initial system settings for a new tenant
 * Used during tenant creation
 */
export async function createSystemSettings(tenantId: string): Promise<SystemSettings> {
  return await withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .insert(systemSettings)
      .values({
        tenantId,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to create system settings');
    }

    return decryptSensitiveFields(row);
  });
}
