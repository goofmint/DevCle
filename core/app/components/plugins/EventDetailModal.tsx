/**
 * Event Detail Modal Component
 *
 * Displays detailed information for a plugin event including raw JSON data.
 */

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import type { PluginEventDetail } from '../../../services/plugin-events/index.js';

interface EventDetailModalProps {
  isOpen: boolean;
  eventId: string | null;
  pluginId: string;
  onClose: () => void;
}

export function EventDetailModal({
  isOpen,
  eventId,
  pluginId,
  onClose,
}: EventDetailModalProps) {
  const [event, setEvent] = useState<PluginEventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !eventId) {
      setEvent(null);
      setError(null);
      return;
    }

    // Fetch event detail
    setLoading(true);
    setError(null);

    fetch(`/api/plugins/${pluginId}/events/${eventId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch event detail');
        }
        return res.json();
      })
      .then((data) => {
        setEvent(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isOpen, eventId, pluginId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                id="modal-title"
              >
                Event Detail
              </h3>
              <button
                type="button"
                className="rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                onClick={onClose}
              >
                <Icon icon="mdi:close" className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4 max-h-[70vh] overflow-y-auto">
            {loading && <LoadingState />}
            {error && <ErrorState message={error} />}
            {event && <EventContent event={event} />}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Icon
        icon="mdi:loading"
        className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"
      />
    </div>
  );
}

/**
 * Error State
 */
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg">
      <Icon icon="mdi:alert-circle" className="h-6 w-6" />
      <p>{message}</p>
    </div>
  );
}

/**
 * Event Content
 */
function EventContent({ event }: { event: PluginEventDetail }) {
  return (
    <div className="space-y-6">
      {/* Event Info */}
      <div className="grid grid-cols-2 gap-4">
        <InfoField label="Event ID" value={event.eventId} />
        <InfoField label="Event Type" value={event.eventType} mono />
        <InfoField
          label="Status"
          value={<StatusBadge status={event.status} />}
        />
        <InfoField label="Ingested At" value={formatDateTime(event.ingestedAt)} />
        {event.processedAt && (
          <InfoField label="Processed At" value={formatDateTime(event.processedAt)} />
        )}
      </div>

      {/* Error Message (if failed) */}
      {event.status === 'failed' && event.errorMessage && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Error Message
          </h4>
          <pre className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-300 overflow-x-auto">
            {event.errorMessage}
          </pre>
        </div>
      )}

      {/* Raw Data */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Raw Data (JSON)
        </h4>
        <pre className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-800 dark:text-gray-200 overflow-x-auto max-h-96">
          {JSON.stringify(event.rawData, null, 2)}
        </pre>
      </div>
    </div>
  );
}

/**
 * Info Field
 */
interface InfoFieldProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function InfoField({ label, value, mono = false }: InfoFieldProps) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-1 text-sm text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Status Badge
 */
interface StatusBadgeProps {
  status: 'pending' | 'processed' | 'failed';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    processed: {
      icon: 'mdi:check-circle',
      className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    },
    failed: {
      icon: 'mdi:alert-circle',
      className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    },
    pending: {
      icon: 'mdi:clock-outline',
      className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    },
  };

  const { icon, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      <Icon icon={icon} className="text-sm" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

/**
 * Format date time
 */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
}
