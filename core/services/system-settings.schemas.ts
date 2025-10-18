/**
 * System Settings Validation Schemas
 *
 * SCHEMA-LEVEL VALIDATION
 *
 * These Zod schemas validate REQUEST SHAPE only:
 * - logoUrl: Valid URL format OR starts with "data:image/" prefix
 *   (does NOT validate file size, MIME type, or data-URI payload)
 * - timezone: IANA timezone via Intl.supportedValuesOf('timeZone')
 * - fiscalYearStart/End: MM-DD format with month 01-12, day 01-31
 * - smtpPort: Integer 1-65535
 * - aiProvider: Enum whitelist (openai, anthropic, google)
 * - s3Endpoint: Valid URL format
 *
 * HANDLER-LEVEL VALIDATION (see API Routes):
 * - Content-Length check (reject >2MB)
 * - MIME whitelist (image/png, image/jpeg, image/svg+xml)
 * - XSS sanitization for non-data URIs
 * - CSRF token enforcement (Remix)
 */

import { z } from 'zod';

/**
 * Helper: Validate MM-DD format with month/day range checks
 * Accepts: "01-01" to "12-31"
 * Rejects: "13-01", "02-31", etc.
 */
const mmddValidator = z.string().refine((val) => {
  const parts = val.split('-');
  if (parts.length !== 2) return false;
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}, {
  message: 'Invalid MM-DD format (month 01-12, day 01-31)',
});

/**
 * Helper: Validate IANA timezone using Intl API
 * Accepts: "Asia/Tokyo", "America/New_York", etc.
 * Rejects: "JST", "Tokyo", invalid timezones
 */
const validTimezones = Intl.supportedValuesOf('timeZone');
const timezoneValidator = z.string().refine((val) => validTimezones.includes(val), {
  message: 'Invalid IANA timezone',
});

/**
 * Update System Settings Input Schema
 *
 * All fields are optional to support partial updates.
 * Schema-level validation only checks format/shape, not content security.
 */
export const UpdateSystemSettingsSchema = z.object({
  // Basic settings
  serviceName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().or(z.string().startsWith('data:image/')).optional(),
  fiscalYearStart: mmddValidator.optional(),
  fiscalYearEnd: mmddValidator.optional(),
  timezone: timezoneValidator.optional(),
  // SMTP settings
  smtpHost: z.string().min(1, 'SMTP host is required').optional(),
  smtpPort: z.number().int().min(1).max(65535, 'Invalid port number').optional(),
  smtpUsername: z.string().min(1, 'SMTP username is required').optional(),
  smtpPassword: z.string().min(1, 'SMTP password is required').optional(),
  // AI settings
  aiProvider: z.enum(['openai', 'anthropic', 'google'], { message: 'Invalid AI provider' }).optional(),
  aiApiKey: z.string().min(1, 'AI API key is required').optional(),
  aiModel: z.string().min(1, 'AI model is required').optional(),
  // S3 settings
  s3Bucket: z.string().min(1, 'Bucket name is required').optional(),
  s3Region: z.string().min(1, 'Region is required').optional(),
  s3AccessKeyId: z.string().min(1, 'Access Key ID is required').optional(),
  s3SecretAccessKey: z.string().min(1, 'Secret Access Key is required').optional(),
  s3Endpoint: z.string().url('Invalid endpoint URL').optional(),
});

export type UpdateSystemSettingsInput = z.infer<typeof UpdateSystemSettingsSchema>;
