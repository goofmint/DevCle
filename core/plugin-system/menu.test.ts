/**
 * Plugin Menu System Tests
 *
 * Tests for plugin menu loading, validation, and permission filtering.
 * Covers:
 * - Menu depth validation (max 2 levels)
 * - Permission-based filtering
 * - Plugin menu loading from database
 *
 * @module plugin-system/menu.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateMenuDepth,
  filterMenuItemsByPermission,
  getPluginMenuItems,
  validateDataField,
  generatePluginMenus,
  type PluginMenuItem,
} from './menu.js';
import type { PluginManifest } from './types.js';
import { withTenantContext, type TenantTransactionClient } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

describe('validateMenuDepth', () => {
  it('should validate single-level menu items', () => {
    const rawMenus = [
      {
        label: 'Overview',
        path: '/dashboard/plugins/test/overview',
      },
      {
        label: 'Settings',
        path: '/dashboard/plugins/test/settings',
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'test-plugin', 2);

    expect(validated).toHaveLength(2);
    expect(validated[0]!).toMatchObject({
      label: 'Overview',
      path: '/dashboard/plugins/test/overview',
      pluginKey: 'test-plugin',
    });
    expect(validated[1]).toMatchObject({
      label: 'Settings',
      path: '/dashboard/plugins/test/settings',
      pluginKey: 'test-plugin',
    });
  });

  it('should validate two-level menu items with children', () => {
    const rawMenus = [
      {
        label: 'GitHub',
        path: '/dashboard/plugins/github',
        children: [
          {
            label: 'Issues',
            path: '/dashboard/plugins/github/issues',
          },
          {
            label: 'PRs',
            path: '/dashboard/plugins/github/prs',
          },
        ],
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'github', 2);

    expect(validated).toHaveLength(1);
    expect(validated[0]!).toMatchObject({
      label: 'GitHub',
      path: '/dashboard/plugins/github',
      pluginKey: 'github',
    });
    expect(validated[0]!.children).toBeDefined();
    expect(validated[0]!.children).toHaveLength(2);

    const children = validated[0]!.children;
    if (!children) throw new Error('Children should be defined');

    expect(children[0]).toMatchObject({
      label: 'Issues',
      path: '/dashboard/plugins/github/issues',
      pluginKey: 'github',
    });
    expect(children[1]).toMatchObject({
      label: 'PRs',
      path: '/dashboard/plugins/github/prs',
      pluginKey: 'github',
    });
  });

  it('should truncate menu items exceeding maximum depth (3+ levels)', () => {
    const rawMenus = [
      {
        label: 'Parent',
        path: '/dashboard/plugins/test',
        children: [
          {
            label: 'Child',
            path: '/dashboard/plugins/test/child',
            // This should be truncated
            children: [
              {
                label: 'Grandchild',
                path: '/dashboard/plugins/test/child/grandchild',
              },
            ],
          },
        ],
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'test-plugin', 2);

    expect(validated).toHaveLength(1);
    expect(validated[0]!.children).toBeDefined();
    expect(validated[0]!.children).toHaveLength(1);

    const children = validated[0]!.children;
    if (!children) throw new Error('Children should be defined');

    // Grandchildren should be truncated
    expect(children[0]).not.toHaveProperty('children');
  });

  it('should support "to" field as alternative to "path"', () => {
    const rawMenus = [
      {
        label: 'Overview',
        to: '/plugins/test/overview', // Using "to" instead of "path"
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'test-plugin', 2);

    expect(validated).toHaveLength(1);
    expect(validated[0]!.path).toBe('/plugins/test/overview');
  });

  it('should expand relative paths to absolute paths', () => {
    const rawMenus = [
      {
        label: 'Overview',
        path: '/overview',
      },
      {
        label: 'Settings',
        path: '/settings',
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'test-plugin', 2);

    expect(validated).toHaveLength(2);
    expect(validated[0]!.path).toBe('/dashboard/plugins/test-plugin/overview');
    expect(validated[1]!.path).toBe('/dashboard/plugins/test-plugin/settings');
  });

  it('should skip menu items with missing paths', () => {
    const rawMenus = [
      {
        label: 'Valid',
        path: '/dashboard/plugins/test/valid',
      },
      {
        label: 'Invalid - No Path',
        // Missing path/to field
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'test-plugin', 2);

    // Only the valid item should be included
    expect(validated).toHaveLength(1);
    expect(validated[0]!.label).toBe('Valid');
  });

  it('should handle optional fields (icon, capabilities)', () => {
    const rawMenus = [
      {
        label: 'With Icon',
        path: '/dashboard/plugins/test/icon',
        icon: 'mdi:chart-line',
        capabilities: ['analytics:read'],
      },
    ];

    const validated = validateMenuDepth(rawMenus, 'test-plugin', 2);

    expect(validated).toHaveLength(1);
    expect(validated[0]!).toMatchObject({
      label: 'With Icon',
      path: '/dashboard/plugins/test/icon',
      icon: 'mdi:chart-line',
      capabilities: ['analytics:read'],
      pluginKey: 'test-plugin',
    });
  });
});

describe('filterMenuItemsByPermission', () => {
  const createMenuItem = (
    label: string,
    capabilities?: string[]
  ): PluginMenuItem => {
    const item: PluginMenuItem = {
      label,
      path: `/dashboard/plugins/test/${label.toLowerCase()}`,
      icon: 'mdi:test',
      pluginKey: 'test-plugin',
      pluginName: 'Test Plugin',
    };

    // Add capabilities only if provided (exactOptionalPropertyTypes compliance)
    if (capabilities !== undefined) {
      item.capabilities = capabilities;
    }

    return item;
  };

  it('should show all items to admin users (wildcard capability)', () => {
    const items: PluginMenuItem[] = [
      createMenuItem('Public'),
      createMenuItem('Analytics', ['analytics:read']),
      createMenuItem('Admin', ['admin:write']),
    ];

    const filtered = filterMenuItemsByPermission(items, ['*']);

    expect(filtered).toHaveLength(3);
  });

  it('should show only items without capabilities to users with no capabilities', () => {
    const items: PluginMenuItem[] = [
      createMenuItem('Public'),
      createMenuItem('Analytics', ['analytics:read']),
      createMenuItem('Admin', ['admin:write']),
    ];

    const filtered = filterMenuItemsByPermission(items, []);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.label).toBe('Public');
  });

  it('should filter items based on user capabilities', () => {
    const items: PluginMenuItem[] = [
      createMenuItem('Public'),
      createMenuItem('Analytics', ['analytics:read']),
      createMenuItem('Campaigns', ['campaigns:write']),
      createMenuItem('Admin', ['admin:write']),
    ];

    const filtered = filterMenuItemsByPermission(items, ['analytics:read']);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((i) => i.label)).toEqual(['Public', 'Analytics']);
  });

  it('should filter children based on permissions', () => {
    const items: PluginMenuItem[] = [
      {
        label: 'GitHub',
        path: '/dashboard/plugins/github',
        icon: 'mdi:github',
        pluginKey: 'github',
        pluginName: 'GitHub Plugin',
        children: [
          {
            label: 'Issues',
            path: '/dashboard/plugins/github/issues',
            pluginKey: 'github',
            capabilities: ['github:read'],
          },
          {
            label: 'Settings',
            path: '/dashboard/plugins/github/settings',
            pluginKey: 'github',
            capabilities: ['github:admin'],
          },
        ],
      },
    ];

    const filtered = filterMenuItemsByPermission(items, ['github:read']);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.children).toBeDefined();
    expect(filtered[0]!.children).toHaveLength(1);

    const children = filtered[0]!.children;
    if (!children) throw new Error('Children should be defined');

    expect(children[0]!.label).toBe('Issues');
  });

  it('should remove children array if all children are filtered out', () => {
    const items: PluginMenuItem[] = [
      {
        label: 'GitHub',
        path: '/dashboard/plugins/github',
        icon: 'mdi:github',
        pluginKey: 'github',
        pluginName: 'GitHub Plugin',
        children: [
          {
            label: 'Admin Only',
            path: '/dashboard/plugins/github/admin',
            pluginKey: 'github',
            capabilities: ['github:admin'],
          },
        ],
      },
    ];

    const filtered = filterMenuItemsByPermission(items, ['github:read']);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.children).toBeUndefined();
  });

  it('should show items if user has at least one matching capability', () => {
    const items: PluginMenuItem[] = [
      createMenuItem('Analytics', ['analytics:read', 'analytics:write']),
    ];

    // User has only analytics:read (not analytics:write)
    const filtered = filterMenuItemsByPermission(items, ['analytics:read']);

    expect(filtered).toHaveLength(1);
  });
});

describe('getPluginMenuItems (integration)', () => {
  // Use the default tenant that's seeded in the test database
  const testTenantId = 'default';

  beforeEach(async () => {
    // Clean up test plugins (keep seeded plugins like drowl-plugin-test)
    await withTenantContext(testTenantId, async (tx: TenantTransactionClient) => {
      await tx.delete(schema.plugins).where(eq(schema.plugins.key, 'nonexistent-plugin'));
      await tx.delete(schema.plugins).where(eq(schema.plugins.key, 'test-plugin-disabled'));
    });
  });

  afterEach(async () => {
    // Clean up test plugins
    await withTenantContext(testTenantId, async (tx: TenantTransactionClient) => {
      await tx.delete(schema.plugins).where(eq(schema.plugins.key, 'nonexistent-plugin'));
      await tx.delete(schema.plugins).where(eq(schema.plugins.key, 'test-plugin-disabled'));
    });
  });

  it('should return empty array when no plugins are enabled', async () => {
    // Disable all seeded plugins for this test
    await withTenantContext(testTenantId, async (tx: TenantTransactionClient) => {
      await tx.update(schema.plugins).set({ enabled: false });
    });

    try {
      const menuItems = await getPluginMenuItems(testTenantId);

      expect(menuItems).toEqual([]);
    } finally {
      // Re-enable plugins after test (always restore state, even on test failure)
      await withTenantContext(testTenantId, async (tx: TenantTransactionClient) => {
        await tx.update(schema.plugins).set({ enabled: true });
      });
    }
  });

  it('should skip plugins without plugin.json', async () => {
    // Insert a plugin that doesn't have plugin.json
    await withTenantContext(testTenantId, async (tx: TenantTransactionClient) => {
      await tx.insert(schema.plugins).values({
        pluginId: randomUUID(),
        tenantId: testTenantId,
        key: 'nonexistent-plugin',
        name: 'Nonexistent Plugin',
        enabled: true,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const menuItems = await getPluginMenuItems(testTenantId);

    // Should not include nonexistent-plugin (plugin.json doesn't exist)
    // But drowl-plugin-test menus should be included
    const nonexistentMenus = menuItems.filter((item) => item.pluginKey === 'nonexistent-plugin');
    expect(nonexistentMenus).toHaveLength(0);

    // drowl-plugin-test menus should still be present
    const testPluginMenus = menuItems.filter((item) => item.pluginKey === 'drowl-plugin-test');
    expect(testPluginMenus.length).toBeGreaterThan(0);
  });

  it('should skip disabled plugins', async () => {
    // Insert a disabled plugin
    await withTenantContext(testTenantId, async (tx: TenantTransactionClient) => {
      await tx.insert(schema.plugins).values({
        pluginId: randomUUID(),
        tenantId: testTenantId,
        key: 'test-plugin-disabled',
        name: 'Test Plugin Disabled',
        enabled: false, // Disabled
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const menuItems = await getPluginMenuItems(testTenantId);

    // Should not include disabled plugin
    const disabledMenus = menuItems.filter((item) => item.pluginKey === 'test-plugin-disabled');
    expect(disabledMenus).toHaveLength(0);

    // drowl-plugin-test menus should still be present (it's enabled)
    const testPluginMenus = menuItems.filter((item) => item.pluginKey === 'drowl-plugin-test');
    expect(testPluginMenus.length).toBeGreaterThan(0);
  });

  it('should load menus from drowl-plugin-test with expanded paths', async () => {
    // drowl-plugin-test is seeded and enabled by default
    // It has 3 menu items: Overview, Settings, Activity Logs
    const menuItems = await getPluginMenuItems(testTenantId);

    // Should have at least the drowl-plugin-test menus
    expect(menuItems.length).toBeGreaterThanOrEqual(3);

    // Find the drowl-plugin-test menus
    // Should have 5 items: Overview, Collected Data (auto-generated), Activity Logs (from plugin.json), Settings, Activity Logs (auto-generated)
    const testPluginMenus = menuItems.filter((item) => item.pluginKey === 'drowl-plugin-test');
    expect(testPluginMenus.length).toBe(5);

    // Verify pluginName is set correctly (from plugin.json name field)
    expect(testPluginMenus[0]!.pluginName).toBe('drowl-plugin-test');

    // Verify paths are expanded correctly
    const overview = testPluginMenus.find((item) => item.label === 'Overview');
    expect(overview).toBeDefined();
    expect(overview!.path).toBe('/dashboard/plugins/drowl-plugin-test/overview');
    expect(overview!.icon).toBe('mdi:chart-line');
    expect(overview!.pluginName).toBe('drowl-plugin-test');

    const settings = testPluginMenus.find((item) => item.label === 'Settings');
    expect(settings).toBeDefined();
    expect(settings!.path).toBe('/dashboard/plugins/drowl-plugin-test/settings');
    expect(settings!.icon).toBe('mdi:cog');
    expect(settings!.pluginName).toBe('drowl-plugin-test');

    const logs = testPluginMenus.find((item) => item.label === 'Activity Logs');
    expect(logs).toBeDefined();
    expect(logs!.path).toBe('/dashboard/plugins/drowl-plugin-test/logs');
    expect(logs!.icon).toBe('mdi:file-document-outline');
    expect(logs!.pluginName).toBe('drowl-plugin-test');
  });
});

describe('validateDataField', () => {
  it('should pass when data is false and menus contains /data', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'data', label: 'Data', to: '/data', icon: 'mdi:database' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: false,
    };

    expect(() => validateDataField(manifest, 'test')).not.toThrow();
  });

  it('should pass when data is undefined and menus contains /data', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'data', label: 'Data', to: '/data', icon: 'mdi:database' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      // data field is undefined
    };

    expect(() => validateDataField(manifest, 'test')).not.toThrow();
  });

  it('should throw error when data is true and menus contains /data path', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'data', label: 'Data', to: '/data', icon: 'mdi:database' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: true,
    };

    expect(() => validateDataField(manifest, 'test')).toThrow(
      /Cannot have both 'data: true' and a menu item with path '\/data'/
    );
  });

  it('should throw error when data is true and menus contains data path (no slash)', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'data', label: 'Data', to: 'data', icon: 'mdi:database' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: true,
    };

    expect(() => validateDataField(manifest, 'test')).toThrow(
      /Cannot have both 'data: true' and a menu item with path '\/data'/
    );
  });

  it('should throw error when data is true and child menu contains /data', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        {
          key: 'parent',
          label: 'Parent',
          to: '/parent',
          icon: 'mdi:folder',
          children: [
            { key: 'data', label: 'Data', to: '/data', icon: 'mdi:database' },
          ],
        },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: true,
    };

    expect(() => validateDataField(manifest, 'test')).toThrow(
      /Cannot have both 'data: true' and a child menu item with path '\/data'/
    );
  });

  it('should pass when data is true and menus does not contain /data', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'mdi:chart-line' },
        { key: 'settings', label: 'Settings', to: '/settings', icon: 'mdi:cog' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: true,
    };

    expect(() => validateDataField(manifest, 'test')).not.toThrow();
  });
});

describe('generatePluginMenus', () => {
  it('should add "Collected Data" menu when data is true', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'mdi:chart-line' },
        { key: 'settings', label: 'Settings', to: '/settings', icon: 'mdi:cog' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: true,
    };

    const menus = generatePluginMenus(manifest, 'test-plugin');

    // Expected order: Overview, Collected Data, Settings, Activity Logs
    expect(menus).toHaveLength(4);
    expect(menus[0]!.label).toBe('Overview');
    expect(menus[1]!.label).toBe('Collected Data');
    expect(menus[1]!.path).toBe('/dashboard/plugins/test-plugin/data');
    expect(menus[1]!.icon).toBe('mdi:database');
    expect(menus[2]!.label).toBe('Settings');
    expect(menus[3]!.label).toBe('Activity Logs');
  });

  it('should not add "Collected Data" menu when data is false', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'mdi:chart-line' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: false,
    };

    const menus = generatePluginMenus(manifest, 'test-plugin');

    // Expected: Overview, Activity Logs (no Collected Data)
    expect(menus).toHaveLength(2);
    expect(menus[0]!.label).toBe('Overview');
    expect(menus[1]!.label).toBe('Activity Logs');

    // Verify Collected Data is not present
    const collectedDataMenu = menus.find((m) => m.label === 'Collected Data');
    expect(collectedDataMenu).toBeUndefined();
  });

  it('should maintain correct menu order with custom menus', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'mdi:chart-line' },
        { key: 'custom1', label: 'Custom 1', to: '/custom1', icon: 'mdi:puzzle' },
        { key: 'custom2', label: 'Custom 2', to: '/custom2', icon: 'mdi:star' },
        { key: 'settings', label: 'Settings', to: '/settings', icon: 'mdi:cog' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
      data: true,
    };

    const menus = generatePluginMenus(manifest, 'test-plugin');

    // Expected order: Overview, Collected Data, Custom 1, Custom 2, Settings, Activity Logs
    expect(menus).toHaveLength(6);
    expect(menus[0]!.label).toBe('Overview');
    expect(menus[1]!.label).toBe('Collected Data');
    expect(menus[2]!.label).toBe('Custom 1');
    expect(menus[3]!.label).toBe('Custom 2');
    expect(menus[4]!.label).toBe('Settings');
    expect(menus[5]!.label).toBe('Activity Logs');
  });

  it('should always add "Activity Logs" menu last', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
    };

    const menus = generatePluginMenus(manifest, 'test-plugin');

    // Even with empty menus, Activity Logs should be added
    expect(menus).toHaveLength(1);
    expect(menus[0]!.label).toBe('Activity Logs');
    expect(menus[0]!.path).toBe('/dashboard/plugins/test-plugin/runs');
    expect(menus[0]!.icon).toBe('mdi:file-document-outline');
  });

  it('should expand relative paths correctly', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        { key: 'overview', label: 'Overview', to: '/overview', icon: 'mdi:chart-line' },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
    };

    const menus = generatePluginMenus(manifest, 'github');

    expect(menus[0]!.path).toBe('/dashboard/plugins/github/overview');
  });

  it('should preserve menu capabilities and icons', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        {
          key: 'admin',
          label: 'Admin',
          to: '/admin',
          icon: 'mdi:shield',
          capabilities: ['admin:write'],
        },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
    };

    const menus = generatePluginMenus(manifest, 'test-plugin');

    expect(menus[0]!.label).toBe('Admin');
    expect(menus[0]!.icon).toBe('mdi:shield');
    expect(menus[0]!.capabilities).toEqual(['admin:write']);
  });

  it('should handle children menus correctly', () => {
    const manifest: PluginManifest = {
      id: 'test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test',
      vendor: 'Test',
      homepage: 'https://test.com',
      license: 'MIT',
      compatibility: { drowlMin: '0.1.0', drowlMax: '1.0.0' },
      capabilities: { scopes: [], network: [], secrets: [] },
      settingsSchema: [],
      menus: [
        {
          key: 'parent',
          label: 'Parent',
          to: '/parent',
          icon: 'mdi:folder',
          children: [
            { key: 'child1', label: 'Child 1', to: '/parent/child1', icon: 'mdi:file' },
            { key: 'child2', label: 'Child 2', to: '/parent/child2', icon: 'mdi:file' },
          ],
        },
      ],
      widgets: [],
      routes: [],
      jobs: [],
      rateLimits: { perMinute: 60, burst: 30 },
      i18n: { supported: ['en'] },
    };

    const menus = generatePluginMenus(manifest, 'test-plugin');

    expect(menus[0]!.label).toBe('Parent');
    expect(menus[0]!.children).toBeDefined();
    expect(menus[0]!.children).toHaveLength(2);

    const children = menus[0]!.children;
    if (!children) throw new Error('Children should be defined');

    expect(children[0]!.label).toBe('Child 1');
    expect(children[0]!.path).toBe('/dashboard/plugins/test-plugin/parent/child1');
    expect(children[1]!.label).toBe('Child 2');
    expect(children[1]!.path).toBe('/dashboard/plugins/test-plugin/parent/child2');
  });
});
