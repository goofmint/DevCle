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

## 修正対象

- `core/db/connection.ts`：テスト用プール設定の見直しと `withTenantContext()` の補助関数を追加。
- `core/app/routes/api/*`：キャンペーン、ファネル関連ルートのテナントコンテキスト処理を `withTenantContext()` に統一。
- `core/services/**/*.test.ts`・`core/app/routes/**/*.test.ts`：テストヘルパーを `withTenantContext()` ベースに切り替え。

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

- [ ] すべての RLS 処理が `withTenantContext()` に統一され、`NODE_ENV=test` でのテスト実行時にデッドロックが発生しない。
