/**
 * Activity Type Schemas
 *
 * Zod validation schemas for activity type operations.
 * Provides strong typing and runtime validation for:
 * - Creating activity types
 * - Updating activity types
 * - Listing activity types with pagination
 */

import { z } from 'zod';

/**
 * Schema for creating an activity type
 *
 * Fields:
 * - action: Activity action name (1-100 characters)
 * - iconName: Iconify icon name (1-255 characters, default: 'heroicons:bolt')
 * - colorClass: Tailwind CSS classes (1-255 characters, default: 'text-gray-600 bg-gray-100 border-gray-200')
 * - stageKey: Optional funnel stage key (must be one of: awareness, engagement, adoption, advocacy)
 */
export const CreateActivityTypeSchema = z.object({
  action: z.string().min(1).max(100),
  iconName: z.string().min(1).max(255).default('heroicons:bolt'),
  colorClass: z.string().min(1).max(255).default('text-gray-600 bg-gray-100 border-gray-200'),
  stageKey: z.enum(['awareness', 'engagement', 'adoption', 'advocacy']).nullable().optional(),
});

/**
 * Schema for updating an activity type
 *
 * All fields are optional. At least one field must be provided.
 *
 * Fields:
 * - iconName: Iconify icon name (1-255 characters)
 * - colorClass: Tailwind CSS classes (1-255 characters)
 * - stageKey: Optional funnel stage key (must be one of: awareness, engagement, adoption, advocacy)
 */
export const UpdateActivityTypeSchema = z.object({
  iconName: z.string().min(1).max(255).optional(),
  colorClass: z.string().min(1).max(255).optional(),
  stageKey: z.enum(['awareness', 'engagement', 'adoption', 'advocacy']).nullable().optional(),
});

/**
 * Schema for listing activity types
 *
 * Fields:
 * - limit: Number of results to return (1-100, default: 50)
 * - offset: Number of results to skip (min: 0, default: 0)
 */
export const ListActivityTypesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * Type definitions
 */
export type CreateActivityType = z.infer<typeof CreateActivityTypeSchema>;
export type UpdateActivityType = z.infer<typeof UpdateActivityTypeSchema>;
export type ListActivityTypes = z.infer<typeof ListActivityTypesSchema>;
