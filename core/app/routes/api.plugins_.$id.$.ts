/**
 * Plugin Webhook Handler Route
 *
 * Handles incoming webhooks for plugins.
 * Route pattern: /api/plugins/:id/*
 *
 * Workflow:
 * 1. Parse plugin ID and webhook path from URL
 * 2. Look up plugin configuration
 * 3. Match route in plugin.json
 * 4. Load plugin handler code
 * 5. Generate internal plugin token
 * 6. Execute handler in isolated-vm sandbox
 * 7. Log execution result
 * 8. Return HTTP response
 *
 * Security:
 * - Plugin runs in isolated-vm sandbox
 * - Handler code loaded from filesystem
 * - Internal API authentication via HMAC token
 * - External API access limited to capabilities.network
 *
 * Example:
 * POST /api/plugins/github/webhook
 * → Looks up 'github' plugin
 * → Matches route '/webhook' in plugin.json
 * → Executes handler at 'dist/handlers/github-webhook.js'
 */

import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { loadPluginManifest } from '../../plugin-system/types.js';
import { IsolatedVmRunner } from '../../plugin-system/sandbox/isolated-vm-runner.js';
import { generatePluginToken } from '../../services/auth.service.js';
import { getDb } from '../../db/connection.js';
import * as schema from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Handle all HTTP methods for webhook routes
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const pluginKey = params['id'];
  const webhookPath = params['*']; // Splat route captures path after /api/plugins/:id/

  if (!pluginKey) {
    return json({ error: 'Plugin ID required' }, { status: 400 });
  }

  if (!webhookPath) {
    return json({ error: 'Webhook path required' }, { status: 400 });
  }

  try {
    // 1. Load plugin manifest
    const manifest = await loadPluginManifest(pluginKey);

    // 2. Find matching route in plugin.json
    const route = manifest.routes.find((r: { method: string; path: string }) => {
      // Normalize paths: remove leading slashes for comparison
      const routePath = r.path.replace(/^\//, '');
      const requestPath = webhookPath.replace(/^\//, '');
      return (
        r.method.toUpperCase() === request.method.toUpperCase() &&
        routePath === requestPath
      );
    });

    if (!route) {
      return json(
        {
          error: `Route not found: ${request.method} /webhooks/${webhookPath}`,
        },
        { status: 404 }
      );
    }

    // 3. Check if handler field exists
    if (!route.handler) {
      return json(
        {
          error: 'Route does not specify a handler',
        },
        { status: 500 }
      );
    }

    // 4. Look up plugin instance in database (get tenantId)
    const db = getDb();
    const [pluginInstance] = await db
      .select()
      .from(schema.plugins)
      .where(
        and(
          eq(schema.plugins.key, pluginKey),
          eq(schema.plugins.enabled, true)
        )
      )
      .limit(1);

    if (!pluginInstance) {
      return json(
        {
          error: 'Plugin not found or disabled',
        },
        { status: 503 }
      );
    }

    const tenantId = pluginInstance.tenantId;

    // 5. Load handler code from filesystem
    // Resolve plugins directory (workspace root / plugins)
    const workspaceRoot = path.resolve(process.cwd(), '..');
    const pluginsDir = path.join(workspaceRoot, 'plugins');
    const handlerPath = path.join(pluginsDir, pluginKey, route.handler);

    let handlerCode: string;
    try {
      handlerCode = await readFile(handlerPath, 'utf-8');
    } catch (error) {
      console.error(`Failed to load handler at ${handlerPath}:`, error);
      return json(
        {
          error: 'Handler file not found',
        },
        { status: 500 }
      );
    }

    // 6. Generate internal plugin token
    const secret = process.env['PLUGIN_INTERNAL_SECRET'];
    if (!secret) {
      console.error('PLUGIN_INTERNAL_SECRET not configured');
      return json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }

    const pluginToken = generatePluginToken(pluginKey, tenantId, secret);

    // 7. Parse request body
    let body: unknown;
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await request.json();
      } else {
        body = await request.text();
      }
    } catch {
      body = null;
    }

    // 8. Build request context
    const webhookRequest = {
      method: request.method,
      path: `/${webhookPath}`,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    };

    // 9. Log webhook request start
    const [runRecord] = await db
      .insert(schema.pluginRuns)
      .values({
        tenantId,
        pluginId: pluginInstance.pluginId,
        jobName: `webhook:${webhookPath}`,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    // 10. Execute handler in isolated-vm
    const baseUrl =
      process.env['BASE_URL'] || 'https://devcle.test';

    const runner = new IsolatedVmRunner({
      tenantId,
      pluginId: pluginKey,
      pluginToken,
      baseUrl,
      allowedDomains: manifest.capabilities.network,
      timeoutMs: (route.timeoutSec || 60) * 1000,
    });

    let success = false;
    let errorMessage: string | null = null;

    try {
      success = await runner.execute(handlerCode, webhookRequest);
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `Plugin webhook handler failed (${pluginKey}):`,
        errorMessage
      );
    }

    // 11. Log webhook request completion
    if (runRecord) {
      await db
        .update(schema.pluginRuns)
        .set({
          status: success ? 'success' : 'failed',
          completedAt: new Date(),
          errorMessage,
        })
        .where(eq(schema.pluginRuns.runId, runRecord.runId));
    }

    // 12. Return response
    if (success) {
      return json({ success: true }, { status: 200 });
    } else {
      return json(
        {
          error: 'Handler execution failed',
          message: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET requests also supported (for webhook verification, health checks, etc.)
 */
export const loader = action;
