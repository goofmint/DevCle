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
        stageKey: 'awareness',
        title: 'Awareness',
      },
      {
        stageKey: 'engagement',
        title: 'Engagement',
      },
      {
        stageKey: 'adoption',
        title: 'Adoption',
      },
      {
        stageKey: 'advocacy',
        title: 'Advocacy',
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
