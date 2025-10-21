/**
 * ROIBadge Component
 *
 * Displays ROI (Return on Investment) value as a colored badge.
 * Color coding:
 * - Green: ROI > 0 (positive return, successful campaign)
 * - Red: ROI < 0 (negative return, loss)
 * - Gray: ROI = 0 or null (break-even or calculation not possible)
 */

interface ROIBadgeProps {
  /** ROI value as percentage (e.g., 50.5 means 50.5% return) or null if calculation not possible */
  roi: number | null;
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get background and text color classes based on ROI value
 */
function getROIBadgeClass(roi: number | null): string {
  if (roi === null || roi === 0) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
  if (roi > 0) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
}

/**
 * Format ROI value for display
 *
 * Examples:
 * - roi = 50.5 → "+50.5%"
 * - roi = -25.0 → "-25.0%"
 * - roi = 0 → "0%"
 * - roi = null → "N/A"
 */
function formatROI(roi: number | null): string {
  if (roi === null) {
    return 'N/A';
  }
  const sign = roi > 0 ? '+' : '';
  return `${sign}${roi.toFixed(1)}%`;
}

/**
 * Get size-specific padding classes
 */
function getSizeClass(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'px-2 py-0.5 text-xs';
    case 'md':
      return 'px-2.5 py-1 text-sm';
    case 'lg':
      return 'px-3 py-1.5 text-base';
  }
}

export function ROIBadge({ roi, size = 'md' }: ROIBadgeProps) {
  const colorClass = getROIBadgeClass(roi);
  const sizeClass = getSizeClass(size);
  const formattedROI = formatROI(roi);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold ${colorClass} ${sizeClass}`}
      data-testid="roi-badge"
      data-roi={roi !== null ? roi : 'null'}
    >
      {formattedROI}
    </span>
  );
}
