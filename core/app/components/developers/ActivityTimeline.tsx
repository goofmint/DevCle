/**
 * Activity Timeline Component
 *
 * Displays developer's recent activities in timeline format.
 * Shows activity icon, action, source, and timestamp.
 */

import { Icon } from '@iconify/react';

/**
 * Activity type
 */
interface Activity {
  activityId: string;
  action: string;
  source: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  value: string | null;
}

/**
 * Props for ActivityTimeline component
 */
interface ActivityTimelineProps {
  activities: Activity[];
}

/**
 * Get icon name for activity action
 */
function getActivityIconName(action: string): string {
  const icons: Record<string, string> = {
    // Awareness
    click: 'heroicons:eye',
    view: 'heroicons:eye',
    visit: 'heroicons:eye',
    // Engagement
    attend: 'heroicons:user-group',
    post: 'heroicons:chat-bubble-left',
    comment: 'heroicons:chat-bubble-left',
    star: 'heroicons:star',
    follow: 'heroicons:user-plus',
    // Adoption
    signup: 'heroicons:user-circle',
    login: 'heroicons:arrow-right-on-rectangle',
    api_call: 'heroicons:code-bracket',
    // Advocacy
    share: 'heroicons:share',
    speak: 'heroicons:microphone',
    blog: 'heroicons:document-text',
    contribute: 'heroicons:calendar',
  };

  return icons[action] || 'heroicons:information-circle';
}

/**
 * Get color for activity action (based on funnel stage)
 */
function getActivityColor(action: string): string {
  // Awareness (blue)
  if (['click', 'view', 'visit'].includes(action)) {
    return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
  }
  // Engagement (green)
  if (['attend', 'post', 'comment', 'star', 'follow'].includes(action)) {
    return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800';
  }
  // Adoption (yellow)
  if (['signup', 'login', 'api_call'].includes(action)) {
    return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
  }
  // Advocacy (purple)
  if (['share', 'speak', 'blog', 'contribute'].includes(action)) {
    return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800';
  }
  // Default (gray)
  return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
}

/**
 * ActivityTimeline Component
 *
 * Renders activities in timeline format with icons and timestamps.
 */
export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  // Format timestamp to relative time
  const formatTimestamp = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Empty state
  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-12 text-center">
        <Icon
          icon="heroicons:clipboard-document-list"
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3"
        />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No activities yet
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          This developer hasn't performed any activities yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {activities.map((activity) => (
          <div key={activity.activityId} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center ${getActivityColor(
                  activity.action
                )}`}
              >
                <Icon icon={getActivityIconName(activity.action)} className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {activity.action.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      from <span className="font-medium">{activity.source}</span>
                    </p>
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                    {formatTimestamp(activity.occurredAt)}
                  </span>
                </div>

                {/* Metadata (if any) */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                    {Object.entries(activity.metadata).slice(0, 2).map(([key, value]) => (
                      <span key={key} className="inline-block mr-3">
                        <span className="font-medium">{key}:</span> {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
