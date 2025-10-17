/**
 * SwapyContainer Component
 *
 * Wrapper component that enables drag-and-drop functionality using Swapy library.
 * Provides layout persistence via localStorage.
 *
 * Based on: https://swapy.tahazsh.com/docs/framework-react-dynamic/
 *
 * Features:
 * - Drag-and-drop widget reordering
 * - Layout persistence across page reloads
 * - Layout reset functionality
 * - Accessibility support
 *
 * Usage:
 * ```typescript
 * <SwapyContainer
 *   storageKey="overview-layout"
 *   items={[
 *     { id: 'stats-grid', content: <StatsGrid /> },
 *     { id: 'activity-chart', content: <ActivityChart /> },
 *   ]}
 * />
 * ```
 */

import { useSwapy, type SwapyItem } from '~/hooks/useSwapy.js';

/**
 * SwapyContainer Props
 *
 * Configuration for SwapyContainer component.
 */
export interface SwapyContainerProps {
  /** Array of widget items to display */
  items: SwapyItem[];
  /** localStorage key for persisting layout (default: 'swapy-layout') */
  storageKey?: string;
  /** Animation type for drag transitions (default: 'dynamic') */
  animation?: 'dynamic' | 'spring' | 'none';
  /** Show reset button (default: false) */
  showResetButton?: boolean;
}

/**
 * SwapyContainer Component
 *
 * Enables drag-and-drop functionality for widget items.
 * Uses useSwapy hook for Swapy initialization and lifecycle management.
 *
 * Items are rendered based on slotItemMap, which determines the order
 * and mapping of items to slots. Layout is persisted in localStorage.
 *
 * @param props - SwapyContainer props
 * @returns SwapyContainer JSX element
 */
export function SwapyContainer({
  items,
  storageKey = 'swapy-layout',
  animation = 'dynamic',
  showResetButton = false,
}: SwapyContainerProps): JSX.Element {
  // Initialize Swapy with useSwapy hook
  const { containerRef, getSlottedItems, resetLayout } = useSwapy({
    items,
    storageKey,
    animation,
  });

  // Get slotted items based on current layout
  const slottedItems = getSlottedItems();

  return (
    <div className="relative">
      {/* Reset Button (optional) */}
      {showResetButton && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={resetLayout}
            className="
              px-4 py-2 rounded-lg
              bg-gray-200 dark:bg-gray-700
              text-gray-700 dark:text-gray-300
              hover:bg-gray-300 dark:hover:bg-gray-600
              transition-colors duration-200
              text-sm font-medium
            "
            aria-label="Reset widget layout to default"
          >
            Reset Layout
          </button>
        </div>
      )}

      {/* Swapy Container */}
      {/* Must have data-swapy-container attribute for Swapy to recognize it */}
      <div
        ref={containerRef}
        data-swapy-container
        className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        {slottedItems.map((slottedItem) => (
          <div key={slottedItem.slotId} data-swapy-slot={slottedItem.slotId}>
            {slottedItem.itemId && slottedItem.content && (
              <div data-swapy-item={slottedItem.itemId} className="relative">
                {/* Drag Handle - Top left corner */}
                <div
                  data-swapy-handle
                  className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  aria-label="Drag to reorder"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                    <circle cx="6" cy="2" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="2" r="1.5" fill="currentColor" />
                    <circle cx="2" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="6" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="6" r="1.5" fill="currentColor" />
                    <circle cx="2" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="6" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                  </svg>
                </div>
                {/* Widget content */}
                {slottedItem.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
