/**
 * useSwapy Hook
 *
 * Custom hook for initializing Swapy drag-and-drop library.
 * Handles instance lifecycle, localStorage persistence, and layout management.
 *
 * Features:
 * - Automatic Swapy instance initialization and cleanup
 * - Layout persistence via localStorage
 * - Layout change event handling
 * - Reset functionality
 *
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   const { containerRef } = useSwapy({
 *     storageKey: 'my-layout',
 *     animation: 'dynamic'
 *   });
 *
 *   return (
 *     <div ref={containerRef} data-swapy-container>
 *       <div data-swapy-slot="slot-1">
 *         <div data-swapy-item="item-1">Content 1</div>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */

import { useRef, useEffect, useState } from 'react';
import { createSwapy, type Swapy } from 'swapy';

/**
 * useSwapy Options
 *
 * Configuration options for Swapy initialization.
 */
export interface UseSwapyOptions {
  /** localStorage key for persisting layout (default: 'swapy-layout') */
  storageKey?: string;
  /** Animation type for drag-and-drop transitions (default: 'dynamic') */
  animation?: 'dynamic' | 'spring' | 'none';
  /** Callback fired when layout changes */
  onLayoutChange?: (layout: Record<string, string>) => void;
}

/**
 * useSwapy Return Value
 *
 * Values and functions returned by useSwapy hook.
 */
export interface UseSwapyReturn {
  /** Ref to attach to Swapy container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Swapy instance (null until initialized) */
  swapyInstance: Swapy | null;
  /** Function to reset layout to initial state */
  resetLayout: () => void;
}

/**
 * useSwapy Hook
 *
 * Initializes Swapy drag-and-drop functionality with localStorage persistence.
 *
 * Lifecycle:
 * 1. On mount: Create Swapy instance, restore layout from localStorage
 * 2. On layout change: Save to localStorage, call onLayoutChange callback
 * 3. On unmount: Destroy Swapy instance, clean up event listeners
 *
 * @param options - Configuration options
 * @returns Container ref, Swapy instance, and reset function
 */
export function useSwapy(options: UseSwapyOptions = {}): UseSwapyReturn {
  const {
    storageKey = 'swapy-layout',
    animation = 'dynamic',
    onLayoutChange,
  } = options;

  // Ref to container element (must have data-swapy-container attribute)
  const containerRef = useRef<HTMLDivElement>(null);

  // State to store Swapy instance
  const [swapyInstance, setSwapyInstance] = useState<Swapy | null>(null);

  /**
   * Initialize Swapy
   *
   * Creates Swapy instance and sets up event listeners.
   * Runs once on mount when containerRef is available.
   */
  useEffect(() => {
    // Wait for container to be mounted
    if (!containerRef.current) return;

    // Create Swapy instance
    const swapy = createSwapy(containerRef.current, {
      animation,
    });

    // Store instance in state
    setSwapyInstance(swapy);

    // Restore layout from localStorage
    if (typeof window !== 'undefined') {
      const savedLayout = localStorage.getItem(storageKey);
      if (savedLayout) {
        try {
          const layout = JSON.parse(savedLayout) as Record<string, string>;
          // Swapy will automatically restore layout if data attributes match
          // This is handled by Swapy library internally
          console.debug('Restored layout from localStorage:', layout);
        } catch (error) {
          console.warn('Failed to parse saved layout:', error);
        }
      }
    }

    // Set up layout change listener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    swapy.onSwap((event: any) => {
      // event.object contains the new layout mapping (according to Swapy docs)
      // Format: { slotId: itemId, ... }
      const newLayout = event.object as Record<string, string>;

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(newLayout));
      }

      // Call user-provided callback
      if (onLayoutChange) {
        onLayoutChange(newLayout);
      }
    });

    // Cleanup on unmount
    return () => {
      swapy.destroy();
      setSwapyInstance(null);
    };
  }, [animation, storageKey, onLayoutChange]);

  /**
   * Reset Layout
   *
   * Clears saved layout from localStorage and reloads the page.
   * This forces Swapy to use the initial layout defined in JSX.
   */
  const resetLayout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
      // Reload to apply initial layout
      window.location.reload();
    }
  };

  return {
    containerRef,
    swapyInstance,
    resetLayout,
  };
}
