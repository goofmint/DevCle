/**
 * Props for ActionCombobox component
 */
interface ActionComboboxProps {
  /** Current action value */
  value: string;
  /** List of existing actions for autocomplete */
  existingActions: string[];
  /** Callback when action is changed */
  onChange: (action: string) => void;
  /** Whether the input is disabled (edit mode) */
  disabled?: boolean;
}

/**
 * Action Combobox Component
 *
 * Features:
 * - Dropdown showing existing actions
 * - Allows typing new action
 * - Autocomplete suggestions
 * - Validation: 1-100 characters
 *
 * Implementation:
 * - Use native <datalist> + <input> for simplicity
 * - Browser-native autocomplete functionality
 *
 * Behavior:
 * - Click to show dropdown of existing actions
 * - Type to filter suggestions
 * - Select existing action or enter new one
 * - Disabled in edit mode (action is identifier)
 */
export function ActionCombobox({
  value,
  existingActions,
  onChange,
  disabled = false,
}: ActionComboboxProps) {
  return (
    <div>
      <label
        htmlFor="action-input"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Action {disabled && '(cannot be changed)'}
      </label>
      <input
        id="action-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list="action-suggestions"
        disabled={disabled}
        minLength={1}
        maxLength={100}
        required
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          disabled
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600'
        }`}
        placeholder="Enter action (e.g., click, attend, signup)"
      />
      <datalist id="action-suggestions">
        {existingActions.map((action) => (
          <option key={action} value={action} />
        ))}
      </datalist>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {disabled
          ? 'Action cannot be changed after creation'
          : 'Select an existing action or type a new one (1-100 characters)'}
      </p>
    </div>
  );
}
