# DRM スキーマ拡張：複数サービスアカウント統合

## 目的

* 1開発者が **GitHub / Slack / X / Discord / GA など複数の外部アカウント**を保有する現実に対応。
* **開発者（developer）** と **外部アカウント（account）** を1対多で正規化。
* **アクティビティ（activity）** は「どのアカウントで“何を”したか」を保持できる。
* 名寄せ（ID統合）精度を高めるための **識別子（identifiers）** と **マージ監査（merge_logs）** を追加。

---

## ER 図（更新）

```mermaid
erDiagram
    Tenant ||--o{ Developer : has
    Tenant ||--o{ Organization : has
    Tenant ||--o{ Account : has
    Tenant ||--o{ Resource : has
    Tenant ||--o{ Campaign : has
    Tenant ||--o{ Activity : has
    Tenant ||--o{ PluginRun : has
    Tenant ||--o{ PluginEventRaw : has
    Tenant ||--o{ DeveloperMergeLog : has
    Tenant ||--o{ DeveloperIdentifier : has

    Developer ||--o{ Account : owns
    Developer ||--o{ Activity : performs
    Account ||--o{ Activity : via_account
    Organization ||--o{ Developer : includes
    Resource ||--o{ Activity : is_target_of
    Campaign ||--o{ Resource : groups
    Activity ||--o{ ActivityCampaign : attributed_to

    Account {
      uuid account_id PK
      text tenant_id
      uuid developer_id FK (nullable during resolution)
      text provider               // github, slack, x, discord, email, ga, posthog ...
      text external_user_id       // provider内でユニークなID
      text handle                 // @user, screen_name など
      citext email                // そのアカウントに紐づくメール（あれば）
      text profile_url
      text avatar_url
      timestamptz first_seen
      timestamptz last_seen
      timestamptz verified_at
      boolean is_primary default false
      numeric confidence default 0.8
      jsonb attributes
      text dedup_key UQ
      timestamptz created_at
      timestamptz updated_at
      // UNIQUE(tenant_id, provider, external_user_id)
    }

    DeveloperIdentifier {
      uuid identifier_id PK
      text tenant_id
      uuid developer_id FK
      text kind                   // email, domain, phone, key_fingerprint, mlid, click_id
      text value_normalized
      numeric confidence default 1.0
      jsonb attributes
      timestamptz first_seen
      timestamptz last_seen
      // UNIQUE(tenant_id, kind, value_normalized)
    }

    DeveloperMergeLog {
      uuid merge_id PK
      text tenant_id
      uuid into_developer_id
      uuid from_developer_id
      text reason
      jsonb evidence             // ヒットルールや一致フィールドの記録
      timestamptz merged_at
      uuid merged_by             // 操作ユーザーID（監査）
    }
```

> 重要ポイント
>
> * **`accounts`**：開発者と外部サービスの**橋渡し**。**アクティビティに `account_id` を保持**して「どのIDで行動したか」を記録。
> * **`developer_identifiers`**：メール・ドメイン・click_id・mlid など“非アカウント系”識別子も網羅。
> * **`developer_merge_logs`**：名寄せ時の監査。Undo/再現性の確保。

---

## 主要テーブル（更新含む）

### developers（開発者）

| カラム                     | 型           | 説明    |
| ----------------------- | ----------- | ----- |
| tenant_id               | text        | テナント  |
| developer_id            | uuid PK     | 開発者ID |
| display_name            | text        | 表示名   |
| primary_email           | citext NULL | 代表メール |
| org_id                  | uuid FK     | 所属組織  |
| consent_analytics       | boolean     | 分析同意  |
| tags                    | text[]      | 属性タグ  |
| created_at / updated_at | timestamptz | 監査    |

---

### accounts（外部アカウント）★新設

