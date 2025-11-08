/**
 * Plugin HTTP Client
 *
 * Provides HTTP client functionality for plugins running in isolated-vm sandbox.
 * Supports both internal API calls (with HMAC authentication) and external API calls
 * (with domain validation based on capabilities.network).
 *
 * Security features:
 * - Internal API calls: Automatically adds HMAC authentication token
 * - External API calls: Domain validation against capabilities.network allowlist
 * - Disallows access to non-declared external domains
 * - All methods return typed responses
 *
 * Usage in plugin handlers:
 * ```javascript
 * // Internal API call (authenticated automatically)
 * const response = await httpClient.post('/api/activities', {
 *   developerId: '...',
 *   action: 'click',
 *   source: 'plugin',
 * });
 *
 * // External API call (domain must be in capabilities.network)
 * const response = await httpClient.get('https://api.github.com/repos/owner/repo');
 * ```
 */

/**
 * HTTP Client Configuration
 *
 * Configuration object passed to PluginHttpClient constructor.
 */
export interface HttpClientConfig {
  /** Base URL for internal API calls (e.g., 'https://devcle.com') */
  baseUrl: string;
  /** Plugin authentication token (HMAC-signed) */
  pluginToken: string;
  /** Allowed external domains from capabilities.network */
  allowedDomains: string[];
  /** Fetch function to use for HTTP requests */
  fetch: typeof globalThis.fetch;
}

/**
 * HTTP Response
 *
 * Standard response structure returned by all HTTP methods.
 */
export interface HttpResponse<T = unknown> {
  /** Response status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body (parsed JSON or text) */
  data: T;
}

/**
 * Plugin HTTP Client
 *
 * HTTP client for plugin sandbox environment.
 * Provides get(), post(), put(), delete() methods with authentication and domain validation.
 */
export class PluginHttpClient {
  private baseUrl: string;
  private pluginToken: string;
  private allowedDomains: string[];
  private fetch: typeof globalThis.fetch;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.pluginToken = config.pluginToken;
    this.allowedDomains = config.allowedDomains ?? [];
    this.fetch = config.fetch;
  }

  /**
   * Check if URL is internal API call
   *
   * Internal API calls start with '/api/'.
   * These calls are authenticated with the plugin token.
   *
   * @param url - URL to check
   * @returns True if internal API call
   */
  private isInternalApi(url: string): boolean {
    // For relative URLs, check if it starts with /api/
    if (url.startsWith('/')) {
      return url.startsWith('/api/');
    }

    // For absolute URLs, parse and check pathname
    try {
      const parsed = new URL(url);
      return parsed.pathname.startsWith('/api/');
    } catch {
      // Invalid URL format - treat as external
      return false;
    }
  }

  /**
   * Check if external domain is allowed
   *
   * Validates external domain against capabilities.network allowlist.
   * Supports wildcard patterns (e.g., '*.example.com').
   *
   * @param url - URL to check
   * @returns True if domain is allowed
   * @throws {Error} If domain is not allowed
   */
  private validateExternalDomain(url: string): void {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check exact match or wildcard match
    const isAllowed = this.allowedDomains.some((pattern) => {
      // Exact match
      if (pattern === `https://${hostname}` || pattern === hostname) {
        return true;
      }

      // Wildcard pattern (e.g., '*.example.com' or 'https://*.example.com')
      const patternHost = pattern.replace(/^https?:\/\//, '');
      if (patternHost.startsWith('*.')) {
        const suffix = patternHost.slice(1); // Remove '*'
        return hostname.endsWith(suffix);
      }

      return false;
    });

    if (!isAllowed) {
      throw new Error(
        `Domain not allowed: ${hostname}. Add to capabilities.network in plugin.json.`
      );
    }
  }

  /**
   * Build full URL
   *
   * Resolves relative URLs to absolute URLs using baseUrl.
   * Validates external domains against allowlist.
   *
   * @param url - URL to build
   * @returns Full URL
   */
  private buildUrl(url: string): string {
    if (this.isInternalApi(url)) {
      // Internal API call: prepend baseUrl
      return `${this.baseUrl}${url}`;
    } else {
      // External API call: validate domain
      this.validateExternalDomain(url);
      return url;
    }
  }

  /**
   * Build request headers
   *
   * Adds Authorization header for internal API calls.
   * External API calls do not get the plugin token.
   *
   * @param url - URL being called
   * @param customHeaders - Custom headers to include
   * @returns Headers object
   */
  private buildHeaders(
    url: string,
    customHeaders?: Record<string, string>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    // Add Authorization header for internal API calls only
    if (this.isInternalApi(url)) {
      headers['Authorization'] = `Bearer ${this.pluginToken}`;
    }

    return headers;
  }

  /**
   * Perform HTTP request
   *
   * Generic request method used by get(), post(), put(), delete().
   * Handles URL building, header injection, and response parsing.
   *
   * @param method - HTTP method
   * @param url - URL to call
   * @param body - Request body (for POST/PUT)
   * @param customHeaders - Custom headers
   * @returns HTTP response
   */
  private async request<T = unknown>(
    method: string,
    url: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    const fullUrl = this.buildUrl(url);
    const headers = this.buildHeaders(url, customHeaders);

    console.log(`[PluginHttpClient] ${method} ${fullUrl}`);

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await this.fetch(fullUrl, options);
      console.log(`[PluginHttpClient] Response: ${response.status}`);
      return await this.parseResponse<T>(response);
    } catch (error) {
      console.error(`[PluginHttpClient] Fetch error:`, error);
      throw error;
    }
  }

  private async parseResponse<T>(response: Response): Promise<HttpResponse<T>> {

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data: T;
    if (contentType.includes('application/json')) {
      data = (await response.json()) as T;
    } else {
      data = (await response.text()) as T;
    }

    // Build response headers object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      headers: responseHeaders,
      data,
    };
  }

  /**
   * GET request
   *
   * @param url - URL to call
   * @param headers - Custom headers
   * @returns HTTP response
   */
  async get<T = unknown>(
    url: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, headers);
  }

  /**
   * POST request
   *
   * @param url - URL to call
   * @param body - Request body
   * @param headers - Custom headers
   * @returns HTTP response
   */
  async post<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, body, headers);
  }

  /**
   * PUT request
   *
   * @param url - URL to call
   * @param body - Request body
   * @param headers - Custom headers
   * @returns HTTP response
   */
  async put<T = unknown>(
    url: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, body, headers);
  }

  /**
   * DELETE request
   *
   * @param url - URL to call
   * @param headers - Custom headers
   * @returns HTTP response
   */
  async delete<T = unknown>(
    url: string,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, headers);
  }
}
