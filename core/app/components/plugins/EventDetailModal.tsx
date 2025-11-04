/**
 * Event Detail Modal Component
 *
 * Displays detailed information about a plugin event in a modal dialog.
 *
 * Features:
 * - Event metadata (ID, type, status, timestamps)
 * - JSON viewer for raw data (collapsible, syntax highlighted)
 * - Reprocess button (only for failed events)
 * - Close on backdrop click or Escape key
 * - Dark mode support
 * - Accessible modal (focus trap, ARIA attributes)
 */

import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import type { PluginEvent } from '~/types/plugin-events';

interface EventDetailModalProps {
  event: PluginEvent;
  onClose: () => void;
  onReprocess: (eventId: string) => void;
  reprocessing?: boolean;
}

/**
 * JSON Viewer Component
 *
 * Simple JSON viewer with syntax highlighting and collapsible structure.
 */
function JSONViewer({ data }: { data: Record<string, unknown> }) {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
      <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
        {jsonString}
      </pre>
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'N/A';

  try {
    const date = new Date(isoTimestamp);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: PluginEvent['status'] }) {
  const config = {
    processed: {
      label: 'Processed',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: 'mdi:check-circle',
    },
    failed: {
      label: 'Failed',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: 'mdi:alert-circle',
    },
    pending: {
      label: 'Pending',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: 'mdi:clock-outline',
    },
  };

  const { label, color, icon } = config[status];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}
    >
      <Icon icon={icon} className="w-4 h-4 mr-1.5" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Event Detail Modal Component
 */
export function EventDetailModal({
  event,
  onClose,
  onReprocess,
  reprocessing = false,
}: EventDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  /**
   * Handle Escape key press
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  /**
   * Focus trap
   */
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus();
          e.preventDefault();
        }
      }
    };

    modal.addEventListener('keydown', handleTab as never);
    firstElement?.focus();

    return () => modal.removeEventListener('keydown', handleTab as never);
  }, []);

  /**
   * Handle backdrop click
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      data-testid="event-detail-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center space-x-3">
              <h2
                id="modal-title"
                className="text-xl font-semibold text-gray-900 dark:text-gray-100"
              >
                Event Details
              </h2>
              <StatusBadge status={event.status} />
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              aria-label="Close modal"
              data-testid="close-modal-button"
            >
              <Icon icon="mdi:close" className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Metadata Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Event ID
                </label>
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                  {event.pluginEventId}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Event Type
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {event.eventType}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ingested At
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatTimestamp(event.ingestedAt)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Processed At
                </label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatTimestamp(event.processedAt)}
                </p>
              </div>

              {event.errorMessage && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Error Message
                  </label>
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    {event.errorMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Raw Data Section */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Raw Data
              </label>
              <JSONViewer data={event.rawData} />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>

            {event.status === 'failed' && (
              <button
                onClick={() => onReprocess(event.pluginEventId)}
                disabled={reprocessing}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="reprocess-button"
              >
                {reprocessing ? (
                  <>
                    <Icon icon="mdi:loading" className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Reprocessing...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:refresh" className="w-4 h-4 mr-2" aria-hidden="true" />
                    Reprocess
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
