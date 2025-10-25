/**
 * Dashboard Funnel Analysis Page
 *
 * Route: /dashboard/funnel
 *
 * Displays funnel visualization with:
 * - Overall funnel chart (4 stages: Awareness → Engagement → Adoption → Advocacy)
 * - Drop rate between stages
 * - Time series chart (daily/weekly/monthly)
 *
 * Features:
 * - Recharts visualization for funnel and time series
 * - Time period selector (daily/weekly/monthly)
 * - Dark mode support
 * - Responsive design (mobile/tablet/desktop)
 *
 * Architecture:
 * - SPA Pattern: Fetches data client-side via API calls
 * - Components: FunnelChart, DropRateCard, TimeSeriesChart
 * - Layout: Vertical stack with funnel, drop rates, and timeline sections
 */

import { type MetaFunction } from '@remix-run/node';
import { useState, useEffect } from 'react';
import { FunnelChart } from '~/components/funnel/FunnelChart.tsx';
import { DropRateCard } from '~/components/funnel/DropRateCard.tsx';
import { TimeSeriesChart } from '~/components/funnel/TimeSeriesChart.tsx';

/**
 * Meta function - Sets page title
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'Funnel Analysis - Dashboard - DevCle' },
    { name: 'description', content: 'Developer journey funnel analysis' },
  ];
};

/**
 * Funnel stage data structure
 */
interface FunnelStage {
  stage: 'awareness' | 'engagement' | 'adoption' | 'advocacy';
  stageName: string;
  count: number;
  dropRate: number | null; // null for first stage (awareness)
}

/**
 * Funnel statistics returned from API
 */
interface FunnelStats {
  stages: FunnelStage[];
  totalDevelopers: number;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
}

/**
 * Time series data point
 */
interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  awareness: number;
  engagement: number;
  adoption: number;
  advocacy: number;
}

/**
 * Funnel Analysis Page Component
 *
 * Renders funnel visualization with charts and statistics.
 * Uses SPA pattern to fetch data client-side via API calls.
 */
export default function FunnelPage() {
  // State management for funnel statistics
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch funnel statistics and initial timeline data on mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch both funnel stats and timeline data in parallel
        const [funnelResponse, timelineResponse] = await Promise.all([
          fetch('/api/funnel'),
          fetch(`/api/funnel/timeline?interval=${interval}`),
        ]);

        // Check funnel response
        if (!funnelResponse.ok) {
          throw new Error(`Failed to fetch funnel statistics: ${funnelResponse.status}`);
        }

        // Check timeline response (non-fatal, just log error)
        if (!timelineResponse.ok) {
          console.error('Failed to fetch timeline data:', timelineResponse.status);
        }

        // Parse responses
        const funnelData: FunnelStats = await funnelResponse.json();
        const timelineData: TimeSeriesDataPoint[] = timelineResponse.ok
          ? await timelineResponse.json()
          : [];

        // Update state
        setFunnelStats(funnelData);
        setTimeSeriesData(timelineData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load funnel statistics');
      } finally {
        // Always clear loading state when initial fetch completes
        setLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  // Fetch time series data when interval changes (after initial load)
  useEffect(() => {
    // Skip initial load (handled by fetchInitialData above)
    if (loading) {
      return;
    }

    async function fetchTimeSeries() {
      try {
        const response = await fetch(`/api/funnel/timeline?interval=${interval}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch timeline data: ${response.status}`);
        }

        const data: TimeSeriesDataPoint[] = await response.json();
        setTimeSeriesData(data);
      } catch (err) {
        console.error('Failed to fetch timeline data:', err);
        setTimeSeriesData([]);
      }
    }

    fetchTimeSeries();
  }, [interval, loading]);

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Funnel Analysis
        </h1>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading funnel data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !funnelStats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Funnel Analysis
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
            Error
          </h2>
          <p className="text-red-600 dark:text-red-300">
            {error || 'Failed to load funnel data'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Funnel Analysis
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Developer journey from Awareness to Advocacy
        </p>
      </div>

      {/* Funnel Chart Section */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Developer Funnel
          </h2>
          <FunnelChart
            data={funnelStats.stages.map((stage) => ({
              stage: stage.stage,
              stageName: stage.stageName,
              count: stage.count,
            }))}
          />
        </div>
      </div>

      {/* Drop Rate Cards Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Drop Rates by Stage
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {funnelStats.stages
            .filter((stage) => stage.dropRate !== null)
            .map((stage, index) => {
              // Get previous stage name for display
              const previousStage = funnelStats.stages[index];
              const currentStage = stage;

              return (
                <DropRateCard
                  key={currentStage.stage}
                  fromStage={previousStage?.stageName || ''}
                  toStage={currentStage.stageName}
                  dropRate={currentStage.dropRate || 0}
                />
              );
            })}
        </div>
      </div>

      {/* Time Series Chart Section */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Funnel Progression Over Time
            </h2>
          </div>
          <TimeSeriesChart
            data={timeSeriesData}
            interval={interval}
            onIntervalChange={setInterval}
          />
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
          Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Total Developers
            </p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {funnelStats.totalDevelopers}
            </p>
          </div>
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Conversion Rate (Awareness → Advocacy)
            </p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {funnelStats.totalDevelopers > 0
                ? ((funnelStats.stages[3]?.count || 0) / funnelStats.totalDevelopers * 100).toFixed(1)
                : '0.0'}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
