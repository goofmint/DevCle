/**
 * API Error Messages
 *
 * Centralized error messages for consistent user feedback across the application.
 * All messages are in English as per project requirements.
 */

export const ERROR_MESSAGES = {
  400: 'Invalid request parameters. Please check your filters.',
  401: 'Authentication required. Redirecting to login...',
  403: 'Access denied. You do not have permission for this action.',
  404: 'Resource not found. The event may have been deleted.',
  429: 'Rate limit exceeded. Please wait before retrying.',
  500: 'Server error occurred. Please try again later.',
  503: 'Service temporarily unavailable. Please try again in a few minutes.',
  TIMEOUT: 'Request timed out. Check your connection and try again.',
  NETWORK: 'Network error. Please check your internet connection.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
} as const;

/**
 * Get error message by status code
 */
export function getErrorMessage(statusCode: number): string {
  if (statusCode in ERROR_MESSAGES) {
    return ERROR_MESSAGES[statusCode as keyof typeof ERROR_MESSAGES];
  }
  return ERROR_MESSAGES.UNKNOWN;
}

/**
 * Check if error is retriable (500, 503, timeout, network failure)
 */
export function isRetriableError(statusCode: number): boolean {
  return statusCode === 500 || statusCode === 503;
}
