/**
 * SwapyContainer Component
 *
 * Wrapper component that enables drag-and-drop functionality using Swapy library.
 * Provides layout persistence via localStorage.
 *
 * Features:
 * - Drag-and-drop widget reordering
 * - Layout persistence across page reloads
 * - Layout reset functionality
 * - Accessibility support
 *
 * Usage:
 * ```typescript
 * <SwapyContainer storageKey="overview-layout">
 *   <div data-swapy-slot="slot-1">
 *     <div data-swapy-item="item-1">
 *       <StatCard ... />
 *     </div>
 *   </div>
 *   <div data-swapy-slot="slot-2">
 *     <div data-swapy-item="item-2">
 *       <StatCard ... />
 *     </div>
 *   </div>
 * </SwapyContainer>
 * ```
 */

import React from 'react';
import { useSwapy } from '~/hooks/useSwapy.js';

/**
 * SwapyContainer Props
 *
 * Configuration for SwapyContainer component.
 */
export interface SwapyContainerProps {
  /** Child elements (must include data-swapy-slot and data-swapy-item attributes) */
  children: React.ReactNode;
  /** localStorage key for persisting layout (default: 'overview-layout') */
  storageKey?: string;
  /** Animation type for drag transitions (default: 'dynamic') */
  animation?: 'dynamic' | 'spring' | 'none';
  /** Show reset button (default: false) */
  showResetButton?: boolean;
}

/**
 * SwapyContainer Component
 *
 * Enables drag-and-drop functionality for child widgets.
 * Uses useSwapy hook for Swapy initialization and lifecycle management.
 *
 * Children must use Swapy's data attributes:
 * - data-swapy-slot: Defines a droppable slot
 * - data-swapy-item: Defines a draggable item
 *
 * @param props - SwapyContainer props
 * @returns SwapyContainer JSX element
 */
export function SwapyContainer({
  children,
  storageKey = 'overview-layout',
  animation = 'dynamic',
  showResetButton = false,
}: SwapyContainerProps): JSX.Element {
  // Initialize Swapy with useSwapy hook
  const { containerRef, resetLayout } = useSwapy({
    storageKey,
    animation,
    onLayoutChange: (layout) => {
      console.debug('Layout changed:', layout);
    },
  });

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
      <div ref={containerRef} data-swapy-container>
        {children}
      </div>
    </div>
  );
}
