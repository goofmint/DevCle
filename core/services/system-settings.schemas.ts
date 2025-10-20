/**
 * System Settings Service - Zod Schemas
 *
 * Type definitions and validation schemas for system settings management.
 *
 * Note: AI settings removed from OSS version (moved to commercial plugins).
 */

import { z } from 'zod';

/**
 * S3 Settings Schema
 *
 * Validates S3 connection configuration for file uploads (logo, attachments, etc.)
 *
 * Fields:
 * - bucket: S3 bucket name (required)
 * - region: AWS region (e.g., "us-east-1") or S3-compatible region (required)
 * - accessKeyId: AWS access key ID (required)
 * - secretAccessKey: AWS secret access key (required, encrypted before DB save)
 * - endpoint: Custom endpoint for S3-compatible services like MinIO (optional)
 *
 * Example:
 * ```typescript
 * {
 *   bucket: 'devcle-uploads',
 *   region: 'ap-northeast-1',
 *   accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
 *   secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
 *   endpoint: 'https://minio.example.com'
 * }
 * ```
 */
export const S3SettingsSchema = z.object({
  bucket: z.string().min(1).max(255),
  region: z.string().min(1).max(100),
  accessKeyId: z.string().min(1).max(255),
  secretAccessKey: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (val) => {
        // Forbid client-submitted strings that match encrypted envelope pattern (v*:*:*:*)
        // This prevents callers from bypassing encryption by passing pseudo-ciphertext
        const encryptedPattern = /^v[^:]*:[^:]*:[^:]*:[^:]*$/;
        return !encryptedPattern.test(val);
      },
      { message: 'secretAccessKey must be plaintext, not encrypted format' }
    ),
  endpoint: z.string().url().optional(),
});

/**
 * S3 Settings Type
 *
 * Manually defined to work with exactOptionalPropertyTypes.
 * The `endpoint` property is truly optional (not `string | undefined`).
 */
export interface S3Settings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

/**
 * SMTP Settings Schema
 *
 * Validates SMTP connection configuration for email notifications.
 *
 * Fields:
 * - host: SMTP server hostname (required)
 * - port: SMTP server port (1-65535, typically 25/587/465)
 * - secure: Use TLS/SSL (true for port 465, false for 587 with STARTTLS)
 * - user: SMTP authentication username (required)
 * - password: SMTP authentication password (required, encrypted before DB save)
 * - from: Default sender email address (required, must be valid email format)
 *
 * Example:
 * ```typescript
 * {
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   secure: false,
 *   user: 'noreply@example.com',
 *   password: 'app-specific-password',
 *   from: 'DevCle <noreply@example.com>'
 * }
 * ```
 */
export const SmtpSettingsSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().min(1).max(255),
  password: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (val) => {
        // Forbid client-submitted strings that match encrypted envelope pattern (v*:*:*:*)
        // This prevents callers from bypassing encryption by passing pseudo-ciphertext
        const encryptedPattern = /^v[^:]*:[^:]*:[^:]*:[^:]*$/;
        return !encryptedPattern.test(val);
      },
      { message: 'password must be plaintext, not encrypted format' }
    ),
  from: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (val) => {
        // Accept both "email@example.com" and "Name <email@example.com>" formats
        const emailOnlyPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const nameEmailPattern = /^.+\s<[^\s@]+@[^\s@]+\.[^\s@]+>$/;
        return emailOnlyPattern.test(val) || nameEmailPattern.test(val);
      },
      { message: 'Must be a valid email or "Name <email>" format' }
    ),
});

export type SmtpSettings = z.infer<typeof SmtpSettingsSchema>;

