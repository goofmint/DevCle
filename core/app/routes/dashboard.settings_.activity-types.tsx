/**
 * Activity Types Settings Page (SPA)
 *
 * Admin-only page for managing activity types.
 * Accessible at: /dashboard/settings/activity-types
 *
 * Features:
 * - Fetch activity types and funnel stages on mount
 * - Create new activity type
 * - Edit existing activity type
 * - Delete activity type with confirmation
 * - Toast notifications for success/error
 * - Dark/Light mode support
 * - Admin-only access (403 for non-admin users)
 *
 * Architecture:
 * - SPA: No loader/action, client-side fetch only
 * - State: useState for all state management
 * - Data fetching: useEffect + fetch API
 * - Components: ActivityTypeTable, ActivityTypeForm
 */

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { ActivityTypeTable } from '~/components/settings/ActivityTypeTable';
import { ActivityTypeForm } from '~/components/settings/ActivityTypeForm';

/**
 * Activity Type data structure
 */
interface ActivityType {
  activityTypeId: string;
  action: string;
  iconName: string;
  colorClass: string;
  stageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Funnel Stage data structure
 */
interface FunnelStage {
  funnelStageId: string;
  stageKey: string;
  stageName: string;
}

/**
 * Toast notification type
 */
interface Toast {
  type: 'success' | 'error';
  message: string;
}

/**
 * Activity Types Settings Page Component (SPA)
 *
 * Features:
 * - Fetch activity types and funnel stages on mount (useEffect)
 * - Display activity types in a table
 * - Create new activity type (inline form)
 * - Edit existing activity type (inline form)
 * - Delete activity type (confirmation dialog)
 * - Toast notifications for success/error
 * - Dark/Light mode support
 *
 * Data Fetching (SPA):
 * - No loader - use useEffect + fetch
 * - No action - use fetch directly in handlers
 * - Client-side state management with useState
 */
export default function ActivityTypesSettings() {
  // State management
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([]);
  const [existingActions, setExistingActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  /**
   * Fetch initial data on component mount
   *
   * Fetches:
   * 1. Activity types (from /api/activity-types?limit=100)
   * 2. Funnel stages (from /api/funnel-stages?limit=100)
   * 3. Existing actions (from /api/activity-types/actions)
   *
   * All requests are made in parallel using Promise.all
   */
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [activityTypesRes, funnelStagesRes, actionsRes] = await Promise.all([
          fetch('/api/activity-types?limit=100'),
          fetch('/api/funnel-stages?limit=100'),
          fetch('/api/activity-types/actions'),
        ]);

        // Check for HTTP errors
        if (!activityTypesRes.ok || !funnelStagesRes.ok || !actionsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        // Parse JSON responses
        const activityTypesData = await activityTypesRes.json();
        const funnelStagesData = await funnelStagesRes.json();
        const actionsData = await actionsRes.json();

        // Update state with fetched data
        setActivityTypes(activityTypesData.activityTypes);
        setFunnelStages(funnelStagesData.funnelStages);
        setExistingActions(actionsData.actions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  /**
   * Show toast notification
   *
   * @param type - Toast type (success or error)
   * @param message - Toast message
   */
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    // Auto-hide toast after 5 seconds
    setTimeout(() => setToast(null), 5000);
  };

  /**
   * Handle create activity type
   *
   * POST /api/activity-types with FormData
   *
   * @param data - FormData with action, iconName, colorClass, funnelStageId
   */
  const handleCreate = async (data: FormData) => {
    try {
      const res = await fetch('/api/activity-types', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(data)),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create activity type');
      }

      const newActivityType = await res.json();

      // Add new activity type to state
      setActivityTypes([...activityTypes, newActivityType.activityType]);

      // Add new action to existing actions list
      setExistingActions([...existingActions, newActivityType.activityType.action]);

      // Close form and show success toast
      setIsCreating(false);
      showToast('success', `Activity type "${newActivityType.activityType.action}" created`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create activity type');
    }
  };

  /**
   * Handle update activity type
   *
   * PUT /api/activity-types/:action with FormData
   *
   * @param action - Action identifier
   * @param data - FormData with iconName, colorClass, funnelStageId
   */
  const handleUpdate = async (action: string, data: FormData) => {
    try {
      const res = await fetch(`/api/activity-types/${action}`, {
        method: 'PUT',
        body: JSON.stringify(Object.fromEntries(data)),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update activity type');
      }

      const updated = await res.json();

      // Update activity type in state
      setActivityTypes(
        activityTypes.map((at) => (at.action === action ? updated.activityType : at))
      );

      // Close form and show success toast
      setEditingAction(null);
      showToast('success', `Activity type "${action}" updated`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update activity type');
    }
  };

  /**
   * Handle delete activity type
   *
   * DELETE /api/activity-types/:action with confirmation dialog
   *
   * @param action - Action identifier
   */
  const handleDelete = async (action: string) => {
    // Confirmation dialog
    if (!confirm(`Are you sure you want to delete the activity type "${action}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/activity-types/${action}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete activity type');
      }

      // Remove activity type from state
      setActivityTypes(activityTypes.filter((at) => at.action !== action));

      // Remove action from existing actions list
      setExistingActions(existingActions.filter((a) => a !== action));

      // Show success toast
      showToast('success', `Activity type "${action}" deleted`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete activity type');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Icon icon="mdi:loading" className="w-8 h-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-6 rounded-lg">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:alert-circle" className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Error Loading Activity Types</h2>
          </div>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Get editing activity type data
  const editingData = editingAction
    ? activityTypes.find((at) => at.action === editingAction)
    : null;

  return (
    <div className="max-w-6xl mx-auto" data-testid="activity-types-settings-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Activity Type Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage activity types with custom icons and colors
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`
            mb-6 p-4 rounded-md flex items-center gap-2
            ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400' : ''}
            ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400' : ''}
          `}
          role="alert"
          data-testid="toast-notification"
        >
          <Icon
            icon={toast.type === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'}
            className="w-5 h-5"
          />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Create Button */}
      {!isCreating && !editingAction && (
        <div className="mb-6">
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            data-testid="create-activity-type-button"
          >
            <Icon icon="heroicons:plus" className="inline w-5 h-5 mr-2" />
            Create Activity Type
          </button>
        </div>
      )}

      {/* Create Form */}
      {isCreating && (
        <div className="mb-6">
          <ActivityTypeForm
            mode="create"
            existingActions={existingActions}
            funnelStages={funnelStages}
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      )}

      {/* Edit Form */}
      {editingAction && editingData && (
        <div className="mb-6">
          <ActivityTypeForm
            mode="edit"
            initialData={{
              action: editingData.action,
              iconName: editingData.iconName,
              colorClass: editingData.colorClass,
              funnelStageId: funnelStages.find((fs) => fs.stageKey === editingData.stageKey)?.funnelStageId || null,
            }}
            existingActions={existingActions}
            funnelStages={funnelStages}
            onSubmit={(data) => handleUpdate(editingAction, data)}
            onCancel={() => setEditingAction(null)}
          />
        </div>
      )}

      {/* Activity Types Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <ActivityTypeTable
          activityTypes={activityTypes}
          onEdit={setEditingAction}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
