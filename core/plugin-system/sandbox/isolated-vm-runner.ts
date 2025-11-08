/**
 * VM2 Runner
 *
 * Executes plugin webhook handlers in vm2 sandbox environment.
 * Provides secure execution with controlled context injection.
 *
 * Security features:
 * - Filesystem access restricted (no fs, path modules)
 * - Process operations forbidden (no child_process, cluster)
 * - Network access via PluginHttpClient only
 * - Execution timeout enforcement
 *
 * Architecture:
 * 1. Load plugin handler code from filesystem
 * 2. Create vm2 context with injected APIs
 * 3. Execute handler function with timeout
 * 4. Return boolean result (true = success, false = failure)
 *
 * Note: Switched from isolated-vm to vm2 for Docker compatibility.
 * isolated-vm causes SIGSEGV in Docker containers due to V8 memory management issues.
 *
 * Usage:
 * ```typescript
 * const runner = new IsolatedVmRunner({
 *   tenantId: 'default',
 *   pluginId: 'github',
 *   pluginToken: 'generated-token',
 *   baseUrl: 'https://devcle.com',
 *   allowedDomains: ['https://api.github.com'],
 *   timeoutMs: 10000,
 * });
 *
 * const result = await runner.execute(
 *   handlerCode,
 *   webhookPayload
 * );
 * ```
 */

import { VM } from 'vm2';
import { PluginHttpClient, type HttpClientConfig } from './http-client.js';

/**
 * Isolated VM Runner Configuration
 */
export interface IsolatedVmRunnerConfig {
  /** Tenant ID */
  tenantId: string;
  /** Plugin ID */
  pluginId: string;
  /** Plugin authentication token */
  pluginToken: string;
  /** Base URL for internal API calls */
  baseUrl: string;
  /** Allowed external domains */
  allowedDomains: string[];
  /** Execution timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Webhook Request Context
 *
 * Request information passed to plugin handler.
 */
export interface WebhookRequest {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Request body (parsed JSON) */
  body: unknown;
}

/**
 * Isolated VM Runner
 *
 * Executes plugin handlers in isolated-vm sandbox.
 */
export class IsolatedVmRunner {
  private config: IsolatedVmRunnerConfig;
  private httpClient: PluginHttpClient;

  constructor(config: IsolatedVmRunnerConfig) {
    this.config = config;

    // Create HTTP client for plugin
    const httpClientConfig: HttpClientConfig = {
      baseUrl: config.baseUrl,
      pluginToken: config.pluginToken,
      allowedDomains: config.allowedDomains,
      fetch: globalThis.fetch.bind(globalThis),
    };
    this.httpClient = new PluginHttpClient(httpClientConfig);
  }

  /**
   * Execute plugin handler
   *
   * Runs plugin handler code in vm2 sandbox with timeout.
   * Handler must export a default function that returns a Promise<boolean>.
   *
   * @param handlerCode - Plugin handler code (JavaScript)
   * @param request - Webhook request context
   * @returns Execution result (true = success, false = failure)
   * @throws {Error} If execution fails or times out
   */
  async execute(
    handlerCode: string,
    request: WebhookRequest
  ): Promise<boolean> {
    console.log('[VM2Runner] Starting execution...');

    // Create console object for sandbox
    const sandboxConsole = {
      log: (...args: unknown[]) => {
        console.log(`[Plugin ${this.config.pluginId}]`, ...args);
      },
      error: (...args: unknown[]) => {
        console.error(`[Plugin ${this.config.pluginId}]`, ...args);
      },
      warn: (...args: unknown[]) => {
        console.warn(`[Plugin ${this.config.pluginId}]`, ...args);
      },
    };

    // Transform ES6 export to CommonJS for vm2 compatibility
    // Handler must export a default function: export default async function(request) { ... }
    let transformedCode = handlerCode;

    // Replace "export default" with module.exports assignment
    transformedCode = transformedCode.replace(
      /export\s+default\s+(async\s+)?function(\s+\w+)?/,
      'module.exports = $1function$2'
    );

    // Wrap code to execute handler and return its result
    // vm2 requires wrapping async code in an IIFE to properly await and return result
    const wrappedCode = `
      ${transformedCode}

      // Validate handler exists
      if (typeof module.exports !== 'function') {
        throw new Error('Handler must export a default function');
      }

      // Execute handler in async IIFE and return the result
      (async () => {
        return await module.exports(request, { httpClient, console });
      })();
    `;

    // Create module exports object for sandbox
    const moduleExports = {};
    const moduleObject = { exports: moduleExports };

    // Create VM2 instance with sandbox
    // Note: vm2 needs fetch to be explicitly provided for httpClient to work
    const vm = new VM({
      timeout: this.config.timeoutMs,
      sandbox: {
        request,
        httpClient: this.httpClient,
        console: sandboxConsole,
        module: moduleObject,
        exports: moduleExports,
        fetch: globalThis.fetch.bind(globalThis), // Provide fetch for httpClient
        Promise, // Provide Promise constructor
      },
      eval: false,
      wasm: false,
    });

    try {
      console.log('[VM2Runner] Running handler in sandbox...');
      const result = await vm.run(wrappedCode);
      console.log('[VM2Runner] Execution complete, result:', result);

      // Handler must return boolean
      if (typeof result !== 'boolean') {
        throw new Error(
          `Handler must return boolean, got ${typeof result}`
        );
      }

      return result;
    } catch (error) {
      console.error('[VM2Runner] Execution failed:', error);
      throw error;
    }
  }
}
