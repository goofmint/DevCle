/**
 * Token Detail Dialog Component
 *
 * Features:
 * - Display token details (name, prefix, scopes, status, dates)
 * - Status badge (Active=green, Expired=yellow, Revoked=gray)
 * - Revoke button (only for active tokens)
 * - Dark/Light mode support
 */

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Token Detail Type
 */
interface TokenDetail {
  tokenId: string;
  tenantId: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  revokedAt: Date | null;
  status: 'active' | 'expired' | 'revoked';
}

/**
 * Props for TokenDetailDialog component
 */
interface TokenDetailDialogProps {
  tokenId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRevoke: (tokenId: string) => void;
}

/**
 * Format date to readable string
 */
function formatDate(date: Date | null): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Get status badge classes based on status
 */
function getStatusBadgeClasses(status: 'active' | 'expired' | 'revoked'): string {
  if (status === 'active') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  }
  if (status === 'expired') {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  }
  // revoked
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
}

/**
 * Get status label
 */
function getStatusLabel(status: 'active' | 'expired' | 'revoked'): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Token Detail Dialog Component
 */
export function TokenDetailDialog({ tokenId, isOpen, onClose, onRevoke }: TokenDetailDialogProps) {
  const [tokenDetail, setTokenDetail] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch token detail when dialog opens
  useEffect(() => {
    if (isOpen && tokenId) {
      setLoading(true);
      setError(null);

      fetch(`/api/tokens/${tokenId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch token detail');
          return res.json();
        })
        .then((data) => {
          setTokenDetail(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, tokenId]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={onClose}></div>

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <Icon icon="mdi:key" className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100" id="modal-title">
                  Token Details
                </h3>

                <div className="mt-4">
                  {loading && (
                    <div className="text-center py-4">
                      <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {tokenDetail && !loading && !error && (
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{tokenDetail.name}</dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Prefix</dt>
                        <dd className="mt-1">
                          <code className="text-sm text-gray-900 dark:text-gray-100 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                            {tokenDetail.tokenPrefix}...
                          </code>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Scopes</dt>
                        <dd className="mt-1 flex flex-wrap gap-1">
                          {tokenDetail.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {scope}
                            </span>
                          ))}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                        <dd className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(tokenDetail.status)}`}>
                            {getStatusLabel(tokenDetail.status)}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Used</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {formatRelativeTime(tokenDetail.lastUsedAt)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Expires At</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {tokenDetail.expiresAt ? formatDate(tokenDetail.expiresAt) : 'No expiration'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(tokenDetail.createdAt)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created By</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{tokenDetail.createdBy}</dd>
                      </div>

                      {tokenDetail.revokedAt && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Revoked At</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                            {formatDate(tokenDetail.revokedAt)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            {tokenDetail && tokenDetail.status === 'active' && (
              <button
                type="button"
                onClick={() => onRevoke(tokenDetail.tokenId)}
                className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto"
              >
                Revoke Token
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
