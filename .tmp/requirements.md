# DRM（Developer Relations Management）ツール 技術仕様書

**Version:** 2.2  
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

### OSS版構成
- **構成:**  
  `nginx + Remix + PostgreSQL (Drizzle ORM) + Redis（バックグラウンド処理）`
- **構築:**  
  `docker-compose` によるワンコマンドデプロイ
- **SSL/TLS:**  
  Cloudflareを経由したリバースプロキシSSL（Flexible SSL対応）
- **利用目的:**  
  小規模チーム・コミュニティによる自社データ分析

```
├─ nginx/
│   └─ nginx.conf
├─ core/
│   └─ Remixアプリケーション
├─ redis/
│   └─ redis.conf # Redis設定
├─ docker-compose-dev.yml # 全体構成（開発用）
└─ docker-compose.yml # 全体構成（本番用）
```

開発時には `docker-compose.yml` をベースに、 `docker-compose-dev.yml` を追加して利用する。本番ではPostgreSQL・Redisを外部サービスに置き換えることも想定。

### SaaS版構成
- **構成:** マルチテナント構成（`tenant_id` によりデータ分離。OSS版は `tenant_id = 'default'`）
- **データ分離:** PostgreSQL Row Level Security (RLS) + Redisキー空間分割
- **認証:** OAuth2 / JWT / SSO（Google, GitHub）
- **課金:** Stripeサブスクリプション + ライセンスキー
- **特徴:**  
  外部API連携の運用保証・AI分析・チーム管理・監査ログを提供

---

## ⚙️ コア機能

### 1. DRM（Developer Relations Management）

| 機能 | 内容 |
|------|------|
| **アクティビティ登録** | イベント・SNS投稿・問合せ・GitHub活動などを登録 |
| **デベロッパー可視化** | 個人単位で行動履歴を可視化（時系列・ファネル別） |
| **ID統合** | メールアドレス・SNS・イベント履歴から名寄せ統合 |
| **組織管理** | 複数開発者を組織単位で束ねて分析 |
| **スコアリング** | Engagementスコア算出（貢献・参加・発信など） |

#### データ登録方法
1. **フォーム入力:** 管理画面から手動登録  
2. **API登録:** 外部連携プラグインやWebhookからPOST  
3. **CSVアップロード:** connpass等のエクスポートCSVをインポート  

---

### 2. ROI（投資対効果分析）

| 機能 | 内容 |
|------|------|
| **施策登録** | イベント・キャンペーン・広告・スポンサー施策を登録 |
| **予算入力** | 人件費・広告費・外注費・ツール費用などを記録 |
| **ROI可視化** | 投資額と成果（登録数・導入数）をグラフで表示 |
| **クリックトラッキング** | 短縮URL・QRコード発行しアクセス回数を測定 |
| **イベント突合** | クリックイベントをアクセス解析プラグイン（PostHog / GA）と照合 |
| **レポート出力** | CSV / PDF / JSON形式でエクスポート可能 |

#### ROI計算式

ROI = (効果値 - 投資額) / 投資額
ROI_weighted = Σ(施策貢献度 × 効果値) / Σ(投資額)

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

### 4. AI機能（SaaS限定）

| 機能 | 内容 |
|------|------|
| **ROI分析サポート** | 投資・効果データを学習し貢献スコアを算出 |
| **施策の壁打ち** | 施策概要を入力するとAIが試算・提案 |
| **ファネル推定** | 開発者行動データからファネル段階をAI分類 |
| **レポート自動生成** | 「今月の成果レポート」を自然言語で自動生成 |
| **異常検知** | ROI・クリック数の異常値を通知 |

モデル例：  
- LightGBM / Prophet（ROI予測・トレンド）  
- OpenAI / Claude / Gemini（自然言語要約・提案）

---

### 5. プラグイン機構

| 機能 | 内容 |
|------|------|
| **リソース別拡張** | Slack, Discord, X, Web検索, GA, PostHog, connpass, Meetup など |
| **設定情報管理** | 各プラグインごとにAPIキー・Webhook・ルーティングを保存 |
| **インストール形式** | npm パッケージ (`drm-plugin-*`) として提供 |
| **有効化管理** | 管理画面からON/OFF切り替え可能 |
| **バックグラウンド処理** | Redisキュー + cronで定期的にデータ収集 |
| **データ表示ウィジェット** | プラグイン側でUIを定義（一覧表・グラフ・集計など複数可） |
| **外部送信機能** | MailChimpなど外部サービスへデータ送信可能（明示設定） |
| **エラー・実行ログ** | 各プラグインの処理結果を管理画面で確認可能 |

#### プラグイン実装例

