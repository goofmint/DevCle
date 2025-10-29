/**
 * Detail Row Component
 *
 * Displays a key-value pair in a modal or detail view.
 * Supports monospace formatting for IDs and error highlighting.
 */

import type { ReactNode } from 'react';

/**
 * Detail Row Props
 */
interface DetailRowProps {
  /** Row label */
  label: string;
  /** Row value (can be a React node) */
  value: ReactNode;
  /** Whether to use monospace font (for IDs, etc.) */
  mono?: boolean;
  /** Whether to highlight as an error */
  error?: boolean;
}

/**
 * Detail Row Component
 *
 * Renders a labeled row with optional monospace or error styling.
 * Used in modal dialogs to display structured information.
 *
 * @param label - Row label
 * @param value - Row value (can be a React node)
 * @param mono - Whether to use monospace font (default: false)
 * @param error - Whether to highlight as an error (default: false)
 */
export function DetailRow({ label, value, mono = false, error = false }: DetailRowProps) {
  return (
    <div className="flex gap-4">
      <span className="font-semibold text-gray-700 dark:text-gray-300 w-32 flex-shrink-0">
        {label}:
      </span>
      <span
        className={`flex-1 ${mono ? 'font-mono text-xs' : ''} ${
          error ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
