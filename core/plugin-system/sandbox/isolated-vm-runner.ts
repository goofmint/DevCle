/**
 * Isolated VM Runner
 *
 * Executes plugin webhook handlers in isolated-vm sandbox environment.
 * Provides secure execution with controlled context injection.
 *
 * Security features:
 * - Filesystem access restricted (no fs, path modules)
 * - Process operations forbidden (no child_process, cluster)
 * - Network access via PluginHttpClient only
 * - Execution timeout enforcement
 * - Memory limits
 *
 * Architecture:
 * 1. Load plugin handler code from filesystem
 * 2. Create isolated-vm context with injected APIs
 * 3. Execute handler function with timeout
 * 4. Return boolean result (true = success, false = failure)
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

import ivm from 'isolated-vm';
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
    };
    this.httpClient = new PluginHttpClient(httpClientConfig);
  }

  /**
   * Execute plugin handler
   *
   * Runs plugin handler code in isolated-vm sandbox with timeout.
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
    // Create isolated VM instance with memory limit
    const isolate = new ivm.Isolate({ memoryLimit: 128 }); // 128MB limit

    try {
      // Create context
      const context = await isolate.createContext();

      // Inject console.log for debugging
      const jail = context.global;
      await jail.set('global', jail.derefInto());

      // Create console object with log method
      await jail.set(
        'log',
        new ivm.Reference((message: string) => {
          console.log(`[Plugin ${this.config.pluginId}]`, message);
        })
      );

      // Inject httpClient methods
      await jail.set(
        'httpClientGet',
        new ivm.Reference(async (url: string, headersJson?: string) => {
          const headers = headersJson ? JSON.parse(headersJson) : undefined;
          const response = await this.httpClient.get(url, headers);
          return JSON.stringify(response);
        })
      );

      await jail.set(
        'httpClientPost',
        new ivm.Reference(
          async (url: string, bodyJson: string, headersJson?: string) => {
            const body = JSON.parse(bodyJson);
            const headers = headersJson ? JSON.parse(headersJson) : undefined;
            const response = await this.httpClient.post(url, body, headers);
            return JSON.stringify(response);
          }
        )
      );

      await jail.set(
        'httpClientPut',
        new ivm.Reference(
          async (url: string, bodyJson: string, headersJson?: string) => {
            const body = JSON.parse(bodyJson);
            const headers = headersJson ? JSON.parse(headersJson) : undefined;
            const response = await this.httpClient.put(url, body, headers);
            return JSON.stringify(response);
          }
        )
      );

      await jail.set(
        'httpClientDelete',
        new ivm.Reference(async (url: string, headersJson?: string) => {
          const headers = headersJson ? JSON.parse(headersJson) : undefined;
          const response = await this.httpClient.delete(url, headers);
          return JSON.stringify(response);
        })
      );

      // Inject request context
      await jail.set('requestJson', JSON.stringify(request));

      // Bootstrap code: Set up sandbox environment
      const bootstrapCode = `
        // Console implementation
        const console = {
          log: (...args) => log(args.map(a => String(a)).join(' ')),
          error: (...args) => log('ERROR: ' + args.map(a => String(a)).join(' ')),
          warn: (...args) => log('WARN: ' + args.map(a => String(a)).join(' ')),
        };

        // HTTP Client implementation
        const httpClient = {
          get: async (url, headers) => {
            const headersJson = headers ? JSON.stringify(headers) : undefined;
            const responseJson = await httpClientGet.applySync(undefined, [url, headersJson], { result: { promise: true } });
            return JSON.parse(responseJson);
          },
          post: async (url, body, headers) => {
            const bodyJson = JSON.stringify(body);
            const headersJson = headers ? JSON.stringify(headers) : undefined;
            const responseJson = await httpClientPost.applySync(undefined, [url, bodyJson, headersJson], { result: { promise: true } });
            return JSON.parse(responseJson);
          },
          put: async (url, body, headers) => {
            const bodyJson = JSON.stringify(body);
            const headersJson = headers ? JSON.stringify(headers) : undefined;
            const responseJson = await httpClientPut.applySync(undefined, [url, bodyJson, headersJson], { result: { promise: true } });
            return JSON.parse(responseJson);
          },
          delete: async (url, headers) => {
            const headersJson = headers ? JSON.stringify(headers) : undefined;
            const responseJson = await httpClientDelete.applySync(undefined, [url, headersJson], { result: { promise: true } });
            return JSON.parse(responseJson);
          },
        };

        // Parse request
        const request = JSON.parse(requestJson);
      `;

      await context.eval(bootstrapCode);

      // Execute handler code
      // Handler must export a default function: export default async function(request) { ... }
      const wrappedCode = `
        ${handlerCode}

        // Execute handler
        (async () => {
          const handler = (typeof exports !== 'undefined' && exports.default) || (typeof module !== 'undefined' && module.exports && module.exports.default);
          if (typeof handler !== 'function') {
            throw new Error('Handler must export a default function');
          }
          return await handler(request, { httpClient, console });
        })();
      `;

      const script = await isolate.compileScript(wrappedCode);
      const result = await script.run(context, {
        timeout: this.config.timeoutMs,
        promise: true,
      });

      // Handler must return boolean
      if (typeof result !== 'boolean') {
        throw new Error(
          `Handler must return boolean, got ${typeof result}`
        );
      }

      return result;
    } finally {
      // Cleanup: Dispose isolate
      isolate.dispose();
    }
  }
}
