/**
 * ROI Service
 *
 * Barrel file that re-exports all ROI-related functions and types.
 *
 * Usage:
 * ```typescript
 * import { calculateROI, getCampaignCost, getCampaignValue } from './roi.service.js';
 * ```
 */

// Export all functions
export { calculateROI } from './roi-calculate.service.js';
export { getCampaignCost } from './roi-cost.service.js';
export { getCampaignValue } from './roi-value.service.js';

// Export types and schemas
export type { CampaignROI } from './roi.schemas.js';
export { CampaignROISchema } from './roi.schemas.js';
