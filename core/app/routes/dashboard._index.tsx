/**
 * Dashboard Overview Page
 *
 * Displays dashboard overview with key metrics and activity timeline.
 * Accessible at: /dashboard
 *
 * Features:
 * - Key metrics cards (developers, activities, campaigns, ROI)
 * - Activity timeline chart (Recharts)
 * - Drag-and-drop widget reordering (GridStack)
 * - Dark mode support
 * - Responsive design (mobile/tablet/desktop)
 *
 * Architecture:
 * - Loader: Fetches stats and timeline from API
 * - Components: StatCard, ActivityChart, GridStackContainer
 * - Layout: 12-column grid with responsive widgets
 */

import { type MetaFunction } from '@remix-run/node';
import { useState, useEffect, useRef } from 'react';
import {
  UsersIcon,
  ChartBarIcon,
  MegaphoneIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { GridStackOptions } from 'gridstack';
import {
  GridStackProvider,
  GridStackRenderProvider,
  GridStackRender,
  type ComponentMap,
} from '~/lib/gridstack';
import { StatCard } from '~/components/dashboard/StatCard';
import { ActivityChart } from '~/components/dashboard/ActivityChart';
import { StatWidget } from '~/components/widgets/StatWidget';
import { ListWidget } from '~/components/widgets/ListWidget';
import { TimeseriesWidget } from '~/components/widgets/TimeseriesWidget';
import { TableWidget } from '~/components/widgets/TableWidget';
import { CardWidget } from '~/components/widgets/CardWidget';
import type { WidgetData } from '~/types/widget-api';
import 'gridstack/dist/gridstack.css';

/**
 * Meta function - Sets page title
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'Overview - Dashboard - DevCle' },
    { name: 'description', content: 'Dashboard overview with key metrics' },
  ];
};

/**
 * Overview Data Type
 *
 * Data structure returned by loader.
 */
interface OverviewData {
  stats: {
    totalDevelopers: number;
    totalActivities: number;
    totalCampaigns: number;
    averageROI: number | null;
  };
  timeSeriesData: Array<{
    date: string;
    activities: number;
    developers: number;
  }>;
}

/**
 * Icon Map
 *
 * Maps icon names to actual icon components.
 */
const ICON_MAP = {
  UsersIcon,
  ChartBarIcon,
  MegaphoneIcon,
  CurrencyDollarIcon,
};

/**
 * Wrapper components that handle icon conversion
 */
function StatCardWrapper(props: Parameters<typeof StatCard>[0] & { icon: string }) {
  const IconComponent = ICON_MAP[props.icon as keyof typeof ICON_MAP];
  return <StatCard {...props} icon={IconComponent} />;
}

/**
 * Component Map
 *
 * Maps component names to actual components for GridStack rendering.
 * Includes both standard dashboard widgets and plugin widgets.
 */
const COMPONENT_MAP: ComponentMap = {
  StatCard: StatCardWrapper,
  ActivityChart,
  StatWidget,
  ListWidget,
  TimeseriesWidget,
  TableWidget,
  CardWidget,
};


/**
 * Dashboard Overview Component
 *
 * Renders overview page with statistics cards and activity chart.
 * Uses GridStack for drag-and-drop widget reordering.
 * Fetches data client-side via SPA pattern.
 */
export default function DashboardOverview() {
  // State management
  const [stats, setStats] = useState<OverviewData['stats'] | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<OverviewData['timeSeriesData']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Widget state
  const [widgets, setWidgets] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  // Use ref to store gridOptions and only generate once after data loads
  const gridOptionsRef = useRef<GridStackOptions | null>(null);

  // Fetch data on mount (SPA pattern)
  useEffect(() => {
    async function fetchData() {
      try {
        const [statsResponse, timelineResponse] = await Promise.all([
          fetch('/api/overview/stats'),
          fetch('/api/overview/timeline?days=30'),
        ]);

        if (!statsResponse.ok || !timelineResponse.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const statsData = await statsResponse.json();
        const timelineData = await timelineResponse.json();

        setStats(statsData.stats);
        setTimeSeriesData(timelineData.timeline);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch plugin widgets
  useEffect(() => {
    async function fetchWidgets() {
      try {
        // Fetch available widgets
        const widgetsResponse = await fetch('/api/widgets');
        if (!widgetsResponse.ok) {
          throw new Error('Failed to fetch widgets');
        }

        const widgetsData = await widgetsResponse.json();
        setWidgets(widgetsData.widgets || []);

        // Fetch data for each widget
        const dataPromises = (widgetsData.widgets || []).map(async (widget: { id: string }) => {
          const dataResponse = await fetch(`/api/widgets/${widget.id}/data`);
          if (!dataResponse.ok) {
            console.error(`Failed to fetch data for widget ${widget.id}`);
            return null;
          }
          const data = await dataResponse.json();
          return { id: widget.id, data };
        });

        const results = await Promise.all(dataPromises);
        const dataMap: Record<string, WidgetData> = {};
        for (const result of results) {
          if (result) {
            dataMap[result.id] = result.data;
          }
        }
        setWidgetData(dataMap);
      } catch (err) {
        console.error('Failed to load widgets:', err);
      } finally {
        setWidgetsLoading(false);
      }
    }

    fetchWidgets();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Error state
  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error || 'Failed to load data'}</div>
      </div>
    );
  }

  // Generate gridOptions only once after ALL data loads (stats + widgets)
  // Store in ref to prevent re-initialization on subsequent renders
  if (!gridOptionsRef.current && stats && !widgetsLoading) {
    // Load saved layout from localStorage
    const loadLayout = () => {
      if (typeof window === 'undefined') return null;
      try {
        const saved = localStorage.getItem('overview-layout');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        console.error('Failed to load layout:', e);
        return null;
      }
    };

    const savedLayout = loadLayout();

    // Define base children (standard dashboard widgets)
    const baseChildren = [
      {
        id: 'total-developers',
        w: 3,
        h: 3,
        content: JSON.stringify({
          name: 'StatCard',
          props: {
            testId: 'total-developers',
            label: 'Total Developers',
            value: stats.totalDevelopers,
            icon: 'UsersIcon',
            description: 'Registered developers',
          },
        }),
      },
      {
        id: 'total-activities',
        w: 3,
        h: 3,
        content: JSON.stringify({
          name: 'StatCard',
          props: {
            testId: 'total-activities',
            label: 'Total Activities',
            value: stats.totalActivities,
            icon: 'ChartBarIcon',
            description: 'All tracked activities',
          },
        }),
      },
      {
        id: 'total-campaigns',
        w: 3,
        h: 3,
        content: JSON.stringify({
          name: 'StatCard',
          props: {
            testId: 'total-campaigns',
            label: 'Active Campaigns',
            value: stats.totalCampaigns,
            icon: 'MegaphoneIcon',
            description: 'Running campaigns',
          },
        }),
      },
      {
        id: 'average-roi',
        w: 3,
        h: 3,
        content: JSON.stringify({
          name: 'StatCard',
          props: {
            testId: 'average-roi',
            label: 'Average ROI',
            value:
              stats.averageROI !== null
                ? `${stats.averageROI.toFixed(1)}%`
                : 'N/A',
            icon: 'CurrencyDollarIcon',
            description: 'Campaign ROI average',
          },
        }),
      },
      {
        id: 'activity-chart',
        w: 12,
        h: 6,
        content: JSON.stringify({
          name: 'ActivityChart',
          props: {
            data: timeSeriesData,
          },
        }),
      },
    ];

    // Add plugin widgets to children
    // Plugin widgets are rendered using their own components (StatWidget, ListWidget, etc.)
    const pluginWidgetChildren = widgets.map((widget) => {
      const data = widgetData[widget.id];
      if (!data) {
        // Widget data not loaded yet, skip
        return null;
      }

      // Determine widget component name based on type
      const componentName =
        data.type === 'stat' ? 'StatWidget' :
        data.type === 'list' ? 'ListWidget' :
        data.type === 'timeseries' ? 'TimeseriesWidget' :
        data.type === 'table' ? 'TableWidget' :
        data.type === 'card' ? 'CardWidget' :
        null;

      if (!componentName) {
        console.warn(`Unknown widget type: ${data.type}`);
        return null;
      }

      // Default sizes based on widget type to match standard widgets
      // stat: 3 height to match standard StatCard (Total Developers, etc.)
      // list: 5 height for list items
      // timeseries/table: 6 height for charts and tables
      // card: 4 height for card content
      const defaultWidth = data.type === 'timeseries' ? 12 : data.type === 'table' ? 12 : 4;
      const defaultHeight = data.type === 'timeseries' ? 6 : data.type === 'table' ? 6 : data.type === 'list' ? 5 : data.type === 'stat' ? 3 : 4;

      return {
        id: `plugin-${widget.id}`,
        w: defaultWidth,
        h: defaultHeight,
        content: JSON.stringify({
          name: componentName,
          props: {
            data,
          },
        }),
      };
    }).filter((child): child is NonNullable<typeof child> => child !== null); // Remove null entries and type guard

    // Merge standard and plugin widgets
    const allChildren = [...baseChildren, ...pluginWidgetChildren];

    // Apply saved layout if available
    const children = savedLayout
      ? allChildren.map((child) => {
          const saved = savedLayout[child.id || ''];
          if (saved) {
            return {
              ...child,
              x: saved.x,
              y: saved.y,
              w: saved.w,
              h: saved.h,
            };
          }
          return child;
        })
      : allChildren;

    gridOptionsRef.current = {
      column: 12,
      cellHeight: 80,
      animate: true,
      float: false,
      children,
    };
  }

  const gridOptions = gridOptionsRef.current || {
    column: 12,
    cellHeight: 80,
    animate: true,
    float: false,
    children: [],
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Key metrics and insights for your DevRel activities
        </p>
      </div>

      {/* GridStack Dashboard - Includes both standard and plugin widgets */}
      <GridStackProvider initialOptions={gridOptions}>
        <GridStackRenderProvider>
          <GridStackRender componentMap={COMPONENT_MAP} />
        </GridStackRenderProvider>
      </GridStackProvider>
    </div>
  );
}
