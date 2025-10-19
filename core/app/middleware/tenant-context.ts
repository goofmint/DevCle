/**
 * Tenant Context Middleware Helpers
 *
 * Provides small wrappers around the database-layer `withTenantContext`
 * utility so HTTP handlers and tests can execute tenant-scoped work without
 * manually touching session-level SQL commands.
 */

import {
  withTenantContext,
  type TenantContextCallback,
} from '../../db/connection.js';

function ensureTenantId(tenantId: string): string {
  if (!tenantId || tenantId.trim() === '') {
    throw new Error('Tenant ID cannot be empty');
  }

  const safePattern = /^[a-zA-Z0-9_-]+$/;
  if (!safePattern.test(tenantId)) {
    throw new Error(
      `Tenant ID contains invalid characters: ${tenantId}`
    );
  }

  return tenantId;
}

export async function runWithTenantContext<T>(
  tenantId: string,
  callback: TenantContextCallback<T>
): Promise<T> {
  const normalizedId = ensureTenantId(tenantId);
  return await withTenantContext(normalizedId, callback);
}

export function createTenantContextRunner(
  tenantId: string
): <T>(callback: TenantContextCallback<T>) => Promise<T> {
  const normalizedId = ensureTenantId(tenantId);
  return async <T>(callback: TenantContextCallback<T>) => {
    return await withTenantContext(normalizedId, callback);
  };
}
