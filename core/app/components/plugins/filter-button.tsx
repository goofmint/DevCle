/**
 * Filter Button Component
 *
 * A toggle button for filtering plugin runs by status or other criteria.
 * Shows active/inactive states with appropriate styling.
 */

/**
 * Filter Button Props
 */
interface FilterButtonProps {
  /** Button label */
  label: string;
  /** Whether the filter is active */
  active: boolean;
  /** Click handler */
  onClick: () => void;
}

/**
 * Filter Button Component
 *
 * Renders a button that toggles between active and inactive states.
 * Active buttons are highlighted with a blue background.
 *
 * @param label - Button label
 * @param active - Whether the filter is currently active
 * @param onClick - Click handler
 */
export function FilterButton({ label, active, onClick }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
      }`}
      data-testid={`filter-button-${label.toLowerCase()}`}
    >
      {label}
    </button>
  );
}
