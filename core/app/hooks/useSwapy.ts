/**
 * useSwapy Hook
 *
 * Custom hook for initializing Swapy drag-and-drop library.
 * Implements the official React pattern with manualSwap and slotItemMap.
 *
 * Based on: https://swapy.tahazsh.com/docs/framework-react-dynamic/
 *
 * Features:
 * - Manual swap control with slotItemMap
 * - Layout persistence via localStorage
 * - Layout change event handling
 *
 * Usage:
 * ```typescript
 * function MyComponent() {
 *   const { containerRef, slotItemMap, handleSwap } = useSwapy({
 *     items: [{ id: 'item-1', content: <Component1 /> }],
 *     storageKey: 'my-layout',
 *   });
 *
 *   const slottedItems = getSlottedItems(items, slotItemMap);
 *
 *   return (
 *     <div ref={containerRef} data-swapy-container>
 *       {slottedItems.map((item, index) => (
 *         <div key={item.slotId} data-swapy-slot={item.slotId}>
 *           <div data-swapy-item={item.itemId}>{item.content}</div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { createSwapy, type Swapy, type SwapEvent } from 'swapy';

/**
 * Widget Item Type
 *
 * Represents a single widget with unique ID and content.
 */
export interface SwapyItem {
  id: string;
  content: React.ReactNode;
}

/**
 * Slotted Item Type
 *
 * Represents an item with its assigned slot.
 */
export interface SlottedItem {
  slotId: string;
  itemId: string | null;
  content: React.ReactNode | null;
}

/**
 * SlotItemMap Type
 *
 * Maps slot IDs to item IDs.
 * Example: { 'slot-1': 'item-1', 'slot-2': 'item-2' }
 */
export type SlotItemMap = Record<string, string | null>;

/**
 * useSwapy Options
 *
 * Configuration options for Swapy initialization.
 */
export interface UseSwapyOptions {
  /** Array of widget items to display */
  items: SwapyItem[];
  /** localStorage key for persisting layout (default: 'swapy-layout') */
  storageKey?: string;
  /** Animation type for drag-and-drop transitions (default: 'dynamic') */
  animation?: 'dynamic' | 'spring' | 'none';
}

/**
 * useSwapy Return Value
 *
 * Values and functions returned by useSwapy hook.
 */
export interface UseSwapyReturn {
  /** Ref to attach to Swapy container element */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Current slot-to-item mapping */
  slotItemMap: SlotItemMap;
  /** Swap event handler */
  handleSwap: (event: SwapEvent) => void;
  /** Get slotted items for rendering */
  getSlottedItems: () => SlottedItem[];
  /** Function to reset layout to initial state */
  resetLayout: () => void;
}

/**
 * Initialize SlotItemMap
 *
 * Creates initial slot-to-item mapping.
 * By default, assigns items to slots in order: slot-1 -> item-1, slot-2 -> item-2, etc.
 *
 * @param items - Array of widget items
 * @returns Initial slotItemMap
 */
function initSlotItemMap(items: SwapyItem[]): SlotItemMap {
  const map: SlotItemMap = {};
  items.forEach((item, index) => {
    map[`slot-${index + 1}`] = item.id;
  });
  return map;
}

/**
 * useSwapy Hook
 *
 * Initializes Swapy drag-and-drop functionality with localStorage persistence.
 * Uses manualSwap mode as recommended in Swapy docs for React.
 *
 * Lifecycle:
 * 1. On mount: Create Swapy instance, restore layout from localStorage
 * 2. On swap: Update slotItemMap, save to localStorage
 * 3. On unmount: Destroy Swapy instance, clean up event listeners
 *
 * @param options - Configuration options
 * @returns Container ref, slotItemMap, swap handler, and utility functions
 */