/**
 * Update System Settings Schema
 *
 * Input validation for updateSystemSettings() function.
 *
 * Fields:
 * - serviceName: Tenant-specific service name (1-100 chars, default: 'DevCle')
 * - logoUrl: Logo image URL (S3 or external URL, null to remove)
 * - fiscalYearStartMonth: Fiscal year start month (1-12, default: 4 for April)
 * - timezone: IANA timezone (default: 'Asia/Tokyo')
 * - baseUrl: Base URL for this tenant's deployment (null if not set)
 * - s3Settings: S3 connection configuration (null to remove)
 * - smtpSettings: SMTP connection configuration (null to remove)
 * - shortlinkDomain: Custom domain for shortlinks (e.g., "go.example.com", null if not set)
 *
 * Note: All fields are optional. Only provided fields will be updated.
 * Sensitive fields (s3Settings.secretAccessKey, smtpSettings.password) are
 * automatically encrypted before database save.
 *
 * Example:
 * ```typescript
 * {
 *   serviceName: 'My DevRel Tool',
 *   fiscalYearStartMonth: 1,
 *   timezone: 'America/New_York',
 *   s3Settings: {
 *     bucket: 'my-bucket',
 *     region: 'us-east-1',
 *     accessKeyId: 'AKIA...',
 *     secretAccessKey: 'secret...',
 *   }
 * }
 * ```
 */
export const UpdateSystemSettingsSchema = z.object({
  serviceName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().max(2048).nullable().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  timezone: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().max(2048).nullable().optional(),
  s3Settings: S3SettingsSchema.nullable().optional(),
  smtpSettings: SmtpSettingsSchema.nullable().optional(),
  shortlinkDomain: z.string().max(255).nullable().optional(),
});

export type UpdateSystemSettings = z.infer<typeof UpdateSystemSettingsSchema>;

/**
 * System Settings Result
 *
 * Return type for getSystemSettings() and updateSystemSettings().
 *
 * Fields:
 * - tenantId: Tenant ID (primary key)
 * - serviceName: Tenant-specific service name
 * - logoUrl: Logo image URL (null if not set)
 * - fiscalYearStartMonth: Fiscal year start month (1-12)
 * - timezone: IANA timezone
 * - baseUrl: Base URL for this tenant's deployment (null if not set)
 * - s3Settings: S3 connection configuration (null if not set, secretAccessKey decrypted)
 * - smtpSettings: SMTP connection configuration (null if not set, password decrypted)
 * - shortlinkDomain: Custom domain for shortlinks (null if not set)
 * - createdAt: Creation timestamp
 * - updatedAt: Last updated timestamp
 *
 * Note: Sensitive fields are automatically decrypted on read.
 */
export interface SystemSettings {
  tenantId: string;
  serviceName: string;
  logoUrl: string | null;
  fiscalYearStartMonth: number;
  timezone: string;
  baseUrl: string | null;
  s3Settings: S3Settings | null;
  smtpSettings: SmtpSettings | null;
  shortlinkDomain: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upload Logo Schema
 *
 * Input validation for uploadLogo() function.
 *
 * Fields:
 * - buffer: File buffer (1 byte to 5MB)
 * - contentType: MIME type (only raster images: PNG, JPEG, WebP)
 * - filename: Original filename (used for S3 key generation)
 *
 * Security Note:
 * SVG (image/svg+xml) is explicitly excluded because SVGs can contain:
 * - JavaScript code (via <script> tags or event handlers)
 * - External resource references (potential data exfiltration)
 * - CSS injection vectors
 * Only raster image formats (PNG, JPEG, WebP) are allowed.
 *
 * Example:
 * ```typescript
 * {
 *   buffer: Buffer.from(...),
 *   contentType: 'image/png',
 *   filename: 'logo.png'
 * }
 * ```
 */
export const UploadLogoSchema = z.object({
  buffer: z.instanceof(Buffer).refine((buf) => buf.length > 0 && buf.length <= 5 * 1024 * 1024, {
    message: 'File size must be between 1 byte and 5MB',
  }),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  filename: z.string().min(1).max(255),
});

export type UploadLogo = z.infer<typeof UploadLogoSchema>;
