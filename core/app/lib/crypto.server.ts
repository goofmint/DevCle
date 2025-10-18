/**
 * Encryption Utility
 *
 * Provides AES-256-GCM encryption/decryption for sensitive data.
 * Used for encrypting passwords, API keys, and other secrets before storing in database.
 *
 * IMPORTANT: ENCRYPTION_KEY environment variable must be set to a secure random key.
 * Generate with: `openssl rand -hex 32`
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for GCM
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Get encryption key from environment variable
 * Throws if ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey(): Buffer {
  const key = process.env['ENCRYPTION_KEY'];

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
  }

  return keyBuffer;
}

/**
 * Encrypt a string value using AES-256-GCM
 *
 * @param plaintext - The value to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex-encoded)
 * @throws Error if encryption fails or ENCRYPTION_KEY is invalid
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty value');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
}

/**
 * Decrypt a string value using AES-256-GCM
 *
 * @param encrypted - Encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails or format is invalid
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) {
    throw new Error('Cannot decrypt empty value');
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format (expected iv:authTag:ciphertext)');
  }

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const ciphertext = parts[2];

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted value format (missing parts)');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Check if a string is encrypted (has the correct format)
 *
 * @param value - String to check
 * @returns true if value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3;
}
