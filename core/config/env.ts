/**
 * Environment Variable Validation
 *
 * Validates critical environment variables at application startup.
 * Implements fail-fast pattern to prevent running with invalid configuration.
 */

/**
 * Validate ENCRYPTION_KEY at application startup
 *
 * Checks:
 * 1. Environment variable exists
 * 2. Value is valid base64 string
 * 3. Decoded value is exactly 32 bytes (256 bits for AES-256-GCM)
 *
 * @throws Process exits with code 1 if validation fails (fail-fast)
 */
export function validateEncryptionKey(): void {
  const key = process.env['ENCRYPTION_KEY'];

  // Check 1: Environment variable exists
  if (!key) {
    console.error('❌ FATAL: ENCRYPTION_KEY is not set in environment variables.');
    console.error('💡 Generate a key with: openssl rand -base64 32');
    console.error('💡 Add it to your .env file: ENCRYPTION_KEY=<generated-key>');
    process.exit(1);
  }

  // Check 2: Valid base64 string
  let decoded: Buffer;
  try {
    decoded = Buffer.from(key, 'base64');
  } catch (error) {
    console.error('❌ FATAL: ENCRYPTION_KEY is not valid base64.');
    console.error('💡 Generate a key with: openssl rand -base64 32');
    process.exit(1);
  }

  // Check 3: Exactly 32 bytes (256 bits)
  if (decoded.length !== 32) {
    console.error(
      `❌ FATAL: ENCRYPTION_KEY must be exactly 32 bytes (256 bits), got ${decoded.length} bytes.`
    );
    console.error('💡 Generate a key with: openssl rand -base64 32');
    process.exit(1);
  }

  console.log('✅ ENCRYPTION_KEY validated successfully (32 bytes)');
}

/**
 * Validate all critical environment variables at startup
 *
 * Call this function at the top of your server entry point
 * before starting the application.
 */
export function validateEnvironment(): void {
  validateEncryptionKey();
  // Add more environment variable validations here as needed
}
