/**
 * Campaign ROI API - ROI Calculation Route
 *
 * Handles ROI (Return on Investment) calculation for a specific campaign.
 *
 * Endpoints:
 * - GET /api/campaigns/:id/roi - Get campaign ROI calculation
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';
import { calculateROI } from '../../../services/roi.service.js';
import { z } from 'zod';

/**
 * UUID validation schema
 * Used to validate campaign ID format before processing
 */
const UuidSchema = z.string().uuid();

/**
 * GET /api/campaigns/:id/roi - Get campaign ROI
 *
 * Path Parameters:
 * - id: Campaign ID (UUID)
 *
 * Response:
 * 200 OK
 * {
 *   campaignId: "...",
 *   campaignName: "...",
 *   totalCost: "50000.00",
 *   totalValue: "75000.00",
 *   roi: 50.0,
 *   activityCount: 120,
 *   developerCount: 45,
 *   calculatedAt: "2025-10-15T00:00:00.000Z"
 * }
 *
 * ROI Interpretation:
 * - roi > 0: Positive return (successful campaign)
 * - roi = 0: Break-even point
 * - roi < 0: Negative return (loss)
 * - roi = null: Cannot calculate (totalCost is 0, division by zero)
 *
 * Error Responses:
 * - 400 Bad Request: Invalid campaign ID format
 * - 401 Unauthorized: Missing or invalid authentication
 * - 404 Not Found: Campaign not found
 * - 500 Internal Server Error: Database error
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Authentication check using requireAuth middleware
    const user = await requireAuth(request);
    const tenantId = user.tenantId;

    // 2. Extract campaign ID from URL params
    const campaignId = params['id'];

    // Validate that ID was provided in URL
    if (!campaignId) {
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // 3. Validate campaign ID format (must be valid UUID)
    try {
      UuidSchema.parse(campaignId);
    } catch (validationError) {
      return json({ error: 'Invalid campaign ID format' }, { status: 400 });
    }

    // 4. Call ROI service to calculate ROI for the campaign
    // This function returns null if the campaign is not found
    const result = await calculateROI(tenantId, campaignId);

    // 5. If campaign not found, return 404
    if (!result) {
      return json({ error: 'Campaign not found' }, { status: 404 });
    }

    // 6. Return success response with ROI data
    return json(result, { status: 200 });
  } catch (error) {
    // Handle errors and return appropriate HTTP status codes

    // Handle requireAuth() redirect
    if (error instanceof Response && error.status === 302) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle service layer errors
    if (error instanceof Error) {
      // Check for specific error messages from service layer

      // Campaign not found
      if (error.message.includes('not found')) {
        return json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Log detailed error for debugging
      console.error('Failed to calculate ROI:', error);

      // Return generic error message to client
      return json({ error: 'Failed to calculate ROI' }, { status: 500 });
    }

    // Handle unexpected errors
    console.error('Unexpected error in GET /api/campaigns/:id/roi:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