```ts
export default definePlugin({
  id: "github",
  name: "GitHub Integration",
  hooks: {
    onInit({ registerJob, registerUI }) {
      registerJob("github.sync", { cron: "0 */6 * * *" }, syncRepoData);
      registerUI("dashboard.panel", GitHubContributionChart);
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

#### プラグイン例一覧

* **PostHog**（アクセス解析）
* **Google Analytics**
* **Slack / Discord**
* **connpass / Meetup.com**
* **GitHub**
* **X (Twitter)**
* **Google検索結果トレンド**

---

### 6. データの登録

| 方法            | 対象              | 備考             |
| ------------- | --------------- | -------------- |
| **フォーム入力**    | 手動登録・編集         | 管理画面から直接入力可能   |
| **API登録**     | 外部連携・Webhook    | 認証トークンによる制御    |
| **CSVアップロード** | イベント・予算・アクティビティ | 自動マッピング付きインポート |

---

### 7. 管理画面（Admin Console）

| セクション       | 機能                       |
| ----------- | ------------------------ |
| **プラグイン管理** | インストール・有効化・設定編集・ログ確認     |
| **システム設定**  | ベースURL、短縮URLドメイン、メール送信設定 |
| **アカウント設定** | ログイン情報・通知設定・APIキー発行      |
| **メンバー管理**  | チームメンバー招待、ロール割り当て        |
| **ログビューア**  | バックグラウンド処理・エラー履歴を時系列で表示  |

---

## 🧱 データベース構造（Drizzle ORM）

主要テーブル：

* `persons`（開発者情報）
* `organizations`（組織情報）
* `activities`（行動記録）
* `campaigns`（施策）
* `budgets`（費用）
* `roi_results`（ROI集計結果）
* `plugins`（登録プラグイン）
* `plugin_logs`（実行ログ）
* `tenants`（SaaS用テナント管理）

テナントスコープにはすべて `tenant_id` を保持。
RLSによりSaaS環境でデータを安全に分離。

---

## 📈 ダッシュボード構成

| ビュー            | 機能                        |
| -------------- | ------------------------- |
| **Overview**   | 総アクティビティ数・ROI平均・開発者数・施策件数 |
| **Funnel**     | ファネル別ステータス・ドロップ率・推移グラフ    |
| **ROI**        | 投資カテゴリ別・施策別ROI表示（AI補正あり）  |
| **Developers** | 開発者リスト・スコア・最新アクティビティ      |
| **Plugins**    | プラグインごとの分析ウィジェット一覧        |
| **Logs**       | cronジョブ・データ収集結果の履歴表示      |

---

## 🔄 データ収集と更新

* **バックグラウンド処理:**
  Redisキュー + cronジョブで定期実行（例：15分 / 6時間 / 1日間隔）
* **手動更新:**
  プラグインの「再取得」ボタンから即時実行可能
* **外部呼び出し:**
  APIルーティング（Webhook）で任意のタイミングにデータ同期可能
* **ログ管理:**
  すべてのプラグイン実行結果は `plugin_logs` に保存し、管理画面から閲覧可能

---

## ☁️ SaaS拡張機能

| 機能            | 内容                      |
| ------------- | ----------------------- |
| **テナント管理**    | `tenant_id` により全データを隔離  |
| **監査ログ**      | 操作履歴を `audit_logs` に記録  |
| **課金・ライセンス**  | Stripe APIによる自動更新       |
| **Webhook通知** | ROI更新・施策完了・エラー検知などを外部通知 |
| **AI連携**      | ROI推定・施策提案・レポート生成       |
| **レート制限**     | 各テナント/プラグイン単位で設定可能      |

---

## 🔐 セキュリティ・権限

| ロール           | 権限                     |
| ------------- | ---------------------- |
| **Admin**     | すべての管理権限（プラグイン・ユーザー設定） |
| **Manager**   | 施策登録・ROI閲覧・レポート出力      |
| **Viewer**    | ダッシュボード閲覧のみ            |
| **AI Engine** | 読み取り専用（AI学習用）          |

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
      - redis
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
  redis:
    image: redis:7
    command: ["redis-server", "/usr/local/etc/redis/redis.conf"]
    volumes:
      - ./redis/data:/data
```

---

## 🧠 今後の拡張候補

* **AI施策シミュレーター**
  予算・効果・期間を入力しROIを試算
* **プラグインマーケットプレイス**
  OSS/クラウド両対応の拡張モジュール配信
* **Webhook連携強化**
  施策更新やAI提案をSlack/Discordへ自動通知
* **テンプレート機能**
  定型イベント・施策を再利用可能に
* **自動レポート生成**
  月次レポートをPDF/Markdownで出力
