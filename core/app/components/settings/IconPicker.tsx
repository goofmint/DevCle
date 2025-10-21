import { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import IconifyPicker from '@zunicornshift/mui-iconify-picker';
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
 * Library: @zunicornshift/mui-iconify-picker
 * Docs: https://www.npmjs.com/package/@zunicornshift/mui-iconify-picker
 *
 * Features:
 * - Search input for icon name
 * - Icon preview with live rendering
 * - Popular icon sets (heroicons, mdi, material-symbols, etc.)
 * - Grid layout for browsing
 * - 200,000+ icons from Iconify
 * - Recently used icons
 *
 * Implementation:
 * - Use IconifyPicker component from @zunicornshift/mui-iconify-picker
 * - MUI-based UI (requires @mui/material)
 * - Built-in search and filter functionality
 * - Automatic icon preview
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Create MUI theme for dark mode support
  const theme = createTheme({
    palette: {
      mode: 'light', // Will be controlled by Tailwind dark mode
    },
  });

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

      {/* IconifyPicker Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Select Icon
              </h3>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            <ThemeProvider theme={theme}>
              <IconifyPicker
                value={value}
                onChange={(icon: string | null) => {
                  if (icon) {
                    onChange(icon);
                    setIsPickerOpen(false);
                  }
                }}
              />
            </ThemeProvider>
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
