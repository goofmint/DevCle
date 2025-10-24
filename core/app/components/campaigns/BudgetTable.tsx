/**
 * Budget Table Component (Common Component)
 *
 * Displays paginated table of budget entries for a campaign.
 * Fetches data from /api/campaigns/:id/budgets
 *
 * Features:
 * - Table view (category, amount, currency, spent_at, memo)
 * - Category filter dropdown
 * - Pagination (limit: 20 per page)
 * - Total cost summary at bottom
 * - URL params sync (no page reload on filter/sort changes)
 *
 * Design Pattern:
 * - Similar to DeveloperTable (Task 7.3)
 * - Uses useSearchParams for URL state management
 * - useEffect re-fetches data when params change
 * - No page reload on search/filter/sort
 *
 * Props:
 * - campaignId: Campaign ID to fetch budgets for
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import { Icon } from '@iconify/react';

/**
 * Budget entry type
 */
interface Budget {
  budgetId: string;
  category: string;
  amount: string;
  currency: string;
  spentAt: string;
  memo: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Props for BudgetTable component
 */
interface BudgetTableProps {
  campaignId: string;
}

/**
 * BudgetTable Component
 *
 * Renders budget data in table format with filtering and pagination.
 * All filter/pagination changes update URL params and trigger re-fetch (no page reload).
 */
export function BudgetTable({ campaignId }: BudgetTableProps) {
  // URL params management (no reload pattern)
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || '1');
  const category = searchParams.get('category') || '';
  const limit = 20;

  // State management
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data fetching (re-fetch when URL params change, no page reload)
  useEffect(() => {
    async function fetchBudgets() {
      try {
        setLoading(true);
        setError(null);

        const offset = (page - 1) * limit;
        const url = new URL(`/api/campaigns/${campaignId}/budgets`, window.location.origin);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('offset', String(offset));
        if (category) {
          url.searchParams.set('category', category);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch budgets');
        }

        const data = await response.json();
        setBudgets(data.budgets || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch budgets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load budgets');
      } finally {
        setLoading(false);
      }
    }

    fetchBudgets();
  }, [campaignId, page, category, limit]);

  // Filter handler (updates URL params, triggers useEffect re-fetch)
  const handleCategoryChange = (newCategory: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'budgets'); // Maintain current tab
    newSearchParams.set('page', '1'); // Reset to page 1 when filtering
    if (newCategory) {
      newSearchParams.set('category', newCategory);
    } else {
      newSearchParams.delete('category');
    }
    setSearchParams(newSearchParams);
  };

  // Pagination handler (updates URL params, triggers useEffect re-fetch)
  const handlePageChange = (newPage: number) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', 'budgets'); // Maintain current tab
    newSearchParams.set('page', String(newPage));
    if (category) {
      newSearchParams.set('category', category);
    }
    setSearchParams(newSearchParams);
  };

  // Calculate total pages
  const totalPages = Math.ceil(total / limit);

  // Calculate total cost (sum of all budget amounts)
  const totalCost = budgets.reduce((sum, budget) => sum + parseFloat(budget.amount), 0);

  // Format date to human-readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state (skeleton loader)
  if (loading) {
    return (
      <div className="space-y-4" data-testid="budget-list-loading">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="budget-list">
      {/* Filter Controls */}
      <div className="mb-6 flex items-center gap-4">
        <label htmlFor="category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Category:
        </label>
        <select
          id="category-filter"
          data-testid="category-filter"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="labor">Labor</option>
          <option value="marketing">Marketing</option>
          <option value="events">Events</option>
          <option value="tools">Tools</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Budget Table */}
      {budgets.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              {/* Table header */}
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Category
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Spent Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Memo
                  </th>
                </tr>
              </thead>

              {/* Table body */}
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {budgets.map((budget) => (
                  <tr key={budget.budgetId} data-testid="budget-row">
                    {/* Category cell */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                   bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        data-testid="budget-category"
                      >
                        {budget.category}
                      </span>
                    </td>

                    {/* Amount cell */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {budget.currency} {parseFloat(budget.amount).toLocaleString()}
                    </td>

                    {/* Spent date cell */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(budget.spentAt)}
                    </td>

                    {/* Memo cell */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {budget.memo || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table footer with total */}
              <tfoot className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Total
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">
                    JPY {totalCost.toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} budgets
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium
                             text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                             hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                  data-testid="pagination-prev"
                >
                  <Icon icon="heroicons:chevron-left" className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium
                             text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                             hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                  data-testid="pagination-next"
                >
                  <Icon icon="heroicons:chevron-right" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-testid="budgets-empty-state">
          <Icon
            icon="heroicons:currency-dollar"
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
          />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No budgets found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {category ? 'Try adjusting your filter criteria.' : 'This campaign has no budget entries yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
