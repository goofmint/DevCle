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
    </div>
  );
}
