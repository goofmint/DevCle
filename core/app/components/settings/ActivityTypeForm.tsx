import { useState, useEffect, type FormEvent } from 'react';
import { ActionCombobox } from './ActionCombobox.js';
import { IconPicker } from './IconPicker.js';
import { ColorPalette } from './ColorPalette.js';

/**
 * Funnel Stage data structure
 */
interface FunnelStage {
  funnelStageId: string;
  stageKey: string;
  stageName: string;
}

/**
 * Props for ActivityTypeForm component
 */
interface ActivityTypeFormProps {
  /** Form mode: create new or edit existing */
  mode: 'create' | 'edit';
  /** Initial data for edit mode */
  initialData?: {
    action: string;
    iconName: string;
    colorClass: string;
    funnelStageId: string | null;
  };
  /** List of existing actions for ActionCombobox suggestions */
  existingActions: string[];
  /** List of funnel stages for dropdown */
  funnelStages: FunnelStage[];
  /** Callback when form is submitted with FormData */
  onSubmit: (data: FormData) => void;
  /** Callback when cancel button is clicked */
  onCancel: () => void;
}

/**
 * Activity Type Form Component
 *
 * Create or edit activity type with:
 * - Action input (ActionCombobox) - disabled in edit mode
 * - Icon picker (IconPicker) - search and select Iconify icons
 * - Color palette (ColorPalette) - select from preset Tailwind colors
 * - Funnel stage dropdown - optional mapping to funnel stage
 * - Submit/Cancel buttons
 *
 * Fields:
 * 1. Action (Combobox):
 *    - Create mode: Select existing or type new (1-100 characters)
 *    - Edit mode: Disabled (action is immutable identifier)
 * 2. Icon (IconPicker):
 *    - Search and select from 200,000+ Iconify icons
 *    - Live preview of selected icon
 * 3. Color (ColorPalette):
 *    - Select from 10 preset Tailwind colors
 *    - Preview colored badge
 * 4. Funnel Stage (select):
 *    - Dropdown with funnel stages (Awareness, Engagement, etc.)
 *    - Optional (can be null)
 * 5. Buttons:
 *    - Submit: "Create Activity Type" or "Update Activity Type"
 *    - Cancel: Close form without saving
 *
 * Validation:
 * - Action: 1-100 characters, required
 * - Icon: Required (default: 'heroicons:bolt')
 * - Color: Required (default: 'text-gray-600 bg-gray-100 border-gray-200')
 * - Funnel Stage: Optional
 *
 * Dark/Light Mode:
 * - Supports Tailwind dark: classes
 * - All form fields adapt to dark mode
 */
export function ActivityTypeForm({
  mode,
  initialData,
  existingActions,
  funnelStages,
  onSubmit,
  onCancel,
}: ActivityTypeFormProps) {
  // Form state management
  // Default values for create mode
  const [action, setAction] = useState('');
  const [iconName, setIconName] = useState('heroicons:bolt');
  const [colorClass, setColorClass] = useState('text-gray-600 bg-gray-100 border-gray-200');
  const [funnelStageId, setFunnelStageId] = useState<string>('');

  // Initialize form with initialData in edit mode
  useEffect(() => {
    if (initialData) {
      setAction(initialData.action);
      setIconName(initialData.iconName);
      setColorClass(initialData.colorClass);
      setFunnelStageId(initialData.funnelStageId || '');
    }
  }, [initialData]);

  /**
   * Handle form submission
   *
   * Creates FormData with all form fields and calls onSubmit callback
   *
   * @param e - Form event
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate required fields
    if (!action.trim()) {
      alert('Action is required');
      return;
    }

    if (action.trim().length < 1 || action.trim().length > 100) {
      alert('Action must be between 1 and 100 characters');
      return;
    }

    if (!iconName.trim()) {
      alert('Icon is required');
      return;
    }

    if (!colorClass.trim()) {
      alert('Color is required');
      return;
    }

    // Create FormData for submission
    const formData = new FormData();
    formData.append('action', action.trim());
    formData.append('iconName', iconName.trim());
    formData.append('colorClass', colorClass.trim());

    // Append funnelStageId only if selected (not empty string)
    if (funnelStageId) {
      formData.append('funnelStageId', funnelStageId);
    }

    // Call parent onSubmit handler
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6"
    >
      {/* Form Title */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {mode === 'create' ? 'Create Activity Type' : 'Edit Activity Type'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {mode === 'create'
            ? 'Define a new activity type with action, icon, and color.'
            : 'Update the activity type settings. Action cannot be changed.'}
        </p>
      </div>

      {/* Action Input (Combobox) */}
      <div>
        <ActionCombobox
          value={action}
          existingActions={existingActions}
          onChange={setAction}
          disabled={mode === 'edit'}
        />
      </div>

      {/* Icon Picker */}
      <div>
        <IconPicker value={iconName} onChange={setIconName} />
      </div>

      {/* Color Palette */}
      <div>
        <ColorPalette value={colorClass} onChange={setColorClass} />
      </div>

      {/* Funnel Stage Dropdown */}
      <div>
        <label
          htmlFor="funnel-stage-select"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Funnel Stage (Optional)
        </label>
        <select
          id="funnel-stage-select"
          value={funnelStageId}
          onChange={(e) => setFunnelStageId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- None --</option>
          {funnelStages.map((stage) => (
            <option key={stage.funnelStageId} value={stage.funnelStageId}>
              {stage.stageName} ({stage.stageKey})
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Map this activity type to a funnel stage for analytics
        </p>
      </div>

      {/* Form Actions (Submit / Cancel) */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {mode === 'create' ? 'Create Activity Type' : 'Update Activity Type'}
        </button>
      </div>
    </form>
  );
}
