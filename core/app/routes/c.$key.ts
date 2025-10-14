/**
 * Shortlink Redirect Route
 *
 * Handles shortlink redirects and click tracking.
 *
 * URL: /c/{key}
 * Method: GET
 *
 * Flow:
 * 1. Extract key from URL params
 * 2. Lookup shortlink by key
 * 3. If not found, return 404
 * 4. Create activity record with action="click", source="shortlink"
 * 5. Redirect to target URL
 *
 * Tenant resolution:
 * - Extract tenant from request hostname (e.g., "example.devcle.com" → "example")
 * - Default to "default" tenant for devcle.com
 *
 * Anonymous tracking:
 * - Read anon_id from cookie (if exists)
 * - Generate new anon_id if not exists (using nanoid)
 * - Set anon_id cookie with 1-year expiration
 *
 * Click attribution (via Activity Service):
 * - action: "click"
 * - source: "shortlink"
 * - resourceId: shortlink.resource_id (blog post, etc.)
 * - metadata: { shortlink_id, campaign_id, user_agent, referer, ip_address }
 * - developer_id: set if user is authenticated
 * - anon_id: used for anonymous tracking
 * - dedupKey: "click:{shortlink_id}:{anon_id||developer_id}:{timestamp}"
 *
 * Error handling:
 * - 404: Shortlink not found
 * - 500: Database error (log error, show generic error page)
 * - Click tracking failure: Log error but continue with redirect (don't block user)
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { getShortlinkByKey } from '../../services/shortlink.service.js';
import { createActivity } from '../../services/activity.service.js';
import { generateShortlinkKey } from '../../utils/nanoid.js';

/**
 * ANON_ID_COOKIE_NAME
 *
 * Cookie name for anonymous user tracking.
 * This cookie persists for 1 year to track unique visitors across shortlink clicks.
 */
const ANON_ID_COOKIE_NAME = 'drm_anon_id';

/**
 * ANON_ID_MAX_AGE
 *
 * Cookie expiration time in seconds (1 year).
 */
const ANON_ID_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

/**
 * Extract Tenant ID from Request Hostname
 *
 * Extracts tenant ID from request hostname.
 * - "example.devcle.com" → "example"
 * - "devcle.com" → "default"
 * - "localhost" → "default"
 *
 * @param request - Request object
 * @returns Tenant ID
 */
function getTenantIdFromRequest(request: Request): string {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // For localhost or devcle.com, use default tenant
  if (hostname === 'localhost' || hostname === 'devcle.com') {
    return 'default';
  }

  // For subdomain.devcle.com, extract subdomain as tenant ID
  if (hostname.endsWith('.devcle.com')) {
    const subdomain = hostname.replace('.devcle.com', '');
    return subdomain;
  }

  // Default fallback
  return 'default';
}

/**
 * Get Anonymous ID from Cookie or Generate New One
 *
 * Reads anon_id from cookie. If not exists, generates a new one using nanoid.
 *
 * @param request - Request object
 * @returns Anonymous ID
 */
function getOrCreateAnonId(request: Request): string {
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === ANON_ID_COOKIE_NAME && value) {
        return value;
      }
    }
  }

  // Generate new anon_id
  return generateShortlinkKey(); // Reuse nanoid with 8 characters
}

/**
 * Shortlink Redirect Loader
 *
 * Handles GET requests to /c/{key}.
 *
 * @param params - URL params containing key
 * @param request - Request object
 * @returns Redirect response with Set-Cookie header
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  try {
    // 1. Extract key from URL params
    const key = params['key'];
    if (!key) {
      throw new Response('Shortlink key is required', { status: 400 });
    }

    // 2. Extract tenant from hostname
    const tenantId = getTenantIdFromRequest(request);

    // 3. Get shortlink by key
    const shortlink = await getShortlinkByKey(tenantId, key);
    if (!shortlink) {
      throw new Response('Shortlink not found', { status: 404 });
    }

    // 4. Get or create anonymous ID
    const anonId = getOrCreateAnonId(request);

    // 5. Extract request metadata
    const userAgent = request.headers.get('User-Agent') ?? undefined;
    const referer = request.headers.get('Referer') ?? undefined;
    // Note: In production, use X-Forwarded-For or similar for real IP
    const ip = request.headers.get('X-Forwarded-For') ?? undefined;

    // 6. Create activity record (click tracking)
    // Use try-catch to ensure redirect happens even if activity creation fails
    try {
      await createActivity(tenantId, {
        anonId,
        action: 'click',
        source: 'shortlink',
        resourceId: shortlink.resourceId ?? undefined,
        metadata: {
          shortlink_id: shortlink.shortlinkId,
          campaign_id: shortlink.campaignId,
          user_agent: userAgent,
          referer,
          ip_address: ip,
        },
        occurredAt: new Date(),
      });
    } catch (error) {
      // Log error but continue with redirect
      console.error('Failed to create activity for shortlink click:', error);
    }

    // 7. Redirect to target URL with Set-Cookie header
    const headers = new Headers();
    headers.set('Location', shortlink.targetUrl);
    headers.set(
      'Set-Cookie',
      `${ANON_ID_COOKIE_NAME}=${anonId}; Max-Age=${ANON_ID_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax`
    );

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    // Handle Response objects (404, 400, etc.)
    if (error instanceof Response) {
      throw error;
    }

    // Handle unexpected errors
    console.error('Error in shortlink redirect:', error);
    throw new Response('Internal Server Error', { status: 500 });
  }
}
