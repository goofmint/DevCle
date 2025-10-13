/**
 * Activity Service - Developer Activity Management
 *
 * Provides business logic for recording and retrieving developer activities.
 * Activities are the foundation of DevRel analytics, tracking all developer actions.
 *
 * Architecture:
 * - Remix loader/action -> Activity Service -> Drizzle ORM -> PostgreSQL
 * - All functions are async and return Promise
 * - RLS (Row Level Security) enforced for tenant isolation
 * - Time-series data with optimized indexes
 *
 * This is a barrel file that re-exports all Activity Service functions.
 */

// Export schemas
export {
  CreateActivitySchema,
  ListActivitiesSchema,
  UpdateActivitySchema,
  type CreateActivityInput,
  type ListActivitiesInput,
  type UpdateActivityInput,
} from './activity.schemas.js';

// Export CRUD operations
export { createActivity } from './activity-create.service.js';
export { listActivities } from './activity-list.service.js';
export { updateActivity } from './activity-update.service.js';
export { deleteActivity } from './activity-delete.service.js';
