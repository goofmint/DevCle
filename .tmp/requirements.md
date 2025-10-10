# DRM（Developer Relations Management）ツール 技術仕様書

**Version:** 2.1  
**Author:** Atsushi Nakatsugawa  
**License:** OSS Core under MIT/BSL, Plugins under commercial license  
**Architecture:** OSS（docker-compose構成）＋ SaaS（マルチテナント構成）

---

## 🧭 概要

本システムは、DevRel（Developer Relations）活動の定量化を目的とした  
**ROI可視化＋ファネル分析＋AI分析対応のDevRel CRM** である。  

OSS版とSaaS版の2形態で提供する。  
OSSは自社ホスティングでの利用を想定し、SaaSは複数テナントの管理を行う。

---

## 🏗 システム構成

### OSS版
- **構成**: `nginx + Remix + PostgreSQL (Drizzle ORM) + PostHog`
- **構築方式**: `docker-compose`
- **SSL/TLS**: Cloudflare経由（Flexible SSL）
- **想定用途**: 自社利用、PoC、プライベート環境でのDevRelデータ分析

### SaaS版
- **構成**: マルチテナント（`tenant_id`ベース）
- **データ分離**: Row Level Security (RLS) + PostgreSQL Schema per Tenant
- **認証**: JWT + OAuth（GitHub / Google対応）
- **拡張**: 商用プラグイン・AI連携・有料API接続

---

## ⚙️ 基本機能一覧

### 1. DRM（Developer Relations Management）

| 機能 | 内容 |
|------|------|
| **アクティビティ登録** | イベント・投稿・問い合わせ・GitHub活動などを登録 |
| **デベロッパー可視化** | Person単位で行動履歴を時系列に可視化 |
| **ID統合** | メール・SNS・イベント参加履歴をもとに名寄せ（重複統合） |
| **組織管理** | Organization単位で関連開発者を表示 |
| **スコアリング** | Engagementスコア・貢献度スコアを算出 |

#### データ登録方法
1. **フォーム入力**（Web UIから登録）  
2. **API経由**（Webhook, REST API）  
3. **CSVアップロード**（イベントリストなど一括登録）

---

### 2. ROI（投資対効果分析）

| 機能 | 内容 |
|------|------|
| **スポンサード・施策登録** | イベント、広告、ブログなどの施策を登録 |
| **予算入力** | カテゴリ別（人件費・広告費・制作費など）のコスト入力 |
| **ROI可視化** | 投資額と成果（登録数・導入数）を可視化 |
| **AI分析サポート** | 投資額と効果の関係をAIで最適化提案 |
| **短縮URL・QRコード** | クリック計測をPostHog/GAイベントと突合 |
| **レポート出力** | 施策別ROIサマリをダウンロード（CSV/PDF） |

#### ROI計算式
```

ROI = (効果値 - 投資額) / 投資額
ROI_weighted = Σ(施策貢献度 × 効果値) / Σ(投資額)

```

---

### 3. ファネル分析

| 機能 | 内容 |
|------|------|
| **匿名データ収集** | PostHog / Google Analytics のイベントをAPI連携 |
| **ファネル表示** | Awareness → Engagement → Adoption → Advocacy |
| **ドロップ率表示** | 各ステージの離脱ポイントを可視化 |
| **改善トラッキング** | 前期比較で改善率・滞留期間を算出 |
| **ステータス更新** | デベロッパーごとの進捗を自動更新（AI補完対応） |

---

### 4. AI機能

| カテゴリ | 機能 |
|-----------|------|
| **ROI分析支援** | 投資効果をAIで再推定し、次の施策を提案 |
| **施策壁打ち** | DevRel施策の想定効果を試算し、ROI予測を出力 |
| **Developer Journey 推定** | 開発者の関心→採用→布教フェーズをAI分類 |
| **アトリビューションAI** | どの施策が最終行動に寄与したかを推定 |
| **要約AI** | Slack/Discordの会話を要約し、話題・感情・影響者を抽出 |

---

### 5. プラグイン機構

| 機能 | 内容 |
|------|------|
| **リソース別拡張** | Slack, Discord, X, Web検索, connpass などをモジュール化 |
| **設定管理** | 各プラグインにキー・ルーティング・認証情報を保存 |
| **インストール方式** | npmパッケージ (`drm-plugin-*`) で追加 |
| **有効化管理** | 管理画面からON/OFF可能 |
| **データ収集** | バックグラウンドで定期実行（cron or job queue） |
| **UI拡張** | プラグイン側が表示方法を規定（一覧・グラフ・カード等） |
| **商用プラグイン** | DRM Cloud経由で署名付き配布・自動更新対応 |

#### プラグイン登録例

```ts
export default definePlugin({
  id: "slack",
  name: "Slack Integration",
  hooks: {
    onInit({ registerJob, registerAPI, registerUI }) {
      registerJob("slack.sync", { cron: "*/15 * * * *" }, syncSlackData);
      registerUI("dashboard.panel", SlackSummaryChart);
    },
  },
  settings: {
    apiToken: { type: "string", title: "Slack API Token", required: true, description: "xoxb-xxxx..."},
  },
  widgets: [
    { type: "chart", title: "Slack Activity", component: SlackActivityChart },
    { type: "list", title: "Recent Messages", component: RecentMessagesList}
  ],
});
```

---

### 6. データの登録方法

