/**
 * Widget API Type Definitions
 *
 * Types for plugin widget system (Task 8.10).
 * Widgets display data from the core database on the dashboard.
 *
 * API Endpoints:
 * - GET /api/widgets - List all available widgets
 * - GET /api/widgets/:widgetId/data - Get widget data
 * - PUT /api/user/widget-layout - Save widget layout
 */

/**
 * Data source definition in plugin.json
 *
 * Declarative specification of what data to query.
 * Core executes the query based on this definition.
 */
export interface WidgetDataSource {
  /** Entity to query (e.g., "developers", "activities", "campaigns") */
  entity: string;

  /** Aggregation definition (for stat/timeseries widgets) */
  aggregation?: {
    /** Aggregation operation */
    op: 'count' | 'sum' | 'avg' | 'min' | 'max';
    /** Field to aggregate (required for sum/avg/min/max) */
    field?: string;
    /** Filter conditions */
    filter?: Record<string, unknown>;
    /** Time bucket (for timeseries) - when set, timestampField is required */
    bucket?: 'hour' | 'day' | 'week' | 'month';
    /**
     * Timestamp field for time-based aggregations
     * Required when bucket is set for timeseries widgets
     * Specifies the concrete timestamp column (e.g., 'occurredAt', 'createdAt')
     * Default: 'occurredAt' for activities table
     */
    timestampField?: string;
  };

  /** Columns to select (for table/list widgets) */
  columns?: string[];

  /** Filter conditions (MUST include "source" to identify plugin data) */
  filter?: Record<string, unknown>;

  /** Sort specification */
  sort?: {
    key: string;
    dir: 'asc' | 'desc';
  };

  /** Limit number of results */
  limit?: number;
}

/**
 * Widget definition from plugin.json
 *
 * Catalog entry for a widget provided by a plugin.
 */
export interface WidgetDefinition {
  /** Widget key (unique within plugin, e.g., "stats.signups") */
  key: string;

  /** Widget type */
  type: 'stat' | 'table' | 'list' | 'timeseries' | 'card';

  /** Widget title */
  title: string;

  /** Schema version */
  version: string;

  /** Data source definition (how to query data) */
  dataSource: WidgetDataSource;
}

/**
 * Stat widget data
 *
 * Displays a single numeric value with optional trend.
 */
export interface StatWidgetData {
  /** Schema version */
  version: string;

  /** Widget type discriminator */
  type: 'stat';

  /** Widget title */
  title: string;

  /** Stat data */
  data: {
    /** Numeric value to display */
    value: number;

    /** Trend indicator */
    trend?: {
      /** Trend value (e.g., percentage change) */
      value: number;
      /** Trend direction */
      direction: 'up' | 'down';
    };

    /** Trend label (e.g., "vs yesterday") */
    label?: string;
  };

  /** Refresh hint in seconds (optional, for caching) */
  refreshHintSec?: number;
}

/**
 * Table widget data
 *
 * Displays tabular data with sortable columns.
 */
export interface TableWidgetData {
  /** Schema version */
  version: string;

  /** Widget type discriminator */
  type: 'table';

  /** Widget title */
  title: string;

  /** Table data */
  data: {
    /** Column definitions */
    columns: Array<{
      key: string;
      label: string;
      align?: 'left' | 'center' | 'right';
    }>;

    /** Row data */
    rows: Array<Record<string, string | number>>;
  };

  /** Refresh hint in seconds (optional, for caching) */
  refreshHintSec?: number;
}

/**
 * Timeseries widget data
 *
 * Displays time-series data as a line chart.
 */
export interface TimeseriesWidgetData {
  /** Schema version */
  version: string;

  /** Widget type discriminator */
  type: 'timeseries';

  /** Widget title */
  title: string;

  /** Timeseries data */
  data: {
    /** Time interval granularity */
    interval: 'hour' | 'day' | 'week' | 'month';

    /** Data series (multiple lines on same chart) */
    series: Array<{
      /** Series label */
      label: string;

      /** Data points as [timestamp, value] tuples */
      points: Array<[string, number]>;
    }>;
  };

  /** Refresh hint in seconds (optional, for caching) */
  refreshHintSec?: number;
}

/**
 * List widget data
 *
 * Displays a list of items with optional links.
 */
export interface ListWidgetData {
  /** Schema version */
  version: string;

  /** Widget type discriminator */
  type: 'list';

  /** Widget title */
  title: string;

  /** List data */
  data: {
    /** List items */
    items: Array<{
      /** Item ID */
      id: string;

      /** Item title */
      title: string;

      /** Item description */
      description?: string;

      /** Item timestamp (ISO 8601) */
      timestamp?: string;

      /** Link URL (optional) */
      link?: string;
    }>;
  };

  /** Refresh hint in seconds (optional, for caching) */
  refreshHintSec?: number;
}

/**
 * Card widget data
 *
 * Displays free-form content with optional actions.
 */
export interface CardWidgetData {
  /** Schema version */
  version: string;

  /** Widget type discriminator */
  type: 'card';

  /** Widget title */
  title: string;

  /** Card data */
  data: {
    /** Card content (markdown or plain text) */
    content: string;

    /** Action buttons */
    actions?: Array<{
      /** Button label */
      label: string;

      /** Button URL */
      url: string;

      /** Button variant */
      variant?: 'primary' | 'secondary';
    }>;
  };

  /** Refresh hint in seconds (optional, for caching) */
  refreshHintSec?: number;
}

/**
 * Union type for all widget data types
 */
export type WidgetData =
  | StatWidgetData
  | TableWidgetData
  | TimeseriesWidgetData
  | ListWidgetData
  | CardWidgetData;

/**
 * Widget summary (catalog entry)
 *
 * Lightweight widget info for list endpoints.
 */
export interface WidgetSummary {
  /** Widget ID (format: "pluginId:widgetKey") */
  id: string;

  /** Plugin ID */
  pluginId: string;

  /** Widget key */
  key: string;

  /** Widget type */
  type: string;

  /** Widget title */
  title: string;

  /** Schema version */
  version: string;
}

/**
 * Widget list response
 *
 * Response format for GET /api/widgets
 */
export interface GetWidgetsResponse {
  /** Available widgets */
  widgets: WidgetSummary[];
}

/**
 * Widget layout settings
 *
 * User-specific layout configuration (Swapy format).
 * Stored in user_preferences table with key='widget_layout'.
 */
export type WidgetLayoutSettings = Record<string, string>;

/**
 * Save widget layout request
 *
 * Request format for PUT /api/user/widget-layout
 */
export interface SaveWidgetLayoutRequest {
  /** Widget layout (Swapy format) */
  layout: WidgetLayoutSettings;
}

/**
 * Save widget layout response
 *
 * Response format for PUT /api/user/widget-layout
 */
export interface SaveWidgetLayoutResponse {
  /** Success status */
  success: boolean;
}
