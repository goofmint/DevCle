/**
 * Vitest setup file
 *
 * This file runs before all tests and sets up the testing environment.
 * Includes:
 * - Database environment variables for testing
 * - Testing library cleanup
 * - Browser API polyfills for JSDOM
 */

// Load environment variables from parent directory .env file
// Uses Node.js 20.12+ loadEnvFile API
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read .env file from parent directory (where docker-compose is located)
// This ensures tests can access database credentials
// If NODE_ENV=test, use .env.test, otherwise use .env
try {
  const isTestEnv = process.env['NODE_ENV'] === 'test';
  const envFileName = isTestEnv ? '.env.test' : '.env';
  const envPath = resolve(__dirname, '..', envFileName);
  const envFile = readFileSync(envPath, 'utf-8');

  // Parse .env file and set environment variables
  // Format: KEY=value (one per line, ignoring comments and empty lines)
  envFile.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim() === '' || line.trim().startsWith('#')) {
      return;
    }

    // Parse KEY=value pairs
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim(); // Rejoin in case value contains '='
      process.env[key.trim()] = value;
    }
  });

  console.log(`✓ Loaded ${envFileName} for testing`);
} catch (error) {
  // If .env file doesn't exist or can't be read, log warning but don't fail
  // This allows tests to run with environment variables set externally
  console.warn('Warning: Could not load .env file for tests:', error);
}

// Import testing library cleanup
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Cleanup after each test
 * Removes any rendered components from the DOM
 */
afterEach(() => {
  cleanup();
});

/**
 * Polyfill for window.matchMedia
 * JSDOM doesn't support window.matchMedia, so we provide a minimal implementation
 * This is a standard browser API polyfill, not a mock of our component logic
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated but included for compatibility
    removeListener: () => {}, // deprecated but included for compatibility
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
