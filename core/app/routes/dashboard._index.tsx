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
 */
const COMPONENT_MAP: ComponentMap = {
  StatCard: StatCardWrapper,
  ActivityChart,
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

  // Generate gridOptions only once after data loads
  // Store in ref to prevent re-initialization on subsequent renders
  if (!gridOptionsRef.current && stats) {
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

    // Define base children
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

    // Apply saved layout if available
    const children = savedLayout
      ? baseChildren.map((child) => {
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
      : baseChildren;

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

  // Helper function to render widget by type
  const renderWidget = (data: WidgetData) => {
    switch (data.type) {
      case 'stat':
        return <StatWidget data={data} />;
      case 'list':
        return <ListWidget data={data} />;
      case 'timeseries':
        return <TimeseriesWidget data={data} />;
      case 'table':
        return <TableWidget data={data} />;
      case 'card':
        return <CardWidget data={data} />;
      default:
        return null;
    }
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

      {/* GridStack Dashboard */}
      <GridStackProvider initialOptions={gridOptions}>
        <GridStackRenderProvider>
          <GridStackRender componentMap={COMPONENT_MAP} />
        </GridStackRenderProvider>
      </GridStackProvider>

      {/* Plugin Widgets Section */}
      {widgets.length > 0 && (
        <div className="space-y-4">
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Plugin Widgets
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Widgets provided by enabled plugins
            </p>
          </div>

          {widgetsLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400">Loading widgets...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {widgets.map((widget) => {
                const data = widgetData[widget.id];
                if (!data) {
                  return (
                    <div
                      key={widget.id}
                      className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="text-gray-500 dark:text-gray-400">
                        Loading {widget.title}...
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={widget.id} className="widget-container">
                    {renderWidget(data)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
