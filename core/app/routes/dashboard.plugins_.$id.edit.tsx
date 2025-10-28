/**
 * Plugin Settings Edit Page
 *
 * Allows admin users to edit plugin configuration values.
 * Features:
 * - Dynamic form generation based on plugin.json settingsSchema
 * - Automatic encryption of secret fields
 * - Secret exists marker support (option D: toggle pattern)
 * - Schema-based validation with error display
 * - Dark mode support
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { useLoaderData, useActionData, Form, Link, useNavigation } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { requireAuth } from '~/auth.middleware.js';
import { getPluginConfig } from '../../services/plugin/plugin-config.service.js';
import { findPluginById, updatePluginConfig } from '../../services/plugin.service.js';
import { PluginConfigForm } from '~/components/plugin/PluginConfigForm.js';
import type { PluginConfigField, PluginConfigSchema } from '../../plugin-system/config-validator.js';
import { validatePluginConfig } from '../../plugin-system/config-validator.js';
import { createSecretExistsMarkers } from '../../plugin-system/config-encryption.js';

/**
 * Loader data type
 */
interface LoaderData {
  plugin: {
    pluginId: string;
    key: string;
    name: string;
    enabled: boolean;
  };
  schema: {
    fields: PluginConfigField[];
  };
  config: Record<string, unknown>;
}

/**
 * Action data type (for validation errors)
 */
interface ActionData {
  errors?: Array<{ field: string; message: string }>;
  error?: string;
}

/**
 * GET /dashboard/plugins/:id/edit
 *
 * Loads plugin configuration schema and current values.
 * Secret fields are replaced with { _exists: true } markers for security.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. Authentication check (admin role required)
  const user = await requireAuth(request);

  if (user.role !== 'admin') {
    throw new Response('Admin role required', { status: 403 });
  }

  const tenantId = user.tenantId;
  const pluginId = params['id'];

  if (!pluginId) {
    throw new Response('Plugin ID required', { status: 400 });
  }

  try {
    // 2. Get plugin information from database
    const plugin = await findPluginById(tenantId, pluginId);

    if (!plugin) {
      throw new Response('Plugin not found', { status: 404 });
    }

    // 3. Get plugin configuration schema from plugin.json (use plugin.key, not pluginId)
    const pluginConfig = await getPluginConfig(plugin.key, tenantId);

    // Check if plugin has settings schema
    if (!pluginConfig.settingsSchema || !Array.isArray(pluginConfig.settingsSchema)) {
      throw new Response('Plugin does not have a configuration schema', { status: 404 });
    }

    const schema = {
      fields: pluginConfig.settingsSchema as PluginConfigField[],
    };

    // 4. Prepare config with secret exists markers
    const config = plugin.config as Record<string, unknown> | null;
    const configWithMarkers = config
      ? createSecretExistsMarkers(schema, config)
      : {};

    // 5. Return loader data
    const loaderData: LoaderData = {
      plugin: {
        pluginId: plugin.pluginId,
        key: plugin.key,
        name: plugin.name,
        enabled: plugin.enabled,
      },
      schema,
      config: configWithMarkers,
    };

    return json(loaderData);
  } catch (error) {
    // Log error for debugging
    console.error('[Plugin Edit Loader] Error:', error);

    // Handle specific errors
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('Plugin not found')) {
        throw new Response('Plugin not found', { status: 404 });
      }
    }

    throw new Response('Failed to load plugin configuration', { status: 500 });
  }
}

/**
 * POST /dashboard/plugins/:id/edit
 *
 * Updates plugin configuration via API endpoint.
 * Validates and encrypts configuration before saving.
 */
export async function action({ request, params }: ActionFunctionArgs) {
  // 1. Authentication check (admin role required)
  const user = await requireAuth(request);

  if (user.role !== 'admin') {
    return json<ActionData>(
      { error: 'Admin role required' },
      { status: 403 }
    );
  }

  const pluginId = params['id'];

  if (!pluginId) {
    return json<ActionData>(
      { error: 'Plugin ID required' },
      { status: 400 }
    );
  }

  const tenantId = user.tenantId;

  // 2. Parse form data
  const formData = await request.formData();
  const configData: Record<string, unknown> = {};

  // Convert FormData to config object
  for (const [key, value] of formData.entries()) {
    // Skip non-config fields
    if (key === '_action') continue;

    // Handle JSON string values (e.g., secret exists markers)
    if (typeof value === 'string' && value.startsWith('{') && value.includes('"_exists"')) {
      try {
        configData[key] = JSON.parse(value);
        continue;
      } catch (error) {
        // If parsing fails, treat as regular string
        console.warn(`Failed to parse JSON for field ${key}:`, error);
      }
    }

    // Handle checkbox values (boolean fields)
    if (value === 'on') {
      configData[key] = true;
      continue;
    }

    // Handle number fields
    if (value && !Number.isNaN(Number(value)) && value !== '') {
      configData[key] = Number(value);
      continue;
    }

    // Handle string fields
    configData[key] = value;
  }

  // 3. Get plugin information and schema
  try {
    const plugin = await findPluginById(tenantId, pluginId);

    if (!plugin) {
      return json<ActionData>(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Get plugin configuration schema
    const pluginConfig = await getPluginConfig(plugin.key, tenantId);

    if (!pluginConfig.settingsSchema || !Array.isArray(pluginConfig.settingsSchema)) {
      return json<ActionData>(
        { error: 'Plugin does not have a configuration schema' },
        { status: 404 }
      );
    }

    const schema: PluginConfigSchema = {
      fields: pluginConfig.settingsSchema as PluginConfigField[],
    };

    // 4. Validate configuration against schema
    const validationErrors = validatePluginConfig(schema, configData);

    if (validationErrors.length > 0) {
      return json<ActionData>({
        errors: validationErrors,
        error: 'Validation failed',
      }, { status: 400 });
    }

    // 5. Update plugin configuration (encryption handled by service)
    await updatePluginConfig(tenantId, pluginId, schema, configData);

    // 6. Redirect to plugin list on success
    return redirect('/dashboard/plugins');
  } catch (error) {
    // Log error for debugging
    console.error('[Plugin Edit Action] Error:', error);

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Plugin not found')) {
        return json<ActionData>(
          { error: 'Plugin not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('encrypt')) {
        return json<ActionData>(
          { error: 'Failed to encrypt configuration' },
          { status: 500 }
        );
      }
    }

    return json<ActionData>(
      { error: 'Failed to update plugin configuration' },
      { status: 500 }
    );
  }
}

/**
 * Plugin Edit Page Component
 */
export default function PluginEditPage() {
  const { plugin, schema, config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard/plugins"
          className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <Icon icon="heroicons:arrow-left" className="w-4 h-4" />
          Back to Plugins
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Configure {plugin.name}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Update plugin settings below. Secret fields are encrypted automatically.
        </p>
      </div>

      {/* Error Alert */}
      {actionData?.error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Icon icon="heroicons:exclamation-circle" className="w-6 h-6 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">Error</h3>
          </div>
          <p className="mt-2 text-red-700 dark:text-red-300">{actionData.error}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <Form method="post" className="space-y-6">
          <PluginConfigForm
            schema={schema}
            config={config}
            errors={actionData?.errors || []}
          />

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/dashboard/plugins"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon icon="heroicons:document-arrow-down" className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
