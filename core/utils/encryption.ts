/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for sensitive data.
 * Uses environment variable ENCRYPTION_KEY (must be 32 bytes, base64-encoded).
 *
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Random IV (initialization vector) for each encryption
 * - Base64-encoded output for database storage
 * - Key versioning support for rotation
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const CURRENT_KEY_VERSION = 'v1' as const;

/**
 * Get encryption key from environment variable
 *
 * @param version - Key version (default: 'v1')
 * @returns Encryption key buffer
 * @throws Error if key is not found or invalid
 */
function getEncryptionKey(version: string = CURRENT_KEY_VERSION): Buffer {
  const envVarName = version === 'v1' ? 'ENCRYPTION_KEY' : `ENCRYPTION_KEY_${version.toUpperCase()}`;
  const key = process.env[envVarName];

  if (!key) {
    throw new Error(`Encryption key ${envVarName} not found in environment variables`);
  }

  try {
    const decoded = Buffer.from(key, 'base64');
    if (decoded.length !== 32) {
      throw new Error(`Invalid key length: expected 32 bytes, got ${decoded.length}`);
    }
    return decoded;
  } catch (error) {
    throw new Error(
      `Failed to decode encryption key ${envVarName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * Output format: "version:iv:authTag:ciphertext" (all base64-encoded)
 * Example: "v1:abc123...:def456...:ghi789..."
 *
 * @param plaintext - Data to encrypt
 * @param version - Key version to use (default: 'v1')
 * @returns Base64-encoded encrypted string with version prefix
 */
export function encrypt(plaintext: string, version: string = CURRENT_KEY_VERSION): string {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  const key = getEncryptionKey(version);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: "version:iv:authTag:ciphertext"
  const result = [
    version,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted,
  ].join(':');

  return result;
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * Automatically detects key version from ciphertext prefix.
 * Supports legacy data encrypted with older keys.
 *
 * @param ciphertext - Base64-encoded encrypted string with version prefix
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    throw new Error('Ciphertext cannot be empty');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error(
      `Invalid ciphertext format: expected 4 parts (version:iv:authTag:encrypted), got ${parts.length}`
    );
  }

  const version = parts[0];
  const ivBase64 = parts[1];
  const authTagBase64 = parts[2];
  const encrypted = parts[3];

  if (!version || !ivBase64 || !authTagBase64 || !encrypted) {
    throw new Error('Invalid ciphertext format: one or more parts are empty');
  }

  const key = getEncryptionKey(version);
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a string is encrypted (has version prefix)
 *
 * @param value - String to check
 * @returns true if value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) {
    return false;
  }

  const parts = value.split(':');
  return parts.length === 4 && (parts[0]?.startsWith('v') ?? false);
}

/**
 * Safely encrypt a value only if it's not already encrypted
 *
 * Useful for idempotent operations where you don't know
 * if the value is already encrypted.
 *
 * @param value - Value to encrypt (if not already encrypted)
 * @returns Encrypted value
 */
export function encryptIfNeeded(value: string): string {
  if (isEncrypted(value)) {
    return value;
  }
  return encrypt(value);
}

/**
 * Rotate encryption key for a ciphertext
 *
 * Decrypts data with old key and re-encrypts with new key.
 * Useful for gradual key rotation.
 *
 * @param ciphertext - Data encrypted with old key
 * @param newVersion - New key version to use
 * @returns Data re-encrypted with new key
 */
export function rotateKey(ciphertext: string, newVersion: string): string {
  const plaintext = decrypt(ciphertext);
  return encrypt(plaintext, newVersion);
}
