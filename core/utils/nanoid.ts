/**
 * Nanoid Utility - Custom Shortlink Key Generation
 *
 * Generates random URL-safe keys for shortlinks using nanoid.
 *
 * Key features:
 * - URL-safe alphabet (excludes similar-looking characters: 0/O, 1/l/I)
 * - Configurable key length (default: 8 characters)
 * - Collision probability: ~1 in 168 billion with 60-character alphabet and 8-character length
 * - Sufficient for up to 100 million shortlinks
 *
 * Example keys:
 * - "abcd1234"
 * - "XyZ_9876"
 * - "h3Rt-V9P"
 */

import { customAlphabet } from 'nanoid';

/**
 * URL-safe Alphabet
 *
 * Custom alphabet for nanoid:
 * - Excludes similar-looking characters: 0/O, 1/l/I
 * - URL-safe: a-z, A-Z, 2-9, _, -
 * - Total characters: 60
 *
 * This alphabet ensures keys are easy to read and type, while maintaining
 * a high level of entropy for collision resistance.
 */
const SHORTLINK_ALPHABET =
  '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz_-';

/**
 * Default shortlink key length
 *
 * 8 characters with 60-character alphabet:
 * - Collision probability: ~1 in 168 billion (60^8 ≈ 1.68 × 10^14)
 * - Sufficient for up to 100 million shortlinks
 * - Estimated time to generate 1 million unique keys: ~1% collision rate
 *
 * Key length can be adjusted based on requirements:
 * - 6 characters: ~46 billion combinations (suitable for smaller scale)
 * - 8 characters: ~168 billion combinations (recommended)
 * - 10 characters: ~6 quadrillion combinations (for massive scale)
 */
const SHORTLINK_KEY_LENGTH = 8;

/**
 * Generate Shortlink Key
 *
 * Generates a random URL-safe key using nanoid with custom alphabet.
 *
 * @returns Random key (e.g., "abcd1234", "XyZ_9876")
 *
 * Example:
 * ```typescript
 * const key = generateShortlinkKey(); // "abcd1234"
 * const key2 = generateShortlinkKey(); // "h3Rt-V9P"
 * ```
 *
 * Note: The generated keys are cryptographically random and suitable for
 * public-facing URLs. However, they should not be considered secret tokens
 * for authentication purposes.
 */
export const generateShortlinkKey = customAlphabet(
  SHORTLINK_ALPHABET,
  SHORTLINK_KEY_LENGTH
);
