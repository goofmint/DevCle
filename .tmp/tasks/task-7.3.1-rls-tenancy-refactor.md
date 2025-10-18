# Task 7.3.1: RLS実装の修正とテスト環境の改善

## 概要

RLS（Row Level Security）のコンテキスト設定を安全なトランザクションスコープに統一し、テスト実行時の接続プール制限によるデッドロックを解消する。Productionとテストの双方で `withTenantContext()` に一本化し、接続プールの構成を見直す。

## 背景と課題

- `NODE_ENV=test` のときに接続プールの `max=1` に固定しているため、E2E テストで複数リクエストが並列になるとハングする。
- API ルートとサービスの一部、テストコードの多くが `setTenantContext()` / `clearTenantContext()` のペアでセッションコンテキストを切り替えており、接続プール経由でテナント情報が漏洩する危険がある。
- `withTenantContext()` 自体は存在するが、統一された利用ガイドラインがなく、既存コードの置き換え計画が未整備。

## 対応方針

1. 接続プール設定をテスト環境向けに再設計し、デフォルトで複数接続を許可する。リソース使用量を制御できるように環境変数ベースの設定に切り替える。
2. すべての API ルートとサービス層を調査し、`setTenantContext()` を使用している箇所を `withTenantContext()` に置き換えるための変換手順をまとめる。
3. テストコードではテナント境界の検証を `withTenantContext()` 経由で行うようにテストヘルパーを整理し、接続のクリーンアップを標準化する。

## 修正対象と優先順位

2025-10-18 時点で `rg` と簡易スクリプトによる自動調査を実施し、`setTenantContext()` 使用箇所を以下の通り抽出した（`withTenantContext()` は 39 ファイルで既利用）。

- **API Routes（5ファイル）**  
  - `core/app/routes/api/campaigns.ts`  
  - `core/app/routes/api/campaigns.$id.ts`  
  - `core/app/routes/api/campaigns.$id.roi.ts`  
  - `core/app/routes/api/funnel.ts`  
  - `core/app/routes/api/funnel.timeline.ts`
- **Service Layer（1ファイル）**  
  - `core/services/drm.service.ts`
- **Infrastructure（2ファイル）**  
  - `core/db/connection.ts`  
  - `core/app/middleware/tenant-context.ts`
- **Test Suites（18ファイル）**  
  - `core/app/middleware/tenant-context.test.ts` ほか 17 件（サービス系 8 件、API ルート系 8 件、DB 初期化 1 件）

### フェーズ別作業順序

1. **高優先度（API ルート + インフラ）**: 5 つの API ルートと `core/db/connection.ts`・`core/app/middleware/tenant-context.ts` を最優先で `withTenantContext()` に移行し、RLS 漏洩リスクを遮断する。
2. **サービス層**: `core/services/drm.service.ts` を `withTenantContext()` 利用へリファクタし、他サービスからの参照パターンを提示する。
3. **テストスイート再編**: 18 件のテストファイルを一括でヘルパー化し、並列実行でもテナント隔離が成り立つことを確認する。

## インタフェース方針

```typescript
interface TenantScopedDb {
  select: unknown;
  transaction<T>(callback: (tx: TenantScopedDb) => Promise<T>): Promise<T>;
}

interface TenantContextRunner {
  <T>(tenantId: string, callback: (tx: TenantScopedDb) => Promise<T>): Promise<T>;
}

interface TestDatabaseOptions {
  poolMax: number;
  idleTimeout: number;
}
```

## テスト戦略

- Vitest による RLS 関連統合テストを `withTenantContext()` ベースで再実行し、テナント間隔離を再検証する。
- Playwright による E2E テストを `NODE_ENV=test` で動かし、接続プール変更によるデッドロックが再発しないことを確認する。
- 接続プール設定の変更が既存の `closeDb()` ワークフローと競合しないかを単体テストで確認する。

## 受け入れ条件

- [ ] Connection pool settings verified and tested（`DATABASE_POOL_MAX`/`MIN` の可変化、`idle_timeout` の検証、複数テナント並列実行でリークが発生しないことを Vitest + Playwright で確認）
- [ ] All API routes and services migrated to `withTenantContext()`（上記 5 ルートと `core/services/drm.service.ts` が修正され、関連統合テストがパスする）
- [ ] Test helpers reorganized and passing with new pool configuration（新しいテストヘルパー経由で 18 件のテストが `withTenantContext()` を使用し、ユニット/統合/E2E テストが全て成功する）
