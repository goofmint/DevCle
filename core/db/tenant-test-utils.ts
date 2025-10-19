/**
 * Test helper utilities for tenant-scoped database work.
 *
 * Vitest suites often need to seed or clean data inside a tenant boundary.
 * This module offers a tiny wrapper so tests can stay focused on setup logic
 * without repeating the transaction boilerplate everywhere.
 */

import {
  withTenantContext,
  type TenantContextCallback,
  type TenantTransactionClient,
} from './connection.js';
import * as schema from './schema/index.js';

export type TenantTransaction = TenantTransactionClient;

export async function runInTenant<T>(
  tenantId: string,
  callback: TenantContextCallback<T>
): Promise<T> {
  return await withTenantContext(tenantId, callback);
}

export async function ensureTenantExists(
  tenantId: string,
  name: string = tenantId
): Promise<void> {
  await runInTenant(tenantId, async (tx) => {
    await tx
      .insert(schema.tenants)
      .values({
        tenantId,
        name,
        plan: 'OSS',
      })
      .onConflictDoNothing();
  });
}
