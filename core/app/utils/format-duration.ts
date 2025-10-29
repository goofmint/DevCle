/**
 * Format Duration Utility
 *
 * Formats a duration in milliseconds to a human-readable string.
 *
 * Examples:
 * - 1000ms -> "1s"
 * - 65000ms -> "1m 5s"
 * - 3665000ms -> "1h 1m"
 */

/**
 * Format duration from milliseconds to human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "1h 5m", "30s")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}
