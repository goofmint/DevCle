/**
 * Tests for plugin configuration service
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  getPluginConfig,
  pluginExists,
  listAvailablePlugins,
} from './plugin-config.service.js';
import type { PluginManifest } from './plugin-config.types.js';

// Test plugin directory (outside of /workspace/plugins to avoid modifying submodule)
const TEST_PLUGINS_DIR = path.resolve(
  process.cwd(),
  '..',
  '__test-plugins__'
);

// Sample complete plugin manifest
const COMPLETE_PLUGIN_MANIFEST: PluginManifest = {
  id: 'test-complete-plugin',
  name: 'Complete Test Plugin',
  version: '1.0.0',
  description: 'A complete plugin for testing',
  vendor: 'Test Vendor',
  homepage: 'https://example.com',
  license: 'MIT',
  compatibility: {
    drowlMin: '0.9.0',
    drowlMax: '2.0.0',
  },
  capabilities: {
    scopes: ['read:activities', 'write:activities'],
    network: ['https://api.example.com'],
    secrets: ['api_token'],
  },
  settingsSchema: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'secret',
      required: true,
      hint: 'Enter your API key',
    },
    {
      key: 'syncInterval',
      label: 'Sync Interval (minutes)',
      type: 'number',
      default: 30,
      min: 1,
      max: 1440,
    },
  ],
  routes: [
    {
      method: 'POST',
      path: '/sync',
      auth: 'plugin',
      timeoutSec: 120,
      idempotent: true,
    },
  ],
  menus: [
    {
      key: 'overview',
      label: 'Overview',
      icon: 'mdi:chart-line',
      to: '/overview',
    },
  ],
  widgets: [
    {
      key: 'stats',
      type: 'stat',
      title: 'Statistics',
      version: '1.0',
      dataSource: {
        entity: 'developers',
        aggregation: {
          op: 'count',
        },
      },
    },
  ],
  jobs: [
    {
      name: 'sync',
      route: '/sync',
      cron: '0 */6 * * *',
      timeoutSec: 120,
      concurrency: 1,
    },
  ],
  rateLimits: {
    perMinute: 60,
    burst: 30,
  },
  i18n: {
    supported: ['en', 'ja'],
  },
};

// Minimal plugin manifest (only required fields)
const MINIMAL_PLUGIN_MANIFEST: PluginManifest = {
  id: 'test-minimal-plugin',
  name: 'Minimal Test Plugin',
  version: '1.0.0',
  description: 'A minimal plugin',
  vendor: 'Test',
  license: 'MIT',
  capabilities: {
    scopes: [],
    network: [],
    secrets: [],
  },
  settingsSchema: [],
  routes: [],
};

/**
 * Create test plugin directory and plugin.json
 */
async function createTestPlugin(
  pluginId: string,
  manifest: PluginManifest
): Promise<void> {
  const pluginDir = path.join(TEST_PLUGINS_DIR, pluginId);
  await fs.mkdir(pluginDir, { recursive: true });

  const manifestPath = path.join(pluginDir, 'plugin.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Clean up test plugins directory
 */
async function cleanupTestPlugins(): Promise<void> {
  try {
    await fs.rm(TEST_PLUGINS_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

describe('plugin-config.service', () => {
  beforeAll(async () => {
    // Configure service to use test plugins directory
    process.env.PLUGINS_DIR = TEST_PLUGINS_DIR;

    // Create test plugins
    await createTestPlugin(
      'test-complete-plugin',
      COMPLETE_PLUGIN_MANIFEST
    );
    await createTestPlugin('test-minimal-plugin', MINIMAL_PLUGIN_MANIFEST);
  });

  afterAll(async () => {
    // Clean up test plugins
    await cleanupTestPlugins();

    // Restore environment
    delete process.env.PLUGINS_DIR;
  });

  describe('pluginExists', () => {
    it('should return true for existing plugins', async () => {
      // Use test plugin from TEST_PLUGINS_DIR
      const exists = await pluginExists('test-complete-plugin');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing plugins', async () => {
      const exists = await pluginExists('non-existing-plugin');
      expect(exists).toBe(false);
    });
  });

  describe('getPluginConfig', () => {
    it('should successfully read and parse complete plugin config', async () => {
      // Test with complete plugin fixture
      const config = await getPluginConfig('test-complete-plugin', 'default');

      expect(config).toBeDefined();
      expect(config.basicInfo).toBeDefined();
      expect(config.basicInfo.id).toBe('test-complete-plugin');
      expect(config.basicInfo.name).toBe('Complete Test Plugin');
      expect(config.basicInfo.version).toBe('1.0.0');
      expect(config.basicInfo.vendor).toBe('Test Vendor');
      expect(config.basicInfo.license).toBe('MIT');
    });

    it('should throw error for non-existing plugin', async () => {
      await expect(
        getPluginConfig('non-existing-plugin', 'default')
      ).rejects.toThrow('Plugin not found');
    });

    it('should handle plugin with minimal fields', async () => {
      const config = await getPluginConfig('test-minimal-plugin', 'default');

      // Should provide default values for missing fields
      expect(config.capabilities).toBeDefined();
      expect(config.settingsSchema).toBeDefined();
      expect(config.routes).toBeDefined();
      expect(Array.isArray(config.capabilities.scopes)).toBe(true);
      expect(Array.isArray(config.settingsSchema)).toBe(true);
      expect(Array.isArray(config.routes)).toBe(true);
    });
  });

  describe('listAvailablePlugins', () => {
    it('should list available plugins', async () => {
      const plugins = await listAvailablePlugins();

      // Should include both test plugins
      expect(plugins).toContain('test-complete-plugin');
      expect(plugins).toContain('test-minimal-plugin');
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBe(2);
    });

    it('should exclude hidden directories', async () => {
      const plugins = await listAvailablePlugins();

      // Should not include directories starting with '.'
      const hiddenDirs = plugins.filter((p) => p.startsWith('.'));
      expect(hiddenDirs).toHaveLength(0);
    });

    it('should only include directories with plugin.json', async () => {
      const plugins = await listAvailablePlugins();

      // Verify each plugin has plugin.json
      for (const pluginId of plugins) {
        const exists = await pluginExists(pluginId);
        expect(exists).toBe(true);
      }
    });
  });
});
