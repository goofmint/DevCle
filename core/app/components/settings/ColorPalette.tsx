// Import CirclePicker as default export (react-color is CommonJS)
import CirclePicker from 'react-color/lib/components/circle/Circle';
import type { ColorResult } from 'react-color';

/**
 * Props for ColorPalette component
 */
interface ColorPaletteProps {
  /** Current Tailwind CSS classes (e.g., 'text-blue-600 bg-blue-100 border-blue-200') */
  value: string;
  /** Callback when color is changed */
  onChange: (colorClass: string) => void;
}

/**
 * Preset Colors (Tailwind-based)
 *
 * Each color has:
 * - hex: Color code for react-color picker
 * - tailwind: Corresponding Tailwind CSS classes for text/bg/border
 * - name: Display name for the color
 */
const PRESET_COLORS = [
  { hex: '#3B82F6', tailwind: 'text-blue-600 bg-blue-100 border-blue-200', name: 'Blue' },
  { hex: '#10B981', tailwind: 'text-green-600 bg-green-100 border-green-200', name: 'Green' },
  { hex: '#8B5CF6', tailwind: 'text-purple-600 bg-purple-100 border-purple-200', name: 'Purple' },
  { hex: '#F97316', tailwind: 'text-orange-600 bg-orange-100 border-orange-200', name: 'Orange' },
  { hex: '#EAB308', tailwind: 'text-yellow-600 bg-yellow-100 border-yellow-200', name: 'Yellow' },
  { hex: '#EF4444', tailwind: 'text-red-600 bg-red-100 border-red-200', name: 'Red' },
  { hex: '#EC4899', tailwind: 'text-pink-600 bg-pink-100 border-pink-200', name: 'Pink' },
  { hex: '#6366F1', tailwind: 'text-indigo-600 bg-indigo-100 border-indigo-200', name: 'Indigo' },
  { hex: '#14B8A6', tailwind: 'text-teal-600 bg-teal-100 border-teal-200', name: 'Teal' },
  { hex: '#6B7280', tailwind: 'text-gray-600 bg-gray-100 border-gray-200', name: 'Gray' },
] as const;

/**
 * Color Palette Component
 *
 * Features:
 * - Use react-color CirclePicker
 * - Preset colors with Tailwind CSS class mapping
 * - Preview badge showing selected color
 * - Click to select
 * - Dark mode support
 *
 * Display:
 * - Color picker with preset colors
 * - Preview badge: <span className={value}>Preview</span>
 * - Selected color name
 */
export function ColorPalette({ value, onChange }: ColorPaletteProps) {
  // Find selected color based on current Tailwind classes
  const selectedColor = PRESET_COLORS.find((c) => c.tailwind === value) || PRESET_COLORS[0];

  /**
   * Handle color change from CirclePicker
   *
   * @param color - Color result from react-color
   */
  const handleColorChange = (color: ColorResult) => {
    const selected = PRESET_COLORS.find((c) => c.hex.toLowerCase() === color.hex.toLowerCase());
    if (selected) {
      onChange(selected.tailwind);
    }
  };

  return (
    <div className="space-y-3">
      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Color
        </label>
        <CirclePicker
          colors={PRESET_COLORS.map((c) => c.hex)}
          color={selectedColor.hex}
          onChangeComplete={handleColorChange}
          width="100%"
        />
      </div>

      {/* Preview Badge */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Preview
        </label>
        <span
          className={`inline-block px-3 py-1 rounded-full border ${value}`}
          data-testid="color-preview"
        >
          Activity Badge
        </span>
      </div>

      {/* Selected Color Name */}
      <div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Selected: <span className="font-medium">{selectedColor.name}</span>
        </span>
      </div>
    </div>
  );
}
