/**
 * API Tokens Management Page
 *
 * Accessible at: /dashboard/settings/tokens
 *
 * Features:
 * - List API tokens with filtering and pagination
 * - Create new token with one-time display
 * - View token details
 * - Revoke tokens with confirmation
 * - Dark/Light mode support
 *
 * Architecture:
 * - Loader: Fetch tokens from API
 * - Action: Handle create/revoke operations
 * - Components: CreateTokenDialog, TokenDetailDialog, RevokeTokenDialog
 */

import React, { useState } from 'react';
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from '@remix-run/node';
import { useLoaderData, useFetcher, Link, useLocation, useSearchParams } from '@remix-run/react';
import { requireAuth } from '~/auth.middleware.js';
import { Icon } from '@iconify/react';
import { TokenListTable } from '~/components/tokens/TokenListTable';
import { Pagination } from '~/components/tokens/Pagination';
import { CreateTokenDialog } from '~/components/tokens/CreateTokenDialog';
import { TokenDetailDialog } from '~/components/tokens/TokenDetailDialog';
import { RevokeTokenDialog } from '~/components/tokens/RevokeTokenDialog';

/**
 * Token Item Type (from API response)
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
 * Loader Data Type
 */
interface LoaderData {
  tokens: TokenItem[];
  total: number;
  page: number;
  perPage: number;
  status: string;
}

/**
 * Action Data Type
 */
interface ActionData {
  success?: boolean;
  error?: string;
  intent?: string;
  token?: string; // Plain text token (only for create)
  tokenId?: string;
}

/**
 * Meta function - Sets page title
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'API Tokens - Settings - Dashboard - DevCle' },
    { name: 'description', content: 'Manage API tokens for webhook integrations' },
  ];
};

/**
 * Loader function
 *
 * Fetches API tokens from backend API with filtering and pagination.
 *
 * Steps:
 * 1. Authenticate user (requireAuth throws redirect if not authenticated)
 * 2. Get query parameters (status, page, perPage)
 * 3. Call GET /api/tokens with filters
 * 4. Return token list with pagination info
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check
    await requireAuth(request);

    // 2. Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('perPage') || '20', 10);

    // 3. Build API URL with query parameters
    const apiParams = new URLSearchParams();
    apiParams.set('status', status);
    apiParams.set('page', page.toString());
    apiParams.set('perPage', perPage.toString());

    // 4. Fetch tokens from API (use BASE_URL for server-side fetch, fallback to request origin)
    const baseUrl = process.env['BASE_URL'] || url.origin;
    const apiUrl = `/api/tokens?${apiParams.toString()}`;
    const response = await fetch(new URL(apiUrl, baseUrl).toString(), {
      headers: {
        Cookie: request.headers.get('Cookie') || '',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.statusText}`);
    }

    const data = await response.json();

    // 5. Return loader data
    return json<LoaderData>({
      tokens: data.items || [],
      total: data.total || 0,
      page: data.page || 1,
      perPage: data.perPage || 20,
      status,
    });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response) {
      throw error;
    }

    // Handle errors
    console.error('Failed to load tokens:', error);
    throw new Response('Failed to load tokens', { status: 500 });
  }
}

/**
 * Action function
 *
 * Handles form submissions for creating and revoking tokens.
 *
 * Intents:
 * - 'create': Create new token (POST /api/tokens)
 * - 'revoke': Revoke token (DELETE /api/tokens/:id)
 *
 * Steps:
 * 1. Authenticate user
 * 2. Parse FormData
 * 3. Route to appropriate action handler
 * 4. Return result
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // 1. Authentication check
    await requireAuth(request);

    // 2. Parse FormData
    const formData = await request.formData();
    const intent = formData.get('intent') as string;

    // 3. Route to appropriate action handler
    if (intent === 'create') {
      // Create token
      const name = formData.get('name') as string;
      const scopesStr = formData.get('scopes') as string;
      const expiresAtStr = formData.get('expiresAt') as string;

      const scopes = scopesStr ? scopesStr.split(',') : [];
      const expiresAt = expiresAtStr ? new Date(expiresAtStr) : undefined;

      const url = new URL(request.url);
      const baseUrl = process.env['BASE_URL'] || url.origin;
      const response = await fetch(new URL('/api/tokens', baseUrl).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('Cookie') || '',
        },
        body: JSON.stringify({
          name,
          scopes,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return json<ActionData>(
          { error: errorData.error || 'Failed to create token', intent: 'create' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return json<ActionData>({ success: true, intent: 'create', token: data.token, tokenId: data.tokenId });
    }

    if (intent === 'revoke') {
      // Revoke token
      const tokenId = formData.get('tokenId') as string;

      const url = new URL(request.url);
      const baseUrl = process.env['BASE_URL'] || url.origin;
      const response = await fetch(new URL(`/api/tokens/${tokenId}`, baseUrl).toString(), {
        method: 'DELETE',
        headers: {
          Cookie: request.headers.get('Cookie') || '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return json<ActionData>(
          { error: errorData.error || 'Failed to revoke token', intent: 'revoke' },
          { status: response.status }
        );
      }

      return json<ActionData>({ success: true, intent: 'revoke', tokenId });
    }

    // Unknown intent
    return json<ActionData>({ error: 'Invalid intent' }, { status: 400 });
  } catch (error) {
    // Handle requireAuth() redirect
    if (error instanceof Response) {
      throw error;
    }

    // Handle errors
    console.error('Action error:', error);
    return json<ActionData>(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * API Tokens Settings Page Component
 *
 * Renders the API tokens management page with:
 * 1. Page header with "Create Token" button
 * 2. Filter bar (status selector)
 * 3. Token list table
 * 4. Pagination
 * 5. Dialogs (create, detail, revoke)
 */