export function useSwapy(options: UseSwapyOptions): UseSwapyReturn {
  const { items, storageKey = 'swapy-layout', animation = 'dynamic' } = options;

  // Ref to container element (must have data-swapy-container attribute)
  const containerRef = useRef<HTMLDivElement>(null);

  // Ref to Swapy instance
  const swapyRef = useRef<Swapy | null>(null);

  // Initialize slotItemMap from localStorage or default
  const [slotItemMap, setSlotItemMap] = useState<SlotItemMap>(() => {
    if (typeof window === 'undefined') {
      return initSlotItemMap(items);
    }

    const savedLayout = localStorage.getItem(storageKey);
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout) as SlotItemMap;

        // Validate saved layout - check if it matches current items structure
        const savedSlotCount = Object.keys(parsed).length;
        const currentItemCount = items.length;

        // Check if all saved itemIds exist in current items
        const currentItemIds = new Set(items.map((item) => item.id));
        const allItemsExist = Object.values(parsed).every(
          (itemId) => itemId === null || currentItemIds.has(itemId)
        );

        // Check for duplicate itemIds (each item should appear exactly once)
        const itemIdCounts = new Map<string, number>();
        Object.values(parsed).forEach((itemId) => {
          if (itemId !== null) {
            itemIdCounts.set(itemId, (itemIdCounts.get(itemId) || 0) + 1);
          }
        });
        const hasDuplicates = Array.from(itemIdCounts.values()).some((count) => count > 1);

        // Check if all current items are present in saved layout
        const savedItemIds = new Set(Object.values(parsed).filter((id): id is string => id !== null));
        const allItemsPresent = items.every((item) => savedItemIds.has(item.id));

        if (
          savedSlotCount === currentItemCount &&
          allItemsExist &&
          !hasDuplicates &&
          allItemsPresent
        ) {
          console.debug('[useSwapy] Restored layout from localStorage:', parsed);
          return parsed;
        } else {
          console.warn(
            '[useSwapy] Saved layout invalid:',
            'slots:', savedSlotCount,
            'items:', currentItemCount,
            'allItemsExist:', allItemsExist,
            'hasDuplicates:', hasDuplicates,
            'allItemsPresent:', allItemsPresent,
            '- clearing localStorage and reloading'
          );
          localStorage.removeItem(storageKey);
          // Reload page to start fresh with initial layout
          window.location.reload();
          // Return temporary value (page will reload before this is used)
          return initSlotItemMap(items);
        }
      } catch (error) {
        console.warn('[useSwapy] Failed to parse saved layout:', error);
        return initSlotItemMap(items);
      }
    }

    return initSlotItemMap(items);
  });

  /**
   * Handle Swap Event
   *
   * Called when user drags and drops a widget.
   * Updates slotItemMap and saves to localStorage.
   */
  const handleSwap = useCallback(
    (event: SwapEvent) => {
      // SwapEvent contains newSlotItemMap with asObject, asMap, asArray
      const newMap = event.newSlotItemMap.asObject;
      console.debug('[useSwapy] Swap event:', newMap);

      setSlotItemMap(newMap);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(newMap));
        console.debug('[useSwapy] Saved layout to localStorage');
      }
    },
    [storageKey]
  );

  /**
   * Get Slotted Items
   *
   * Converts items and slotItemMap into SlottedItem array for rendering.
   * Sorts by slot order.
   */
  const getSlottedItems = useCallback((): SlottedItem[] => {
    const itemsMap = new Map(items.map((item) => [item.id, item]));

    console.debug('[useSwapy] getSlottedItems called with slotItemMap:', slotItemMap);
    console.debug('[useSwapy] Available item IDs:', Array.from(itemsMap.keys()));

    const slottedItems = Object.entries(slotItemMap)
      .sort(([slotA], [slotB]) => slotA.localeCompare(slotB))
      .map(([slotId, itemId]) => {
        if (itemId === null) {
          console.debug(`[useSwapy] Slot "${slotId}" is empty (null)`);
          return { slotId, itemId: null, content: null };
        }

        const item = itemsMap.get(itemId);
        if (!item) {
          console.warn(`[useSwapy] Item "${itemId}" not found for slot "${slotId}"`);
          return { slotId, itemId, content: null };
        }

        console.debug(`[useSwapy] Mapped slot "${slotId}" -> item "${itemId}"`);
        return {
          slotId,
          itemId: item.id,
          content: item.content,
        };
      });

    console.debug('[useSwapy] Returning', slottedItems.length, 'slotted items');
    return slottedItems;
  }, [items, slotItemMap]);

  /**
   * Reset Layout
   *
   * Clears saved layout from localStorage and resets to initial layout.
   */
  const resetLayout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
      setSlotItemMap(initSlotItemMap(items));
      console.debug('[useSwapy] Reset layout to initial state');
    }
  }, [storageKey, items]);

  /**
   * Initialize Swapy
   *
   * Creates Swapy instance with manualSwap mode.
   * Runs once on mount when containerRef is available.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    console.debug('[useSwapy] Initializing Swapy with manualSwap mode');

    // Create Swapy instance with manualSwap
    const swapy = createSwapy(containerRef.current, {
      animation,
      manualSwap: true,
    });

    // Store instance in ref
    swapyRef.current = swapy;

    // Enable drag-and-drop
    swapy.enable(true);

    // Set up swap event listener
    swapy.onSwap(handleSwap);

    console.debug('[useSwapy] Swapy initialized successfully');

    // Cleanup on unmount
    return () => {
      console.debug('[useSwapy] Destroying Swapy instance');
      swapy.destroy();
      swapyRef.current = null;
    };
  }, [animation, handleSwap]);

  return {
    containerRef,
    slotItemMap,
    handleSwap,
    getSlottedItems,
    resetLayout,
  };
}
