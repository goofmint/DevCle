import { useState } from 'react';
import { Icon } from '@iconify/react';

/**
 * Props for IconPicker component
 */
interface IconPickerProps {
  /** Current Iconify icon name (e.g., 'heroicons:bolt') */
  value: string;
  /** Callback when icon is changed */
  onChange: (iconName: string) => void;
}

/**
 * Icon Picker Component
 *
 * Features:
 * - Grid layout for browsing icons
 * - Search functionality
 * - Categorized icon sets (heroicons, mdi, material-symbols)
 * - Live icon preview
 * - Popular icons section
 *
 * Implementation:
 * - Custom grid-based UI (no external icon picker library)
 * - Uses @iconify/react for icon rendering
 * - Search filters icons by name
 * - Responsive grid layout
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter icons based on search query
  const filteredIcons = ALL_ICONS.filter((iconName) =>
    iconName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Icon Name Input (Read-only, click to open picker) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Icon
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            readOnly
            onClick={() => setIsPickerOpen(true)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Click to select icon"
          />
          {/* Icon Preview */}
          {value && (
            <div className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
              <Icon
                icon={value}
                className="w-6 h-6 text-gray-700 dark:text-gray-300"
                data-testid="icon-preview"
              />
            </div>
          )}
        </div>
      </div>

      {/* Icon Picker Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Select Icon
              </h3>
              <button
                onClick={() => {
                  setIsPickerOpen(false);
                  setSearchQuery('');
                }}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search icons..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Icon Grid */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-8 gap-2">
                {filteredIcons.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onChange(iconName);
                      setIsPickerOpen(false);
                      setSearchQuery('');
                    }}
                    className={`p-3 border rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors ${
                      value === iconName
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    title={iconName}
                  >
                    <Icon icon={iconName} className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  </button>
                ))}
              </div>
              {filteredIcons.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No icons found matching "{searchQuery}"
                </div>
              )}
            </div>

            {/* Results Count */}
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredIcons.length} of {ALL_ICONS.length} icons
            </div>
          </div>
        </div>
      )}

      {/* Popular Icon Suggestions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Popular Icons
        </label>
        <div className="flex flex-wrap gap-2">
          {POPULAR_ICONS.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={`p-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                value === iconName
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              title={iconName}
            >
              <Icon icon={iconName} className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Popular Icons (suggestions)
 *
 * Commonly used icons for activity types
 */
const POPULAR_ICONS = [
  'heroicons:cursor-arrow-rays',
  'heroicons:calendar-days',
  'heroicons:user-plus',
  'heroicons:chat-bubble-left-right',
  'heroicons:star',
  'heroicons:code-bracket',
  'heroicons:bolt',
  'mdi:github',
  'mdi:slack',
  'material-symbols:event',
] as const;

/**
 * All Available Icons
 *
 * Curated list of commonly used icons from popular icon sets
 */
const ALL_ICONS = [
  // Heroicons - Actions
  'heroicons:bolt',
  'heroicons:cursor-arrow-rays',
  'heroicons:hand-raised',
  'heroicons:hand-thumb-up',
  'heroicons:heart',
  'heroicons:star',
  'heroicons:chat-bubble-left-right',
  'heroicons:code-bracket',
  'heroicons:command-line',
  'heroicons:document-text',
  'heroicons:pencil-square',
  'heroicons:trash',

  // Heroicons - People & Organizations
  'heroicons:user',
  'heroicons:user-plus',
  'heroicons:user-group',
  'heroicons:users',
  'heroicons:building-office',
  'heroicons:academic-cap',

  // Heroicons - Calendar & Time
  'heroicons:calendar',
  'heroicons:calendar-days',
  'heroicons:clock',

  // Heroicons - Communication
  'heroicons:at-symbol',
  'heroicons:bell',
  'heroicons:envelope',
  'heroicons:megaphone',
  'heroicons:microphone',
  'heroicons:phone',
  'heroicons:speaker-wave',

  // Heroicons - Media & Files
  'heroicons:camera',
  'heroicons:document',
  'heroicons:film',
  'heroicons:photo',
  'heroicons:video-camera',
  'heroicons:musical-note',

  // Heroicons - Technology
  'heroicons:computer-desktop',
  'heroicons:device-phone-mobile',
  'heroicons:globe-alt',
  'heroicons:link',
  'heroicons:rocket-launch',
  'heroicons:server',
  'heroicons:wifi',

  // Material Design Icons (mdi) - Popular
  'mdi:github',
  'mdi:gitlab',
  'mdi:slack',
  'mdi:discord',
  'mdi:twitter',
  'mdi:facebook',
  'mdi:linkedin',
  'mdi:youtube',
  'mdi:instagram',
  'mdi:reddit',
  'mdi:stackoverflow',
  'mdi:dev-to',
  'mdi:nodejs',
  'mdi:react',
  'mdi:vuejs',
  'mdi:docker',
  'mdi:kubernetes',
  'mdi:aws',
  'mdi:google-cloud',
  'mdi:microsoft-azure',

  // Material Design Icons - Actions
  'mdi:account-plus',
  'mdi:comment',
  'mdi:download',
  'mdi:upload',
  'mdi:share',
  'mdi:bookmark',
  'mdi:flag',
  'mdi:message',
  'mdi:email',

  // Material Symbols - General
  'material-symbols:event',
  'material-symbols:work',
  'material-symbols:school',
  'material-symbols:campaign',
  'material-symbols:handshake',
  'material-symbols:trending-up',
  'material-symbols:analytics',
  'material-symbols:dashboard',
  'material-symbols:settings',
  'material-symbols:search',
  'material-symbols:home',
  'material-symbols:article',
  'material-symbols:forum',
  'material-symbols:groups',
  'material-symbols:public',

  // Business & Marketing
  'mdi:bullhorn',
  'mdi:chart-line',
  'mdi:target',
  'mdi:trophy',
  'mdi:gift',
  'mdi:cash',
  'mdi:credit-card',

  // Development & Code
  'mdi:code-braces',
  'mdi:console',
  'mdi:git',
  'mdi:source-branch',
  'mdi:source-merge',
  'mdi:bug',
  'mdi:test-tube',

  // Additional Popular Actions
  'heroicons:arrow-down-tray',
  'heroicons:arrow-up-tray',
  'heroicons:bookmark',
  'heroicons:check-circle',
  'heroicons:eye',
  'heroicons:flag',
  'heroicons:gift',
  'heroicons:light-bulb',
  'heroicons:sparkles',
  'heroicons:trophy',
];