export default function APITokensPage() {
  // Get loader data and URL params
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const currentPath = location.pathname;

  // Create fetchers for async operations
  const createFetcher = useFetcher<ActionData>();
  const revokeFetcher = useFetcher<ActionData>();

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedTokenName, setSelectedTokenName] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Handle create dialog open
  const handleCreateClick = () => {
    setCreatedToken(null);
    setIsCreateDialogOpen(true);
  };

  // Handle create form submit
  const handleCreateSubmit = (formData: FormData) => {
    formData.append('intent', 'create');
    createFetcher.submit(formData, { method: 'post' });
  };

  // Handle view detail
  const handleViewDetail = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    setIsDetailDialogOpen(true);
  };

  // Handle revoke click
  const handleRevokeClick = (tokenId: string, tokenName: string) => {
    setSelectedTokenId(tokenId);
    setSelectedTokenName(tokenName);
    setIsRevokeDialogOpen(true);
  };

  // Handle revoke confirm
  const handleRevokeConfirm = () => {
    if (!selectedTokenId) return;

    const formData = new FormData();
    formData.append('intent', 'revoke');
    formData.append('tokenId', selectedTokenId);
    revokeFetcher.submit(formData, { method: 'post' });
  };

  // Handle filter change
  const handleStatusChange = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('status', status);
    newParams.delete('page'); // Reset to page 1 when filtering
    setSearchParams(newParams);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', page.toString());
    setSearchParams(newParams);
  };

  // Watch for create success
  React.useEffect(() => {
    if (createFetcher.data?.success && createFetcher.data.token) {
      setCreatedToken(createFetcher.data.token);
    }
  }, [createFetcher.data]);

  // Watch for revoke success
  React.useEffect(() => {
    if (revokeFetcher.data?.success) {
      setIsRevokeDialogOpen(false);
      setSelectedTokenId(null);
      setSelectedTokenName(null);
    }
  }, [revokeFetcher.data]);

  // Check if submitting
  const isCreating = createFetcher.state === 'submitting';
  const isRevoking = revokeFetcher.state === 'submitting';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">API Tokens</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage API tokens for webhook integrations
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Settings tabs">
          <Link
            to="/dashboard/settings"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                currentPath === '/dashboard/settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            System
          </Link>
          <Link
            to="/dashboard/settings/activity-types"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                currentPath === '/dashboard/settings/activity-types'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            Activity Types
          </Link>
          <Link
            to="/dashboard/settings/tokens"
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                currentPath === '/dashboard/settings/tokens'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            API Tokens
          </Link>
        </nav>
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex justify-between items-center">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status:
          </label>
          <select
            id="status-filter"
            value={loaderData.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="block w-40 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        {/* Create Button */}
        <button
          type="button"
          onClick={handleCreateClick}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Icon icon="mdi:plus" className="w-5 h-5 mr-2" />
          Create Token
        </button>
      </div>

      {/* Token List Table */}
      <TokenListTable
        tokens={loaderData.tokens.map((token) => ({
          ...token,
          lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : null,
          expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
          createdAt: new Date(token.createdAt),
          revokedAt: token.revokedAt ? new Date(token.revokedAt) : null,
        }))}
        onViewDetail={handleViewDetail}
        onRevoke={handleRevokeClick}
      />

      {/* Pagination */}
      {loaderData.total > 0 && (
        <Pagination
          currentPage={loaderData.page}
          totalPages={Math.ceil(loaderData.total / loaderData.perPage)}
          onPageChange={handlePageChange}
        />
      )}

      {/* Dialogs */}
      <CreateTokenDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setCreatedToken(null);
        }}
        onSubmit={handleCreateSubmit}
        isSubmitting={isCreating}
        createdToken={createdToken}
      />

      <TokenDetailDialog
        tokenId={selectedTokenId}
        isOpen={isDetailDialogOpen}
        onClose={() => {
          setIsDetailDialogOpen(false);
          setSelectedTokenId(null);
        }}
        onRevoke={(tokenId) => {
          setIsDetailDialogOpen(false);
          const token = loaderData.tokens.find((t) => t.tokenId === tokenId);
          if (token) {
            handleRevokeClick(tokenId, token.name);
          }
        }}
      />

      <RevokeTokenDialog
        tokenName={selectedTokenName}
        isOpen={isRevokeDialogOpen}
        onClose={() => {
          setIsRevokeDialogOpen(false);
          setSelectedTokenId(null);
          setSelectedTokenName(null);
        }}
        onConfirm={handleRevokeConfirm}
        isSubmitting={isRevoking}
      />
    </div>
  );
}
