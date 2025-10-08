# DRM (Developer Relations Management) ツール 仕様書 v2.0

> 本仕様は、DevRel活動を定量的に可視化・分析するための  
> **DRMツールのOSS構成・クラウド拡張・PostHog連携** の3層アーキテクチャを定義する。

## 🧭 全体概要

### 規定

ドメインは `devcle.com` とする。

### 目的

- DevRel活動における「個人・組織単位のファネル分析」と「匿名ベースの施策貢献分析」を両立する。
- OSSでコアデータ管理・ファネル構築を提供し、クラウド版で外部API連携やAI分析を拡張する。
- ファーストパーティCookieを使わず、サーバーtoサーバー連携と一時ID（click_id等）で計測を成立させる。

## 🏗 アーキテクチャ構成

```

/core/       ... OSSコア機能（ID統合・ファネル・データ管理）
/plugins/    ... Cloudプラグイン群（外部API・AI分析・自動化）
/posthog/    ... 匿名分析用モジュール（PostHog API連携・匿名指標統合）

```
```

┌──────────────────────────────────┐
│            DRM Cloud SaaS            │
│ ┌────────────┐  ┌────────────┐ │
│ │ Cloud Plugins │  │ PostHog Proxy │ │
│ └────────────┘  └────────────┘ │
│         ▲ API連携 / 分析結果統合       │
└────────┬────────────────────────┘
│
▼
┌───────────────────────────┐
│        DRM Core (OSS)         │
│ Person / Org / Activity / ... │
│ Plugin Loader / UI Hooks      │
└───────────────────────────┘

````

---

## 🧩 コア仕様 (`/core`)

### 目的
OSS部分は **自社ホストでも動作する完全独立構成**。  
データの収集・ID統合・ファネル分析の最小単位を担う。

### 主な機能
| 機能カテゴリ | 内容 |
|---------------|------|
| **データ管理** | Person / Organization / Activity / Identifier モデル |
| **ID解決** | email/domain/handleベースのルール型統合 |
| **ファネル分析** | Awareness → Engagement → Adoption → Advocacy |
| **API** | `/v1/people`, `/v1/orgs`, `/v1/activities` |
| **UI** | Remixベースのダッシュボード |
| **DB** | PostgreSQL + Prisma、RLS（tenant分離）対応 |
| **プラグイン拡張** | `/core/plugin-loader.ts` 経由で外部機能を追加可能 |

### 代表的エンティティ
```mermaid
erDiagram
    Person ||--o{ Activity : has
    Person ||--o{ Identifier : has
    Organization ||--o{ Person : includes

    Person {
        uuid person_id
        string display_name
        string primary_email
        string org_id
        boolean consent_analytics
    }

    Activity {
        uuid activity_id
        string type
        string source
        jsonb metadata
        timestamptz ts
    }

    Identifier {
        uuid identifier_id
        string kind
        string value
        float confidence
    }
````

---

## 🔌 プラグイン仕様 (`/plugins`)

### 概要

* pluginsの中に、フォルダごとに独立したプラグインを配置。
* Cloudモジュールはすべて「**プラグイン**」として独立配布される。
* コアを一切変更せずに、API/UI/ジョブ/ETLを追加可能。
* OSS環境では無償プラグイン、Cloud契約では署名付き有償プラグインが使用可能。

### ディレクトリ構成

```
/plugins/
├─ drm-plugin-slack/
│  ├─ plugin.json
│  └─ dist/plugin.js
├─ drm-plugin-discord/
├─ drm-plugin-connpass/
├─ drm-plugin-x/
├─ drm-plugin-crm/
└─ drm-plugin-ai-attribution/
```

### プラグイン定義例

**plugin.json**

```json
{
  "name": "drm-plugin-slack",
  "version": "1.0.0",
  "provider": "DRM Cloud",
  "license": "commercial",
  "entry": "./dist/plugin.js",
  "requires": { "drm-core": ">=1.0.0" },
  "permissions": ["network", "scheduler", "secrets"]
}
```

**plugin.ts**

```ts
import { definePlugin } from "@drm/core";

export default definePlugin({
  id: "slack",
  name: "Slack Integration",
  hooks: {
    onInit({ registerAPI, registerJob, registerUI }) {
      registerAPI("/integrations/slack/events", slackWebhookHandler);
      registerJob("slack.sync", { cron: "*/15 * * * *" }, syncSlackMessages);
      registerUI("dashboard.panel", SlackAnalyticsPanel);
    },
  },
});
```

---

## ⚙️ プラグイン読み込み仕組み

**`/core/plugin-loader.ts`**

```ts
import { loadPlugins } from "@drm/core/plugin-system";
import path from "path";

export function registerPlugins(app) {
  const pluginDirs = [
    path.resolve(process.cwd(), "plugins"),       // local OSS plugins
    "/var/lib/drm/cloud-plugins"                  // Cloud mount point
  ];
  loadPlugins(pluginDirs, app);
}
```

### ロード順序

1. OSSプラグインを `/plugins` から読み込み
2. クラウドプラグインを `/var/lib/drm/cloud-plugins` から追加ロード
3. `plugin.json` を検証 → 署名確認（クラウド配布のみ）
4. `definePlugin()` 経由でAPI/UI/Jobを登録

---

## 🔒 クラウドプラグイン認証・配布

| 項目           | 内容                                                    |
| ------------ | ----------------------------------------------------- |
| **配布形態**     | 署名付きZIP（RSA256）                                       |
| **検証方法**     | `drm verify-plugin` コマンドで署名検証                         |
| **認証API**    | DRM Cloud License APIでライセンスキー確認                       |
| **インストール**   | `drm plugin install drm-plugin-slack --license <key>` |
| **更新**       | `drm plugin update drm-plugin-slack`                  |
| **アンインストール** | `drm plugin remove drm-plugin-slack`                  |

---

## ☁️ クラウドプラグイン機能群

| プラグイン名                    | 内容                             | 備考             |
| ------------------------- | ------------------------------ | -------------- |
| **Slack**                 | チャンネル/メッセージ分析・Bot接続            | OAuth＋トークン自動更新 |
| **Discord**               | 投稿/リアクション収集                    |                |
| **connpass / Doorkeeper** | イベント参加者→Person自動登録             | rate-limit対応   |
| **X (Twitter)**           | メンション/ポスト解析                    | API有料枠をクラウド側負担 |
| **CRM連携**                 | Salesforce / HubSpot 2way sync | 商用顧客向け         |
| **AI Attribution**        | 施策ごとの貢献度自動推定                   | SaaS限定MLモデル    |

---

## 🧠 PostHog連携モジュール (`/posthog`)

### 目的

匿名行動データを統合的に分析し、施策貢献を評価する。
PostHog Cloud もしくは自社ホストのAPIと連携し、**匿名指標をDRMファネルに重ね合わせる。**

### 主な機能

| 機能                    | 内容                                   |
| --------------------- | ------------------------------------ |
| **Capture API (S2S)** | サーバー側で匿名イベント送信（distinct_id=click_id） |
| **Insights API**      | PostHogのファネル/トレンドを再掲                 |
| **Persons API**       | 匿名クラスタの人数/経路を参照                      |
| **統合ビュー**             | DRM内で施策別貢献を比較（匿名＋実名ファネル）             |

### 実装例

**匿名イベント送信**

```ts
await fetch("https://app.posthog.com/capture/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: process.env.POSTHOG_API_KEY,
    event: "first_api_call",
    distinct_id: click_id,
    properties: { campaign_id: "camp_2025_10", route: "/v1/items" }
  })
});
```

**ダッシュボード統合**

* PostHog Insightsを`/posthog/insights/:id`経由で取得
* DRMファネルと期間・施策でマージして比較表示

---

## 🧱 プロジェクト構成ディレクトリ

```
drm/
├─ core/                # OSSコア機能
│  ├─ api/
│  ├─ db/
│  ├─ models/
│  ├─ plugin-loader.ts
│  └─ ui/
├─ plugins/             # プラグイン群
│  ├─ drm-plugin-slack/
│  ├─ drm-plugin-crm/
│  ├─ drm-plugin-ai-attribution/
│  └─ ...
├─ posthog/             # 匿名分析モジュール
│  ├─ api/
│  ├─ services/
│  └─ insights/
├─ cli/
│  ├─ drm.ts            # CLI（install/update/verify）
│  └─ commands/
├─ docker/
│  └─ compose.yml
└─ docs/
   └─ SPEC.md (本ドキュメント)
```

---

## 🔐 セキュリティ・ライセンス設計

| 項目          | 内容                     |
| ----------- | ---------------------- |
| **コア**      | OSS（MITまたはBSL）         |
| **プラグイン**   | 商用（署名＋クラウド認証）          |
| **署名**      | RSA256署名検証（公開鍵同梱）      |
| **ライセンス検証** | 月次クラウドAPIチェック          |
| **データ保護**   | PIIは暗号化保存、匿名指標は統計化して集計 |
| **監査ログ**    | プラグインの操作履歴を監査テーブルに記録   |

---

## 📊 ダッシュボード要件

* ファネル比較（匿名PostHog vs 実名DRM）
* 施策別ROI表示（campaign単位）
* 組織別・期間別集計
* 未解決イベント数、重複率、AIスコア信頼度
* Slack通知連携（プラグイン経由）

---

## 💼 商用モデル

| プラン                 | 提供範囲                           | 想定価格    |
| ------------------- | ------------------------------ | ------- |
| **Community (OSS)** | コア機能・CSV取込・手動分析                | 無料      |
| **Cloud Standard**  | OSS＋Slack/Discord/connpass/X連携 | 月$300〜  |
| **Cloud Pro**       | + CRM連携・AIアトリビューション・チーム機能      | 月$1000〜 |
| **Enterprise**      | SLA・SSO・監査・専用VPC               | 年$10k〜  |

---

## ✅ 今後の開発フェーズ

| フェーズ        | 内容                                 |
| ----------- | ---------------------------------- |
| **Phase 1** | コア機能完成・プラグインAPI定義・PostHog接続        |
| **Phase 2** | OSSリリース              |
| **Phase 2** | Cloudプラグイン開発（Slack, connpass, CRM） |
| **Phase 3** | ダッシュボード統合 / AIアトリビューション実装          |
| **Phase 4** | Cloud販売開始                   |
| **Phase 5** | OSS Marketplace構築（外部開発者がプラグイン公開）   |

---

## 🔭 補足：設計思想

* **コアは安定・透明・普及重視**
  OSSとして信頼性と拡張性を最大化。
* **クラウドは価値・保証・継続性重視**
  外部API維持、AI精度、SLAを差別化軸に。
* **PostHogは第三の分析軸**
  匿名傾向を補足し、実名データと融合してDevRel ROIを見える化。

---

**Author:**
DRM Project (by Atsushi Nakatsugawa)
**Version:** 2.0
**License:** Core under MIT/BSL, Plugins under commercial license.
