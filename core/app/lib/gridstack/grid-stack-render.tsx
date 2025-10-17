import { createPortal } from "react-dom";
import { useGridStackContext } from "./grid-stack-context";
import { useGridStackRenderContext } from "./grid-stack-render-context";
import { GridStackWidgetContext } from "./grid-stack-widget-context";
import { GridStackWidget } from "gridstack";
import { ComponentType, useEffect, useState } from "react";

export interface ComponentDataType<T = object> {
  name: string;
  props: T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentMap = Record<string, ComponentType<any>>;

function parseWeightMetaToComponentData(
  meta: GridStackWidget
): ComponentDataType & { error: unknown } {
  let error = null;
  let name = "";
  let props = {};
  try {
    if (meta.content) {
      const result = JSON.parse(meta.content) as {
        name: string;
        props: object;
      };
      name = result.name;
      props = result.props;
    }
  } catch (e) {
    error = e;
  }
  return {
    name,
    props,
    error,
  };
}

export function GridStackRender(props: { componentMap: ComponentMap }) {
  const { _rawWidgetMetaMap, _gridStack } = useGridStackContext();
  const { getWidgetContainer } = useGridStackRenderContext();
  const [, forceUpdate] = useState(0);

  // Force re-render when grid is initialized
  useEffect(() => {
    if (_gridStack.value) {
      // Give GridStack time to create widget containers
      setTimeout(() => {
        forceUpdate(prev => prev + 1);
      }, 100);
    }
  }, [_gridStack.value]);

  // Don't render until GridStack is initialized
  if (!_gridStack.value) {
    return null;
  }

  return (
    <>
      {Array.from(_rawWidgetMetaMap.value.entries()).map(([id, meta]) => {
        const componentData = parseWeightMetaToComponentData(meta);

        if (componentData.error) {
          console.error(`Failed to parse widget metadata for id: ${id}`, componentData.error);
          return null;
        }

        const WidgetComponent = props.componentMap[componentData.name];

        if (!WidgetComponent) {
          console.error(`Component not found in componentMap: ${componentData.name}`, {
            availableComponents: Object.keys(props.componentMap),
            componentData,
          });
          return null;
        }

        const widgetContainer = getWidgetContainer(id);

        if (!widgetContainer) {
          return null;
        }

        return (
          <GridStackWidgetContext.Provider key={id} value={{ widget: { id } }}>
            {createPortal(
              <WidgetComponent {...componentData.props} />,
              widgetContainer
            )}
          </GridStackWidgetContext.Provider>
        );
      })}
    </>
  );
}