| カラム                                                    | 型             | 説明                                               |       |   |         |       |    |         |      |
| ------------------------------------------------------ | ------------- | ------------------------------------------------ | ----- | - | ------- | ----- | -- | ------- | ---- |
| tenant_id                                              | text          | テナント                                             |       |   |         |       |    |         |      |
| account_id                                             | uuid PK       | アカウントID                                          |       |   |         |       |    |         |      |
| developer_id                                           | uuid FK NULL可 | 名寄せ前はNULL、解決後に紐づく                                |       |   |         |       |    |         |      |
| provider                                               | text          | `github                                          | slack | x | discord | email | ga | posthog | ...` |
| external_user_id                                       | text          | プロバイダ内ユニークID（例：GitHub numeric id）                |       |   |         |       |    |         |      |
| handle                                                 | text          | `@user` 等                                        |       |   |         |       |    |         |      |
| email                                                  | citext NULL   | そのアカウントのメール                                      |       |   |         |       |    |         |      |
| profile_url                                            | text          | プロフィールURL                                        |       |   |         |       |    |         |      |
| avatar_url                                             | text          | アイコンURL                                          |       |   |         |       |    |         |      |
| first_seen / last_seen                                 | timestamptz   | 観測時刻                                             |       |   |         |       |    |         |      |
| verified_at                                            | timestamptz   | 確証が取れた時刻（OAuth等）                                 |       |   |         |       |    |         |      |
| is_primary                                             | boolean       | 開発者内の代表アカウントか                                    |       |   |         |       |    |         |      |
| confidence                                             | numeric       | 開発者との紐付け確度                                       |       |   |         |       |    |         |      |
| attributes                                             | jsonb         | スコープ/権限/言語など                                     |       |   |         |       |    |         |      |
| dedup_key                                              | text UNIQUE   | 重複排除（例：hash(tenant, provider, external_user_id)) |       |   |         |       |    |         |      |
| created_at / updated_at                                | timestamptz   | 監査                                               |       |   |         |       |    |         |      |
| **制約**：`UNIQUE(tenant_id, provider, external_user_id)` |               |                                                  |       |   |         |       |    |         |      |

---

### developer_identifiers（識別子・非アカウント系）★新設

| カラム                                                | 型           | 説明             |        |       |      |          |                     |
| -------------------------------------------------- | ----------- | -------------- | ------ | ----- | ---- | -------- | ------------------- |
| tenant_id                                          | text        | テナント           |        |       |      |          |                     |
| identifier_id                                      | uuid PK     | ID             |        |       |      |          |                     |
| developer_id                                       | uuid FK     | 開発者            |        |       |      |          |                     |
| kind                                               | text        | `email         | domain | phone | mlid | click_id | key_fingerprint...` |
| value_normalized                                   | text        | 正規化済み値（小文字化など） |        |       |      |          |                     |
| confidence                                         | numeric     | 確度             |        |       |      |          |                     |
| attributes                                         | jsonb       | 追加メタ           |        |       |      |          |                     |
| first_seen / last_seen                             | timestamptz | 観測時刻           |        |       |      |          |                     |
| **制約**：`UNIQUE(tenant_id, kind, value_normalized)` |             |                |        |       |      |          |                     |

---

### activities（行動ログ）★`account_id` 追加

| カラム                       | 型            | 説明                        |        |      |      |      |         |      |        |          |              |
| ------------------------- | ------------ | ------------------------- | ------ | ---- | ---- | ---- | ------- | ---- | ------ | -------- | ------------ |
| tenant_id                 | text         | テナント                      |        |      |      |      |         |      |        |          |              |
| activity_id               | uuid PK      | アクティビティ                   |        |      |      |      |         |      |        |          |              |
| developer_id              | uuid FK NULL | Actor（匿名ならNULL）           |        |      |      |      |         |      |        |          |              |
| **account_id**            | uuid FK NULL | どのアカウントで行動したか             |        |      |      |      |         |      |        |          |              |
| anon_id                   | text NULL    | 匿名ID（短縮URL/QRなど）          |        |      |      |      |         |      |        |          |              |
| resource_id               | uuid FK NULL | 対象リソース                    |        |      |      |      |         |      |        |          |              |
| action                    | text         | `click                    | attend | post | star | fork | comment | view | signup | download | api_call...` |
| occurred_at / recorded_at | timestamptz  | いつ                        |        |      |      |      |         |      |        |          |              |
| source / source_ref       | text         | どのプラグイン由来か/原本ID           |        |      |      |      |         |      |        |          |              |
| category / group_key      | text         | リソースのキャッシュ                |        |      |      |      |         |      |        |          |              |
| metadata                  | jsonb        | 言語/UA/utm/shortlink_id など |        |      |      |      |         |      |        |          |              |
| confidence                | numeric      | 紐付け確度                     |        |      |      |      |         |      |        |          |              |
| dedup_key                 | text UNIQUE  | 重複排除キー                    |        |      |      |      |         |      |        |          |              |
| ingested_at               | timestamptz  | 取り込み                      |        |      |      |      |         |      |        |          |              |

> 解析で「GitHubのこのユーザーが★した」「Xのこのアカウントが言及した」と**アカウント粒度**で追跡可能。

---

### developer_merge_logs（名寄せ監査）★新設

| カラム               | 型           | 説明           |
| ----------------- | ----------- | ------------ |
| tenant_id         | text        | テナント         |
| merge_id          | uuid PK     |              |
| into_developer_id | uuid        | マージ先         |
| from_developer_id | uuid        | マージ元         |
| reason            | text        | 手動/自動・ルール名など |
| evidence          | jsonb       | 一致項目、スコア     |
| merged_at         | timestamptz |              |
| merged_by         | uuid        | 実行ユーザー       |

