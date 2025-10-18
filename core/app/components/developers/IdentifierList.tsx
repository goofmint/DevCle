/**
 * Identifier List Component
 *
 * Displays list of developer identifiers (email, GitHub, Twitter, Slack, etc.)
 * Shows platform icon, value, confidence score, and verified badge.
 */

import { Icon } from '@iconify/react';

/**
 * Developer identifier type
 */
interface DeveloperIdentifier {
  identifierId: string;
  kind: string;
  valueNormalized: string;
  confidence: string;
  firstSeen: Date | null;
  lastSeen: Date | null;
}

/**
 * Props for IdentifierList component
 */
interface IdentifierListProps {
  identifiers: DeveloperIdentifier[];
}

/**
 * Get icon name for identifier kind
 */
function getIdentifierIconName(kind: string): string {
  const icons: Record<string, string> = {
    email: 'heroicons:envelope',
    github: 'mdi:github',
    twitter: 'mdi:twitter',
    slack: 'mdi:slack',
    discord: 'mdi:discord',
  };

  return icons[kind] || 'heroicons:clock';
}

/**
 * Get display color for identifier kind
 */
function getIdentifierColor(kind: string): string {
  const colors: Record<string, string> = {
    email: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    github: 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700',
    twitter: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30',
    slack: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
    discord: 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30',
  };

  return colors[kind] || 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
}

/**
 * IdentifierList Component
 *
 * Renders list of developer identifiers with icons and metadata.
 */
export function IdentifierList({ identifiers }: IdentifierListProps) {
  // Format confidence score as percentage
  const formatConfidence = (confidence: string) => {
    const score = parseFloat(confidence) * 100;
    return `${score.toFixed(0)}%`;
  };

  // Empty state
  if (identifiers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Icon
          icon="heroicons:key"
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3"
        />
        <p>No identifiers found for this developer</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {identifiers.map((identifier) => (
        <div
          key={identifier.identifierId}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
        >
          {/* Left: Icon and value */}
          <div className="flex items-center gap-3 flex-1">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${getIdentifierColor(
                identifier.kind
              )}`}
            >
              <Icon icon={getIdentifierIconName(identifier.kind)} className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {identifier.kind}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {identifier.valueNormalized}
              </div>
            </div>
          </div>

          {/* Right: Confidence badge */}
          <div className="flex-shrink-0">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                         ${
                           parseFloat(identifier.confidence) >= 0.9
                             ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                             : parseFloat(identifier.confidence) >= 0.7
                             ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                             : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                         }`}
            >
              {formatConfidence(identifier.confidence)} confidence
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
