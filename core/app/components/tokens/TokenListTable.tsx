/**
 * Token List Table Component
 *
 * Displays a table of API tokens with:
 * - Name, Token Prefix, Scopes, Last Used, Expires At, Status, Actions
 * - Status badges (Active=green, Expired=yellow, Revoked=gray)
 * - Action buttons (View, Revoke)
 * - Dark/Light mode support
 */

import { Icon } from '@iconify/react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Token Item Type
 */
interface TokenItem {
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
 * Props for TokenListTable component
 */
interface TokenListTableProps {
  tokens: TokenItem[];
  onViewDetail: (tokenId: string) => void;
  onRevoke: (tokenId: string, tokenName: string) => void;
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Format date to readable string
 */
function formatDate(date: Date | null): string {
  if (!date) return 'No expiration';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
 * Token List Table Component
 */
export function TokenListTable({ tokens, onViewDetail, onRevoke }: TokenListTableProps) {
  // Handle empty state
  if (tokens.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
        <Icon icon="mdi:key-outline" className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tokens found</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Create your first API token to get started with webhook integrations.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Token Prefix
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Scopes
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Used
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Expires At
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {tokens.map((token) => (
              <tr key={token.tokenId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{token.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                    {token.tokenPrefix}...
                  </code>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {token.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(token.lastUsedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(token.expiresAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(token.status)}`}>
                    {getStatusLabel(token.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onViewDetail(token.tokenId)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="View details"
                    >
                      <Icon icon="mdi:eye" className="w-5 h-5" />
                    </button>
                    {token.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => onRevoke(token.tokenId, token.name)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Revoke token"
                      >
                        <Icon icon="mdi:cancel" className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