| 方法            | 対象            | 備考          |
| ------------- | ------------- | ----------- |
| **フォーム**      | 施策、アクティビティ、予算 | 管理画面上で操作可能  |
| **API**       | 外部サービス連携      | JWT認証対応     |
| **CSVアップロード** | イベント・リード・費用など | 自動マッピング機能付き |

---

## 🧱 データベース構造（Drizzle ORM）

主要テーブル：

* `persons`（開発者情報）
* `organizations`（組織）
* `activities`（行動記録）
* `budgets`（費用情報）
* `campaigns`（施策情報）
* `roi_results`（ROI算出結果）
* `funnel_stages`（ファネル状態）
* `plugins`（拡張モジュール）
* `tenants`（SaaS用テナント管理）

テナントスコープには `tenant_id` を必須カラムとして保持。
RLSでデータ分離。

---

## 📈 ダッシュボード機能

| セクション             | 内容                             |
| ----------------- | ------------------------------ |
| **Overview**      | 総アクティビティ数、ROI平均、開発者数、導入数       |
| **Funnel View**   | ファネル段階別人数・ドロップ率可視化             |
| **ROI View**      | 投資カテゴリ別・施策別ROI表示               |
| **AI Insights**   | AIによる提案・トレンド・異常検知              |
| **Plugin Panels** | 各プラグイン固有の分析ビュー（Slack、Discord等） |

---

## ☁️ SaaS版追加要件

| 項目            | 内容                             |
| ------------- | ------------------------------ |
| **テナント管理**    | `tenant_id`で一意管理               |
| **認証**        | OAuth2 + JWT                   |
| **監査ログ**      | すべての操作を `audit_logs` テーブルに記録   |
| **プラグイン署名検証** | 商用プラグインのみRSA署名必須               |
| **課金**        | Stripe API + ライセンスキー検証         |
| **メトリクス**     | Prometheus + Grafana で利用統計を可視化 |

---

## 🔐 セキュリティ・権限

| ロール           | 権限                  |
| ------------- | ------------------- |
| **Admin**     | すべての管理・予算登録・プラグイン設定 |
| **Manager**   | 施策登録・ROI閲覧          |
| **Viewer**    | ダッシュボード閲覧のみ         |
| **AI Engine** | 学習用読み取り権限           |

---

## 🧠 AIモジュール構成（Cloud専用）

| モジュール名           | 役割           |
| ---------------- | ------------ |
| `ai/attribution` | 施策ごとの貢献スコア推定 |
| `ai/journey`     | 開発者のファネル位置推定 |
| `ai/summary`     | Slack等の要約    |
| `ai/recommend`   | 改善施策提案       |
| `ai/predict`     | ROI予測・異常検知   |

モデル例：

* Scikit-learn / LightGBM / Prophet
* LLM API（OpenAI, Claude, Geminiなど）

---

## 📦 外部連携

| サービス                      | 目的        | モード     |
| ------------------------- | --------- | ------- |
| **PostHog**               | 匿名行動データ収集 | OSS必須   |
| **Google Analytics**      | イベント突合    | オプション   |
| **Slack / Discord / X**   | アクティビティ収集 | プラグイン経由 |
| **connpass / Doorkeeper** | イベントデータ同期 | プラグイン経由 |
| **Salesforce / HubSpot**  | CRM連携     | クラウド専用  |

---

## 🧩 docker-compose構成例（OSS）

```yaml
version: '3.9'
services:
  web:
    build: ./remix
    ports:
      - "8080:8080"
    depends_on:
      - db
      - posthog
  nginx:
    image: nginx:latest
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: drm
      POSTGRES_PASSWORD: drm_pass
      POSTGRES_DB: drm_core
    volumes:
      - ./postgresql/data:/var/lib/postgresql/data
  posthog:
    image: posthog/posthog:latest
    environment:
      - DATABASE_URL=postgres://posthog:posthog@db:5432/posthog
```

---

## 🔄 データ連携フロー概要

```
[ユーザー行動]
   ↓ (クリック/QR)
[PostHogイベント]
   ↓
[DRM APIで突合]
   ↓
[ファネル更新 / ROI再計算]
   ↓
[AI Attributionモデル]
   ↓
[ダッシュボード表示]
```

---

## 🧩 見逃しがちな補足項目

| 項目            | 対応方法                       |
| ------------- | -------------------------- |
| **監査ログ**      | `audit_logs`テーブルで管理（SaaS）  |
| **データエクスポート** | JSON / CSV / PDF対応         |
| **非同期処理**     | BullMQ / Redisキュー採用検討      |
| **Webhooks**  | 施策更新・ROI再計算時に通知            |
| **権限継承**      | Organization単位でロール共有可能     |
| **APIレート制限**  | per-tenant / per-pluginで適用 |

---

## ✅ 今後の拡張案

* AI施策シミュレーター（ROI予測＋提案）
* プラグインマーケットプレイス（OSS/Cloud共通）
* PostHogデータの自動特徴量抽出
* チームKPIダッシュボード（DevRelチーム別成果分析）
* 「監査ログ」と「Webhook連携」を仕様に含めると、SaaS化時の監査要件を満たせます。  
*  「BullMQなどのジョブキュー」導入を検討すれば、プラグイン実行を安定運用できます。  
*  「APIレート制限」設定で、外部連携が多い環境でも安全。  
