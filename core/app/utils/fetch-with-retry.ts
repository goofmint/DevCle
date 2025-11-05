/**
 * Fetch with Retry
 *
 * Implements exponential backoff with jitter for retrying failed requests.
 * Automatically retries 500, 503 errors, and network failures.
 */

import { isRetriableError } from './api-errors';

const BASE_DELAY = 1000; // 1 second
const MAX_DELAY = 10000; // 10 seconds
const JITTER_FACTOR = 0.2; // ±20%
const MAX_RETRIES = 3;

/**
 * Calculate delay with exponential backoff and jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 *
 * Formula: min(BASE_DELAY * 2^attempt, MAX_DELAY) ± JITTER
 *
 * Example delays:
 * - Attempt 0: ~1000ms (800ms - 1200ms)
 * - Attempt 1: ~2000ms (1600ms - 2400ms)
 * - Attempt 2: ~4000ms (3200ms - 4800ms)
 */
function calculateDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    BASE_DELAY * Math.pow(2, attempt),
    MAX_DELAY
  );
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Fetch with automatic retry on retriable errors
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param onRetry - Callback when retrying (receives attempt number)
 * @returns Response
 * @throws Error if all retries exhausted
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = MAX_RETRIES,
  onRetry?: (attempt: number) => void
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Check if error is retriable
      if (isRetriableError(response.status)) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Success or non-retriable error
      return response;
    } catch (error) {
      lastError = error as Error;

      // Last attempt - give up
      if (attempt === maxRetries) {
        break;
      }

      // Notify caller about retry
      if (onRetry) {
        onRetry(attempt + 1);
      }

      // Wait before retrying
      const delay = calculateDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after retries');
}

/**
 * Fetch with timeout
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns Response
 * @throws Error if timeout exceeded
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

/**
 * Fetch with retry and timeout
 *
 * Combines retry logic with timeout handling.
 * Each retry attempt is individually bounded by the timeout.
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (applies to each attempt)
 * @param maxRetries - Maximum number of retries
 * @param onRetry - Callback when retrying
 * @returns Response
 */
export async function fetchWithRetryAndTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = 15000,
  maxRetries: number = MAX_RETRIES,
  onRetry?: (attempt: number) => void
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Apply timeout to each individual attempt
      const response = await fetchWithTimeout(url, options, timeoutMs);

      // Check if error is retriable
      if (isRetriableError(response.status)) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Success or non-retriable error
      return response;
    } catch (error) {
      lastError = error as Error;

      // Last attempt - give up
      if (attempt === maxRetries) {
        break;
      }

      // Notify caller about retry
      if (onRetry) {
        onRetry(attempt + 1);
      }

      // Wait before retrying
      const delay = calculateDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after retries');
}
