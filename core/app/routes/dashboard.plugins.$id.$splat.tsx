/**
 * Dynamic Plugin Page Route
 *
 * Handles plugin-specific pages using splat routing.
 * Path: /dashboard/plugins/:id/*
 *
 * Dynamically loads plugin-provided React components.
 */

import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Icon } from '@iconify/react';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { requireAuth } from '~/auth.middleware';
import { lazy, Suspense } from 'react';

interface PluginPageProps {
  pluginId: string;
  tenantId: string;
}

interface PluginMenu {
  key: string;
  label: string;
  to: string;
  icon?: string;
  order?: number;
  component?: string;
}

interface PluginManifest {
  id: string;
  name: string;
  menus?: PluginMenu[];
}

function getPluginManifestPath(pluginId: string): string | null {
  const workspaceRoot = path.resolve(process.cwd(), '..');
  const pluginsPath = path.join(workspaceRoot, 'plugins', pluginId, 'plugin.json');

  if (existsSync(pluginsPath)) {
    return pluginsPath;
  }

  const nodeModulesPath = path.join(process.cwd(), 'node_modules', pluginId, 'plugin.json');

  if (existsSync(nodeModulesPath)) {
    return nodeModulesPath;
  }

  return null;
}

async function loadPluginManifest(manifestPath: string): Promise<PluginManifest> {
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content) as PluginManifest;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  const { id, splat } = params;

  if (!id) {
    throw new Response('Plugin ID is required', { status: 400 });
  }

  const pagePath = splat ? `/${splat}` : '/';

  const manifestPath = getPluginManifestPath(id);
  if (!manifestPath) {
    throw new Response(`Plugin not found: ${id}`, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  let manifest;
  try {
    manifest = await loadPluginManifest(manifestPath);
  } catch (error) {
    throw new Response(
      `Failed to load plugin manifest: ${
        error instanceof Error ? error.message : String(error)
      }`,
      {
        status: 500,
        statusText: 'Internal Server Error',
      }
    );
  }

  const menuItem = manifest.menus?.find((menu) => menu.to === pagePath);

  if (!menuItem) {
    throw new Response(`Plugin page not found: ${id}${pagePath}`, {
      status: 404,
      statusText: 'Not Found',
    });
  }

  return json({
    pluginId: id,
    pluginName: manifest.name,
    tenantId: user.tenantId,
    pagePath,
    pageLabel: menuItem.label,
    componentName: menuItem.component,
  });
}

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
          <Icon
            icon="mdi:alert-circle-outline"
            className="w-10 h-10 text-red-600 dark:text-red-400"
          />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
          Page Not Found
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          The requested plugin page does not exist or is not registered.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="/dashboard/plugins"
            className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            Back to Plugins
          </a>
          <a
            href="/dashboard"
            className="block w-full text-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PluginDynamicPage() {
  const { pluginId, tenantId, componentName } = useLoaderData<typeof loader>();

  if (!componentName) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
          Component Not Found
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400">
          No component specified for this plugin page.
        </p>
      </div>
    );
  }

  // Dynamically import component from plugin's index.ts (exported components)
  const PluginComponent = lazy<React.ComponentType<PluginPageProps>>(() =>
    import(`../../../plugins/${pluginId}/src/index.ts`).then((module) => ({
      default: module[componentName],
    }))
  );

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12">
          <Icon icon="mdi:loading" className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      }
    >
      <PluginComponent pluginId={pluginId} tenantId={tenantId} />
    </Suspense>
  );
}
