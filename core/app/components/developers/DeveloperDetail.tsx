/**
 * Developer Detail Component
 *
 * Displays detailed information about a developer including:
 * - Basic info (avatar, name, email, bio, organization)
 * - Identifiers (GitHub, Twitter, Slack, etc.)
 * - Activity statistics (funnel stages)
 */

import { IdentifierList } from './IdentifierList';

/**
 * Developer type
 */
interface Developer {
  developerId: string;
  displayName: string;
  primaryEmail: string;
  bio: string | null;
  avatarUrl: string | null;
  organizationId: string | null;
  consentAnalytics: boolean;
  createdAt: Date;
}

/**
 * Organization type
 */
interface Organization {
  organizationId: string;
  name: string;
  domainPrimary: string | null;
}

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
 * Activity statistics type
 */
interface ActivityStats {
  totalActivities: number;
  awarenessCount: number;
  engagementCount: number;
  adoptionCount: number;
  advocacyCount: number;
}

/**
 * Props for DeveloperDetail component
 */
interface DeveloperDetailProps {
  developer: Developer;
  organization: Organization | null;
  identifiers: DeveloperIdentifier[];
  stats: ActivityStats;
}

/**
 * DeveloperDetail Component
 *
 * Renders developer's detailed information in a structured layout.
 */
export function DeveloperDetail({
  developer,
  organization,
  identifiers,
  stats,
}: DeveloperDetailProps) {
  // Generate initials from display name for avatar fallback
  const initials = developer.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Format date to human-readable string
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic info card */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {developer.avatarUrl ? (
              <img
                src={developer.avatarUrl}
                alt={developer.displayName}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900
                           flex items-center justify-center text-blue-600 dark:text-blue-300
                           font-bold text-2xl"
              >
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            {/* Name and badges */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {developer.displayName}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {developer.primaryEmail}
                </p>
              </div>

              {/* Analytics consent badge */}
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                           ${
                             developer.consentAnalytics
                               ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                               : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                           }`}
              >
                {developer.consentAnalytics ? 'Analytics Consented' : 'No Consent'}
              </span>
            </div>

            {/* Bio */}
            {developer.bio && (
              <p className="text-gray-700 dark:text-gray-300 mb-4">{developer.bio}</p>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Organization */}
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Organization:
                </span>{' '}
                {organization ? (
                  <span className="text-gray-600 dark:text-gray-400">
                    {organization.name}
                    {organization.domainPrimary && ` (${organization.domainPrimary})`}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">N/A</span>
                )}
              </div>

              {/* Created date */}
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Created:
                </span>{' '}
                <span className="text-gray-600 dark:text-gray-400">
                  {formatDate(developer.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity statistics card */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Activity Statistics
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total activities */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.totalActivities}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Total
            </div>
          </div>

          {/* Awareness */}
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats.awarenessCount}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Awareness
            </div>
          </div>

          {/* Engagement */}
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats.engagementCount}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              Engagement
            </div>
          </div>

          {/* Adoption */}
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.adoptionCount}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              Adoption
            </div>
          </div>

          {/* Advocacy */}
          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats.advocacyCount}
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400 mt-1">
              Advocacy
            </div>
          </div>
        </div>
      </div>

      {/* Identifiers card */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Identifiers
        </h2>
        <IdentifierList identifiers={identifiers} />
      </div>
    </div>
  );
}
