import { describe, test, expect } from 'vitest';
import path from 'node:path';
import { discoverPlugins, loadPlugin, getPluginMetadata } from './loader.js';
import type { PluginMetadata } from './loader.js';

/**
 * Unit tests for Plugin Loader
 *
 * Tests cover:
 * - getPluginMetadata: Metadata extraction and validation
 * - loadPlugin: Plugin loading and error handling
 * - discoverPlugins: Plugin discovery and filtering
 *
 * All tests use real file system fixtures (no mocks) to ensure
 * accurate behavior matching production environment.
 */

describe('Plugin Loader', () => {
  /**
   * Test suite for getPluginMetadata()
   *
   * Validates metadata extraction from plugin.json files,
   * error handling for invalid files, and field validation.
   */
  describe('getPluginMetadata', () => {
    test('should extract metadata from valid plugin.json', async () => {
      // Arrange: Get path to valid plugin.json fixture
      const fixturesDir = path.join(__dirname, '__fixtures__');
      const pluginJsonPath = path.join(
        fixturesDir,
        'drowl-plugin-test-valid',
        'plugin.json'
      );

      // Act: Extract metadata
      const metadata = await getPluginMetadata(pluginJsonPath);

      // Assert: Verify all expected fields are present
      expect(metadata.name).toBe('drowl-plugin-test-valid');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.displayName).toBe('Test Valid Plugin');
      expect(metadata.description).toBe(
        'A valid test plugin for unit testing'
      );
      expect(metadata.author).toBe('Test Author');
      expect(metadata.license).toBe('MIT');
    });

    test('should throw error if plugin.json file does not exist', async () => {
      // Arrange: Create path to non-existent file
      const nonExistentPath = path.join(
        __dirname,
        '__fixtures__',
        'non-existent',
        'plugin.json'
      );

      // Act & Assert: Verify error is thrown
      await expect(getPluginMetadata(nonExistentPath)).rejects.toThrow(
        /Failed to read plugin\.json/
      );
    });

    test('should throw error if required "name" field is missing', async () => {
      // Arrange: Get path to plugin.json without name field
      const fixturesDir = path.join(__dirname, '__fixtures__');
      const pluginJsonPath = path.join(
        fixturesDir,
        'invalid-plugin-no-name',
        'plugin.json'
      );

      // Act & Assert: Verify error is thrown for missing name
      await expect(getPluginMetadata(pluginJsonPath)).rejects.toThrow(
        /Missing or invalid "name" field/
      );
    });

    test('should throw error if required "version" field is missing', async () => {
      // Arrange: Get path to plugin.json without version field
      const fixturesDir = path.join(__dirname, '__fixtures__');
      const pluginJsonPath = path.join(
        fixturesDir,
        'invalid-plugin-no-version',
        'plugin.json'
      );

      // Act & Assert: Verify error is thrown for missing version
      await expect(getPluginMetadata(pluginJsonPath)).rejects.toThrow(
        /Missing or invalid "version" field/
      );
    });

    test('should extract DRM configuration if present', async () => {
      // Arrange: Get path to plugin.json with DRM config
      const fixturesDir = path.join(__dirname, '__fixtures__');
      const pluginJsonPath = path.join(
        fixturesDir,
        'drowl-plugin-test-with-drm',
        'plugin.json'
      );

      // Act: Extract metadata
      const metadata = await getPluginMetadata(pluginJsonPath);

      // Assert: Verify DRM config is extracted
      expect(metadata.drm).toBeDefined();
      expect(metadata.drm?.type).toBe('analytics');
      expect(metadata.drm?.coreVersion).toBe('^0.1.0');
    });

    test('should use plugin name as displayName if displayName is not provided', async () => {
      // Arrange: Get path to plugin.json without displayName
      const fixturesDir = path.join(__dirname, '__fixtures__');
      const pluginJsonPath = path.join(
        fixturesDir,
        'drowl-plugin-no-displayname',
        'plugin.json'
      );

      // Act: Extract metadata
      const metadata = await getPluginMetadata(pluginJsonPath);

      // Assert: Verify displayName falls back to name
      expect(metadata.displayName).toBe('drowl-plugin-no-displayname');
    });

    test('should throw error if plugin.json path is not absolute', async () => {
      // Arrange: Create relative path
      const relativePath = 'relative/path/plugin.json';

      // Act & Assert: Verify error is thrown for relative path
      await expect(getPluginMetadata(relativePath)).rejects.toThrow(
        /Plugin JSON path must be absolute/
      );
    });
  });

  /**
   * Test suite for loadPlugin()
   *
   * Validates plugin loading, module import, and error handling
   * for various edge cases.
   */
  describe('loadPlugin', () => {
    test('should throw error for invalid plugin name format', async () => {
      // Arrange: Create plugin name without required prefix
      const invalidName = 'invalid-plugin-name';

      // Act & Assert: Verify error is thrown
      await expect(loadPlugin(invalidName)).rejects.toThrow(
        /Invalid plugin name/
      );
    });

    test('should throw error if plugin not found', async () => {
      // Arrange: Create plugin name that doesn't exist
      const nonExistentPlugin = 'drowl-plugin-non-existent';

      // Act & Assert: Verify error is thrown
      await expect(loadPlugin(nonExistentPlugin)).rejects.toThrow(
        /Plugin "drowl-plugin-non-existent" not found/
      );
    });

    test('should throw error if plugin.json is missing', async () => {
      // Arrange: Create plugin name for plugin without plugin.json
      const pluginWithoutJson = 'drowl-plugin-missing-json';

      // Act & Assert: Verify error is thrown
      await expect(loadPlugin(pluginWithoutJson)).rejects.toThrow(/not found/);
    });
  });

  /**
   * Test suite for discoverPlugins()
   *
   * Validates plugin discovery from package.json dependencies
   * and filtering based on naming convention.
   */
  describe('discoverPlugins', () => {
    test('should return array of plugin metadata', async () => {
      // Act: Discover plugins
      const plugins = await discoverPlugins();

      // Assert: Verify result is an array
      expect(Array.isArray(plugins)).toBe(true);

      // Verify each plugin has required metadata structure
      plugins.forEach((plugin: PluginMetadata) => {
        expect(plugin).toHaveProperty('name');
        expect(plugin).toHaveProperty('version');
        expect(plugin).toHaveProperty('displayName');
        expect(plugin).toHaveProperty('description');
      });
    });

    test('should return plugins sorted by name', async () => {
      // Act: Discover plugins
      const plugins = await discoverPlugins();

      // Assert: Verify plugins are sorted alphabetically by name
      if (plugins.length > 1) {
        for (let i = 1; i < plugins.length; i++) {
          const currentPlugin = plugins[i];
          const previousPlugin = plugins[i - 1];
          if (currentPlugin && previousPlugin) {
            expect(currentPlugin.name.localeCompare(previousPlugin.name)).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('should only include plugins with "drowl-plugin-" prefix', async () => {
      // Act: Discover plugins
      const plugins = await discoverPlugins();

      // Assert: Verify all plugin names start with required prefix
      plugins.forEach((plugin: PluginMetadata) => {
        expect(
          plugin.name.startsWith('drowl-plugin-') ||
            plugin.name.startsWith('drowl-plugin-cloud-')
        ).toBe(true);
      });
    });
  });
});
