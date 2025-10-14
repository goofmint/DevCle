/**
 * Campaign Service - Barrel File
 *
 * Re-exports all campaign service functions and schemas.
 * This provides a clean API for consumers who can import everything from a single module.
 *
 * Usage:
 * ```typescript
 * import {
 *   createCampaign,
 *   getCampaign,
 *   listCampaigns,
 *   updateCampaign,
 *   deleteCampaign,
 *   CreateCampaignSchema,
 *   ListCampaignsSchema,
 *   UpdateCampaignSchema,
 * } from './campaign.service.js';
 * ```
 */

// Export all schemas and types
export {
  CreateCampaignSchema,
  ListCampaignsSchema,
  UpdateCampaignSchema,
  type CreateCampaignInput,
  type CreateCampaignData,
  type ListCampaignsInput,
  type ListCampaignsParams,
  type UpdateCampaignInput,
} from './campaign.schemas.js';

// Export all service functions
export { createCampaign } from './campaign-create.service.js';
export { getCampaign } from './campaign-get.service.js';
export { listCampaigns } from './campaign-list.service.js';
export { updateCampaign } from './campaign-update.service.js';
export { deleteCampaign } from './campaign-delete.service.js';
