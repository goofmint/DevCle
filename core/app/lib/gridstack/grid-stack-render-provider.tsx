import {
  PropsWithChildren,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useGridStackContext } from "./grid-stack-context";
import { GridStack, GridStackOptions, GridStackWidget } from "gridstack";
import { GridStackRenderContext } from "./grid-stack-render-context";
import isEqual from "react-fast-compare";

// WeakMap to store widget containers for each grid instance
export const gridWidgetContainersMap = new WeakMap<GridStack, Map<string, HTMLElement>>();

export function GridStackRenderProvider({ children }: PropsWithChildren) {
  const {
    _gridStack: { value: gridStack, set: setGridStack },
    initialOptions,
  } = useGridStackContext();

  const widgetContainersRef = useRef<Map<string, HTMLElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<GridStackOptions>(initialOptions);

  const renderCBFn = useCallback(
    (element: HTMLElement, widget: GridStackWidget & { grid?: GridStack }) => {
      console.log('[GridStack] renderCBFn called for widget:', widget.id);
      if (widget.id && widget.grid) {
        // Get or create the widget container map for this grid instance
        let containers = gridWidgetContainersMap.get(widget.grid);
        if (!containers) {
          containers = new Map<string, HTMLElement>();
          gridWidgetContainersMap.set(widget.grid, containers);
        }
        containers.set(widget.id, element);

        // Also update the local ref for backward compatibility
        widgetContainersRef.current.set(widget.id, element);
        console.log('[GridStack] Widget container registered:', widget.id);
      }
    },
    []
  );

  const initGrid = useCallback(() => {
    if (containerRef.current) {
      GridStack.renderCB = renderCBFn;
      const grid = GridStack.init(optionsRef.current, containerRef.current);

      // Wait for initialization to complete before adding change listener
      if (grid) {
        setTimeout(() => {
          grid.on('change', () => {
            try {
              const items = grid.getGridItems();
              const layoutMap: Record<string, { x: number; y: number; w: number; h: number }> = {};

              items.forEach((el) => {
                const node = el.gridstackNode;
                if (node?.id) {
                  layoutMap[node.id] = {
                    x: node.x ?? 0,
                    y: node.y ?? 0,
                    w: node.w ?? 1,
                    h: node.h ?? 1,
                  };
                }
              });

              localStorage.setItem('overview-layout', JSON.stringify(layoutMap));
            } catch (e) {
              console.error('[GridStack] Failed to save layout:', e);
            }
          });
        }, 0);
      }

      return grid;
    }
    return null;
  }, [renderCBFn]);

  useLayoutEffect(() => {
    if (!isEqual(initialOptions, optionsRef.current) && gridStack) {
      try {
        gridStack.removeAll(false);
        gridStack.destroy(false);
        widgetContainersRef.current.clear();
        // Clean up the WeakMap entry for this grid instance
        gridWidgetContainersMap.delete(gridStack);
        optionsRef.current = initialOptions;
        setGridStack(initGrid());
      } catch (e) {
        console.error("Error reinitializing gridstack", e);
      }
    }
  }, [initialOptions, gridStack, initGrid, setGridStack]);

  useLayoutEffect(() => {
    if (!gridStack) {
      try {
        setGridStack(initGrid());
      } catch (e) {
        console.error("Error initializing gridstack", e);
      }
    }
  }, [gridStack, initGrid, setGridStack]);

  return (
    <GridStackRenderContext.Provider
      value={useMemo(
        () => ({
          getWidgetContainer: (widgetId: string) => {
            // First try to get from the current grid instance's map
            if (gridStack) {
              const containers = gridWidgetContainersMap.get(gridStack);
              if (containers?.has(widgetId)) {
                return containers.get(widgetId) || null;
              }
            }
            // Fallback to local ref for backward compatibility
            return widgetContainersRef.current.get(widgetId) || null;
          },
        }),
        [gridStack]
      )}
    >
      <div ref={containerRef} className="grid-stack">{gridStack ? children : null}</div>
    </GridStackRenderContext.Provider>
  );
}
