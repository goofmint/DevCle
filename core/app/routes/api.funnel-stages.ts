/**
 * Funnel Stages API Route (Temporary)
 *
 * Returns hardcoded funnel stages for Activity Types page.
 * TODO: Implement proper service layer with database queries
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/auth.middleware.js';

/**
 * GET /api/funnel-stages
 *
 * Returns list of funnel stages
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Require authentication
    await requireAuth(request);

    // Return hardcoded funnel stages (temporary)
    const funnelStages = [
      {
        funnelStageId: '1',
        stageKey: 'awareness',
        stageName: 'Awareness',
      },
      {
        funnelStageId: '2',
        stageKey: 'engagement',
        stageName: 'Engagement',
      },
      {
        funnelStageId: '3',
        stageKey: 'adoption',
        stageName: 'Adoption',
      },
      {
        funnelStageId: '4',
        stageKey: 'advocacy',
        stageName: 'Advocacy',
      },
    ];

    return json({ funnelStages });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Failed to get funnel stages:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