---

## ID解決（名寄せ）戦略（実務ルール）

### 自動リンク（スコアリング例）

* `email完全一致` → 1.0
* `provider=github` かつ `verified_at有り` → 0.9
* `同一ドメイン × 同名 × 近接イベント参加` → 0.7
* `Xのhandle一致 × 同一リンク証跡` → 0.6
* `click_id → signupまでのトレース` → 0.6

**しきい値**：0.9以上は自動リンク、0.6〜0.9は候補提示（人手承認）。

### 重複排除（dedup_key）

* accounts: `hash(tenant_id, provider, external_user_id)`
* activities: `hash(tenant_id, source, source_ref || developer_id || account_id || occurred_at::date)`
* identifiers: `hash(tenant_id, kind, value_normalized)`

---

## 代表クエリ

### 1) ある開発者の“サービス別”行動サマリ

```sql
SELECT a.provider,
       COUNT(*) AS events,
       MIN(act.occurred_at) AS first_seen,
       MAX(act.occurred_at) AS last_seen
FROM accounts a
LEFT JOIN activities act
  ON act.tenant_id=a.tenant_id AND act.account_id=a.account_id
WHERE a.tenant_id=$1 AND a.developer_id=$2
GROUP BY a.provider
ORDER BY events DESC;
```

### 2) 未紐付けアカウントの名寄せ候補（メール一致）

```sql
SELECT a.account_id, a.provider, a.email, d.developer_id, d.display_name
FROM accounts a
JOIN developers d
  ON d.tenant_id=a.tenant_id
WHERE a.tenant_id=$1
  AND a.developer_id IS NULL
  AND a.email IS NOT NULL
  AND LOWER(a.email)=LOWER(d.primary_email);
```

### 3) 施策ROI（アカウント粒度での貢献把握）

```sql
SELECT c.name,
       SUM(b.amount) AS cost,
       COUNT(act.activity_id) FILTER (WHERE act.action IN ('signup','api_call')) AS conv,
       COUNT(DISTINCT act.account_id) AS unique_accounts_involved
FROM campaigns c
LEFT JOIN budgets b
  ON b.tenant_id=c.tenant_id AND b.campaign_id=c.campaign_id
LEFT JOIN activity_campaigns ac
  ON ac.tenant_id=c.tenant_id AND ac.campaign_id=c.campaign_id
LEFT JOIN activities act
  ON act.tenant_id=ac.tenant_id AND act.activity_id=ac.activity_id
WHERE c.tenant_id=$1
GROUP BY c.name
ORDER BY conv DESC NULLS LAST;
```

---

## Drizzle スキッチ（抜粋）

```ts
import { pgTable, text, uuid, timestamp, jsonb, numeric, boolean, unique } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  tenantId: text("tenant_id").notNull(),
  accountId: uuid("account_id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id"),
  provider: text("provider").notNull(),
  externalUserId: text("external_user_id").notNull(),
  handle: text("handle"),
  email: text("email"),
  profileUrl: text("profile_url"),
  avatarUrl: text("avatar_url"),
  firstSeen: timestamp("first_seen", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  isPrimary: boolean("is_primary").default(false),
  confidence: numeric("confidence").default("0.8"),
  attributes: jsonb("attributes"),
  dedupKey: text("dedup_key").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uqProviderUid: unique().on(t.tenantId, t.provider, t.externalUserId),
}));

export const activities = pgTable("activities", {
  tenantId: text("tenant_id").notNull(),
  activityId: uuid("activity_id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id"),
  accountId: uuid("account_id"),                  // ← 追加
  resourceId: uuid("resource_id"),
  anonId: text("anon_id"),
  action: text("action").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow(),
  source: text("source").notNull(),
  sourceRef: text("source_ref"),
  metadata: jsonb("metadata"),
  confidence: numeric("confidence").default("1.0"),
  dedupKey: text("dedup_key").unique(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow(),
});
```

---

## 運用メモ

* **開発者＝器、アカウント＝ID表面**として分離することで、**名寄せの柔軟性**と**監査可能性**が大幅に向上します。
* **activities.account_id** を持たせることで、後から「特定アカウントだけ除外」「特定プロバイダ由来のノイズ除去」等のクレンジングがしやすいです。
* OAuth 等の**認可トークン**は、テナント連携（プラグイン設定）側に保持し、`accounts` には **個人識別情報のみ**を保存するのが原則（トークンは別テーブル・KMS暗号化推奨）。
