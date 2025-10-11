/**
 * Server-side environment variable management
 *
 * This module provides type-safe access to environment variables.
 * All environment variables are validated at startup to ensure
 * the application has the required configuration.
 *
 * IMPORTANT: This file must only be imported in server-side code
 * (loaders, actions, *.server.ts files). Never import in client code.
 *
 * @example
 * ```typescript
 * import { env } from '~/env.server';
 *
 * export async function loader() {
 *   // Access environment variables safely
 *   const dbUrl = env.DATABASE_URL;
 *   const nodeEnv = env.NODE_ENV;
 *   // ...
 * }
 * ```
 */

/**
 * Environment variables interface
 *
 * Defines all required and optional environment variables
 * with their expected types.
 */
interface Env {
  /** PostgreSQL database connection URL */
  DATABASE_URL: string;
  /** Redis connection URL for caching and job queues */
  REDIS_URL: string;
  /** Secret key for session cookie signing */
  SESSION_SECRET: string;
  /** Node environment: development, production, or test */
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * Get and validate environment variables
 *
 * This function:
 * 1. Reads environment variables from process.env
 * 2. Validates that all required variables are present
 * 3. Validates that NODE_ENV has a valid value
 * 4. Returns a type-safe Env object
 *
 * @throws {Error} If required environment variables are missing
 * @throws {Error} If NODE_ENV has an invalid value
 * @returns {Env} Validated environment variables
 */
function getEnv(): Env {
  const env = {
    DATABASE_URL: process.env['DATABASE_URL'],
    REDIS_URL: process.env['REDIS_URL'],
    SESSION_SECRET: process.env['SESSION_SECRET'],
    NODE_ENV: process.env['NODE_ENV'] || 'development',
  };

  // Validate required environment variables
  const missing: string[] = [];

  if (!env['DATABASE_URL']) {
    missing.push('DATABASE_URL');
  }
  if (!env['REDIS_URL']) {
    missing.push('REDIS_URL');
  }
  if (!env['SESSION_SECRET']) {
    missing.push('SESSION_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Validate NODE_ENV
  const validNodeEnvs = ['development', 'production', 'test'];
  if (!validNodeEnvs.includes(env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: ${env.NODE_ENV}\n` +
        'NODE_ENV must be one of: development, production, test'
    );
  }

  return env as Env;
}

/**
 * Validated environment variables
 *
 * This is initialized at module load time, so any missing or invalid
 * variables will cause the application to fail fast at startup.
 *
 * This prevents the application from running with incomplete configuration.
 */
export const env = getEnv();
