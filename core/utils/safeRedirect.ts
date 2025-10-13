/**
 * Safe Redirect Helper
 *
 * Validates redirect targets to prevent open redirect vulnerabilities.
 *
 * Security checks:
 * - Rejects absolute URLs (http://, https://)
 * - Rejects protocol-relative URLs (//)
 * - Only allows relative paths starting with /
 * - Returns default redirect on invalid input
 */

/**
 * Validates and sanitizes redirect target
 *
 * @param to - Redirect target from user input (query param, form data, etc.)
 * @param defaultRedirect - Default redirect path if validation fails
 * @returns Safe redirect path (relative URL starting with /)
 *
 * @example
 * ```ts
 * // Valid same-origin paths
 * safeRedirect('/dashboard') // => '/dashboard'
 * safeRedirect('/users/123') // => '/users/123'
 *
 * // Invalid inputs (returns default)
 * safeRedirect('https://evil.com', '/') // => '/'
 * safeRedirect('//evil.com', '/') // => '/'
 * safeRedirect(null, '/dashboard') // => '/dashboard'
 * ```
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect = '/'
): string {
  // Reject non-string values
  if (!to || typeof to !== 'string') {
    return defaultRedirect;
  }

  // Reject absolute URLs (protocol-relative or with protocol)
  // Valid: /dashboard, /users/123
  // Invalid: //evil.com, http://evil.com, https://evil.com
  if (!to.startsWith('/') || to.startsWith('//')) {
    return defaultRedirect;
  }

  return to;
}
