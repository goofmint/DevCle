/**
 * Plugin Configuration Encryption
 *
 * Encrypts and decrypts sensitive plugin configuration fields.
 * Uses AES-256-GCM encryption from core/utils/encryption.ts.
 *
 * Key Features:
 * - Selective encryption (only fields marked as 'secret')
 * - Automatic serialization of complex types
 * - Null/undefined/empty string handling
 * - Support for _exists marker pattern (for UI)
 */

import { encrypt, decrypt } from '../utils/encryption.js';
import type { PluginConfigSchema, PluginConfigField } from './config-validator.js';

/**
 * Marker object used to indicate that a secret field exists
 * without exposing its actual value to the client.
 *
 * This is used in the Loader to return { _exists: true }
 * instead of the decrypted secret value for security.
 */
export interface SecretExistsMarker {
  _exists: true;
}

/**
 * Check if a field is a secret field that requires encryption
 *
 * @param field - Field definition
 * @returns true if field should be encrypted
 */
export function isSecretField(field: PluginConfigField): boolean {
  return field.type === 'secret';
}

/**
 * Check if a value is a secret exists marker
 *
 * @param value - Value to check
 * @returns true if value is { _exists: true }
 */
export function isSecretExistsMarker(value: unknown): value is SecretExistsMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_exists' in value &&
    value._exists === true
  );
}

/**
 * Encrypt plugin configuration
 *
 * Encrypts fields marked as type='secret' in the schema.
 * Non-secret fields are preserved as-is.
 *
 * Serialization rules:
 * - Primitive values (string, number, boolean): String() conversion
 * - Objects/Arrays: JSON.stringify() serialization
 * - null/undefined: Skip (don't encrypt, preserve as-is)
 * - Empty strings: Skip (don't encrypt, preserve as-is)
 * - Secret exists markers ({ _exists: true }): Skip (preserve existing encrypted value)
 *
 * @param schema - Plugin configuration schema (PluginConfigSchema)
 * @param config - Configuration values to encrypt
 * @param existingConfig - Existing encrypted configuration (for preserving secrets with markers)
 * @returns Configuration with secret fields encrypted
 * @throws Error if schema is invalid
 * @throws Error if encryption fails (see core/utils/encryption.ts)
 */
export async function encryptPluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>,
  existingConfig?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Validate schema structure
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error('Invalid schema: fields must be an array');
  }

  const encrypted: Record<string, unknown> = { ...config };

  // Process each field in schema
  for (const field of schema.fields) {
    // Only encrypt secret fields
    if (!isSecretField(field)) {
      continue;
    }

    const value = config[field.name];

    // If value is a secret exists marker, preserve the existing encrypted value
    if (isSecretExistsMarker(value)) {
      if (existingConfig && existingConfig[field.name] !== undefined) {
        encrypted[field.name] = existingConfig[field.name];
      }
      continue;
    }

    // Skip null/undefined/empty strings (don't encrypt)
    if (value === null || value === undefined || value === '') {
      encrypted[field.name] = value;
      continue;
    }

    // Serialize value to string based on type
    let plaintext: string;
    if (typeof value === 'string') {
      plaintext = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      plaintext = String(value);
    } else if (typeof value === 'object') {
      // Objects and arrays: JSON.stringify()
      try {
        plaintext = JSON.stringify(value);
      } catch (error) {
        throw new Error(
          `Failed to serialize field ${field.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Fallback for other types (should not happen with proper validation)
      plaintext = String(value);
    }

    // Skip empty strings after serialization
    if (plaintext === '') {
      encrypted[field.name] = '';
      continue;
    }

    // Encrypt the plaintext
    try {
      encrypted[field.name] = encrypt(plaintext);
    } catch (error) {
      throw new Error(
        `Failed to encrypt field ${field.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return encrypted;
}

/**
 * Decrypt plugin configuration
 *
 * Decrypts fields marked as type='secret' in the schema.
 * Non-secret fields are preserved as-is.
 *
 * @param schema - Plugin configuration schema (PluginConfigSchema)
 * @param config - Configuration values to decrypt
 * @returns Configuration with secret fields decrypted
 * @throws Error if schema is invalid
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 * @throws Error if ciphertext format is invalid
 */
export async function decryptPluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // Validate schema structure
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error('Invalid schema: fields must be an array');
  }

  const decrypted: Record<string, unknown> = { ...config };

  // Process each field in schema
  for (const field of schema.fields) {
    // Only decrypt secret fields
    if (!isSecretField(field)) {
      continue;
    }

    const value = config[field.name];

    // Skip null/undefined/empty strings
    if (value === null || value === undefined || value === '') {
      continue;
    }

    // Value must be a string for decryption
    if (typeof value !== 'string') {
      throw new Error(
        `Cannot decrypt field ${field.name}: value must be a string, got ${typeof value}`
      );
    }

    // Decrypt the value
    try {
      decrypted[field.name] = decrypt(value);
    } catch (error) {
      throw new Error(
        `Failed to decrypt field ${field.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return decrypted;
}

/**
 * Create secret exists markers for all secret fields
 *
 * Used in Loader to return { _exists: true } for secret fields
 * instead of exposing decrypted values to the client.
 *
 * @param schema - Plugin configuration schema
 * @param config - Configuration values (encrypted)
 * @returns Configuration with secret fields replaced by { _exists: true } markers
 */
export function createSecretExistsMarkers(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): Record<string, unknown> {
  const marked: Record<string, unknown> = { ...config };

  // Process each field in schema
  for (const field of schema.fields) {
    // Only mark secret fields
    if (!isSecretField(field)) {
      continue;
    }

    const value = config[field.name];

    // If value exists (not null/undefined/empty), replace with marker
    if (value !== null && value !== undefined && value !== '') {
      marked[field.name] = { _exists: true };
    }
  }

  return marked;
}
