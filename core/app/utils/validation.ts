/**
 * Validation Utilities
 *
 * Common validation functions for API request parameters.
 * Follows strict validation rules to prevent injection attacks and data corruption.
 */

/**
 * UUID validation regex
 *
 * Matches UUID v4 format: 8-4-4-4-12 hexadecimal characters.
 * Case-insensitive to allow both lowercase and uppercase UUIDs.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 *
 * Checks if the provided string is a valid UUID v4.
 *
 * @param value - Value to validate
 * @returns True if valid UUID, false otherwise
 *
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('invalid-uuid'); // false
 * isValidUUID(''); // false
 * ```
 */
export function isValidUUID(value: string | null | undefined): value is string {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value);
}

/**
 * Validate pagination limit
 *
 * Ensures limit is an integer between 1 and 100 (inclusive).
 * This prevents excessive data retrieval and potential DoS attacks.
 *
 * @param value - Value to validate (string or number)
 * @returns True if valid limit, false otherwise
 *
 * @example
 * ```typescript
 * isValidLimit(50); // true
 * isValidLimit('100'); // true
 * isValidLimit(0); // false
 * isValidLimit(101); // false
 * isValidLimit('invalid'); // false
 * ```
 */
export function isValidLimit(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Parse as integer
  const limit = typeof value === 'string' ? parseInt(value, 10) : value;

  // Check if parsing was successful (NaN check)
  if (Number.isNaN(limit)) {
    return false;
  }

  // Check range: 1 <= limit <= 100
  return Number.isInteger(limit) && limit >= 1 && limit <= 100;
}

/**
 * Validate pagination offset
 *
 * Ensures offset is an integer >= 0.
 *
 * @param value - Value to validate (string or number)
 * @returns True if valid offset, false otherwise
 *
 * @example
 * ```typescript
 * isValidOffset(0); // true
 * isValidOffset('50'); // true
 * isValidOffset(-1); // false
 * isValidOffset('invalid'); // false
 * ```
 */
export function isValidOffset(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Parse as integer
  const offset = typeof value === 'string' ? parseInt(value, 10) : value;

  // Check if parsing was successful (NaN check)
  if (Number.isNaN(offset)) {
    return false;
  }

  // Check range: offset >= 0
  return Number.isInteger(offset) && offset >= 0;
}

/**
 * Validate plugin run status
 *
 * Ensures status is one of the allowed values.
 *
 * @param value - Value to validate
 * @returns True if valid status, false otherwise
 *
 * @example
 * ```typescript
 * isValidStatus('running'); // true
 * isValidStatus('success'); // true
 * isValidStatus('invalid'); // false
 * ```
 */
export function isValidStatus(value: string | null | undefined): value is 'running' | 'success' | 'failed' {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return value === 'running' || value === 'success' || value === 'failed';
}

/**
 * Parse and validate limit with default
 *
 * Parses limit from URL search params and returns a validated value.
 * Falls back to default if invalid or missing.
 *
 * @param searchParams - URL search params
 * @param defaultValue - Default value (must be between 1 and 100)
 * @returns Validated limit value
 *
 * @example
 * ```typescript
 * const url = new URL('http://example.com?limit=25');
 * parseLimit(url.searchParams, 50); // 25
 *
 * const url2 = new URL('http://example.com?limit=invalid');
 * parseLimit(url2.searchParams, 50); // 50
 * ```
 */
export function parseLimit(searchParams: URLSearchParams, defaultValue: number = 50): number {
  const limitParam = searchParams.get('limit');
  if (!limitParam) {
    return defaultValue;
  }

  const limit = parseInt(limitParam, 10);
  return isValidLimit(limit) ? limit : defaultValue;
}

/**
 * Parse and validate offset with default
 *
 * Parses offset from URL search params and returns a validated value.
 * Falls back to default if invalid or missing.
 *
 * @param searchParams - URL search params
 * @param defaultValue - Default value (must be >= 0)
 * @returns Validated offset value
 *
 * @example
 * ```typescript
 * const url = new URL('http://example.com?offset=100');
 * parseOffset(url.searchParams, 0); // 100
 *
 * const url2 = new URL('http://example.com?offset=invalid');
 * parseOffset(url2.searchParams, 0); // 0
 * ```
 */
export function parseOffset(searchParams: URLSearchParams, defaultValue: number = 0): number {
  const offsetParam = searchParams.get('offset');
  if (!offsetParam) {
    return defaultValue;
  }

  const offset = parseInt(offsetParam, 10);
  return isValidOffset(offset) ? offset : defaultValue;
}
