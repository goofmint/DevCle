# Task 2.5: プライシングページ作成

**ステータス**: ドキュメントのみ（実装待ち）
**担当**: 未定
**推定時間**: 2時間
**依存**: Task 2.1

## 概要

DevCle（デブクル）のプライシングページを作成します。OSS版と3つのSaaSプラン（Basic, Team, Enterprise）の料金表を提供します。

## 完了条件

- [ ] プライシングページ（`/pricing`）が表示される
- [ ] 4つのプラン（OSS, Basic, Team, Enterprise）が比較表で表示される
- [ ] 各プランの料金・機能が明確に記載されている
- [ ] ナビゲーション（ヘッダー）とフッターが表示される

## 実装内容

### 1. ページコンポーネント

#### ファイル: `core/app/routes/pricing.mdx`

```tsx
export { PageLayout as default } from '~/components/page-layout';

export const meta = () => {
  return [
    { title: "Pricing - DevCle" },
    {
      name: "description",
      content: "DevCle pricing plans. Choose the best plan for your team from OSS, Basic, Team, or Enterprise."
    },
  ];
};

// Pricing page content in Markdown
```

**説明**:
- Remixの`MetaFunction`でSEOメタデータを設定
- PageLayoutコンポーネントを使用してヘッダー・フッターを表示
- MDX形式でマークダウンとReactコンポーネントを組み合わせ

### 2. プライシングページの構成

#### 2.1 ヘッダーセクション

```tsx
interface PricingHeaderProps {
  title: string;
  description: string;
}

// Header section with title and description
// Example: "Choose the Right Plan for Your Team"
```

**説明**:
- `title`: "Pricing" / "料金プラン"
- `description`: プランの概要説明
- 中央揃えで目立つデザイン

#### 2.2 プラン比較表

```tsx
interface PricingPlan {
  name: string;                  // "OSS", "Basic", "Team", "Enterprise"
  price: string;                 // "$0", "$99/mo", "$499/mo", "Custom"
  description: string;           // プランの簡単な説明
  features: PricingFeature[];    // 機能リスト
  cta: {
    text: string;                // "Get Started", "Contact Sales"
    href: string;                // リンク先
    variant: "primary" | "secondary";
  };
  recommended?: boolean;         // おすすめバッジを表示するか
}

interface PricingFeature {
  name: string;                  // 機能名
  included: boolean;             // 利用可能か
  value?: string;                // 詳細値（例: "5 users", "Unlimited"）
}

interface PricingTableProps {
  plans: PricingPlan[];
}

// Pricing table component displaying all plans
```

**説明**:

プランの詳細は以下の通り：

**OSS（無料）**
- 料金: $0 (Free)
- ホスティング: セルフホスト
- ユーザー数: 1ユーザー
- プラグイン数: 3（基本のみ）
- プラグイン例: PostHog, Google Analytics, GitHub
- データ更新: 手動 / 1日1回
- CRM・MA連携: ❌
- SSO: ❌
- 監査ログ: ❌
- 権限管理: ❌
- AI機能: ❌
- サポート: コミュニティ
- データ保持: 無制限（自前）
- CTA: "Get Started" → ドキュメントリンク

**Basic（$99/月）**
- 料金: $99/month
- ホスティング: SaaSマルチテナント
- ユーザー数: 5ユーザー
- プラグイン数: 10
- プラグイン例: 上記 + Slack, X, Discord
- データ更新: 6時間ごと
- CRM・MA連携: ❌
- SSO: ❌
- 監査ログ: ✅（簡易ログ）
- 権限管理: ❌
- AI機能: ROIレポート生成のみ
- サポート: メールサポート
- データ保持: 6ヶ月
- CTA: "Start Free Trial" → サインアップ

**Team（$499/月）** ⭐ おすすめ
- 料金: $499/month
- ホスティング: SaaSマルチテナント
- ユーザー数: 50ユーザー
- プラグイン数: 無制限
- プラグイン例: 上記 + connpass, Meetup, Notion, 外部Webhook
- データ更新: 1時間ごと
- CRM・MA連携: ❌
- SSO: ❌
- 監査ログ: ✅（詳細ログ）
- 権限管理: ✅（Admin / Viewer）
- AI機能: ROI + 施策提案 + ファネル最適化
- AIモデル選択: ✅（共有環境）
- サポート: チャット + 優先対応
- データ保持: 12ヶ月
- CTA: "Start Free Trial" → サインアップ

**Enterprise（個別見積）**
- 料金: Custom pricing
- ホスティング: セルフホスト or 専用テナント
- ユーザー数: 無制限
- プラグイン数: 無制限 + カスタム可
- プラグイン例: すべて + CRM, MA, 内部DB, SSO連携
- データ更新: 任意設定（5分〜）
- CRM・MA連携: ✅（HubSpot, Marketo等）
- 内部DB連携: ✅（BigQuery, Snowflake等）
- SSO: ✅（Google, Azure AD等）
- カスタムドメイン: ✅
- 監査ログ: ✅（SLA対応ログ + 保持期間無制限）
- 権限管理: ✅（カスタムロール）
- AI機能: すべて（AI施策試算 + 自動レポート + 異常検知）
- AIモデル選択: ✅（専用モデル / カスタムプロンプト）
- サポート: 専任サポート + SLA保証
- データ保持: 無制限 + バックアップ保証
- セキュリティ: 専用領域 + 暗号化ストレージ
- CTA: "Contact Sales" → お問い合わせフォーム

#### 2.3 機能比較表（詳細版）

```tsx
interface FeatureCategory {
  name: string;                  // カテゴリ名（例: "Core Features", "Integrations"）
  features: FeatureComparison[];
}

interface FeatureComparison {
  name: string;                  // 機能名
  oss: string | boolean;         // OSS版の対応状況
  basic: string | boolean;       // Basic版の対応状況
  team: string | boolean;        // Team版の対応状況
  enterprise: string | boolean;  // Enterprise版の対応状況
}

interface FeatureComparisonTableProps {
  categories: FeatureCategory[];
}

// Detailed feature comparison table
```

**説明**:

機能カテゴリ：

**基本機能**
- アカウント数上限: 1 / 5 / 50 / 無制限
- データ更新頻度: 手動・1日1回 / 6時間 / 1時間 / 5分〜
- APIアクセス: ✅ / ✅ / ✅ / ✅

**プラグイン**
- 利用可能プラグイン数: 3 / 10 / 無制限 / 無制限
- PostHog: ✅ / ✅ / ✅ / ✅
- Google Analytics: ✅ / ✅ / ✅ / ✅
- GitHub: ✅ / ✅ / ✅ / ✅
- Slack / X / Discord: ❌ / ✅ / ✅ / ✅
- connpass / Meetup: ❌ / ❌ / ✅ / ✅
- CRM・MA連携: ❌ / ❌ / ❌ / ✅
- 内部DB連携: ❌ / ❌ / ❌ / ✅

**セキュリティ・管理**
- SSO: ❌ / ❌ / ❌ / ✅
- 監査ログ: ❌ / 簡易 / 詳細 / SLA対応
- 権限管理: ❌ / ❌ / Admin/Viewer / カスタムロール
- カスタムドメイン: ✅（自前） / ❌ / ❌ / ✅

**AI機能**
- ROIレポート生成: ❌ / ✅ / ✅ / ✅
- 施策提案: ❌ / ❌ / ✅ / ✅
- ファネル最適化: ❌ / ❌ / ✅ / ✅
- AI異常検知: ❌ / ❌ / ❌ / ✅
- AIモデル選択: ❌ / ❌ / 共有 / 専用

**サポート**
- サポート: コミュニティ / メール / チャット+優先 / 専任+SLA
- データ保持期間: 無制限（自前） / 6ヶ月 / 12ヶ月 / 無制限

#### 2.4 FAQ（よくある質問）

```tsx
interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
}

// FAQ section with expandable accordion
```

**説明**:

よくある質問の例：

1. **Q: OSS版とSaaS版の違いは？**
   A: OSS版はセルフホストで無料。基本プラグインのみ利用可能。SaaS版はクラウドホスティングで高度なプラグイン・AI機能・サポートが利用可能。

2. **Q: 無料トライアルはありますか？**
   A: Basic・Teamプランは14日間の無料トライアルあり。クレジットカード登録不要。

3. **Q: プラン変更は可能ですか？**
   A: いつでも可能。アップグレードは即時反映。ダウングレードは次回請求日から適用。

4. **Q: データのエクスポートは可能ですか？**
   A: 全プランでJSON/CSV形式のエクスポートが可能。

5. **Q: カスタムプラグインの開発は可能ですか？**
   A: Enterpriseプランでサポート。プラグイン開発ガイドを提供。

#### 2.5 CTAセクション

```tsx
interface CTASectionProps {
  title: string;
  description: string;
  primaryButton: {
    text: string;
    href: string;
  };
  secondaryButton?: {
    text: string;
    href: string;
  };
}

// CTA section at the bottom of the page
```

**説明**:
- `title`: "Ready to Get Started?" / "今すぐ始めましょう"
- `description`: "Choose a plan that fits your needs"
- `primaryButton`: "Start Free Trial" → サインアップページ
- `secondaryButton`: "Contact Sales" → お問い合わせフォーム

#### 2.6 スタイリング

```tsx
interface PricingStyleClasses {
  container: string;       // "max-w-7xl mx-auto px-4 py-12"
  header: string;          // "text-center mb-12"
  title: string;           // "text-4xl font-bold mb-4"
  description: string;     // "text-xl text-gray-600"
  plansGrid: string;       // "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
  planCard: string;        // "border rounded-lg p-6 shadow-lg"
  recommendedBadge: string; // "bg-blue-600 text-white px-3 py-1 rounded-full"
  featureTable: string;    // "min-w-full divide-y divide-gray-200"
  ctaSection: string;      // "bg-blue-50 rounded-lg p-8 mt-12"
}
```

**説明**:
- TailwindCSSで統一されたデザイン
- レスポンシブ対応（モバイル: 1列、タブレット: 2列、PC: 4列）
- おすすめプランは青色で強調
- 各プランカードにホバーエフェクト

### 3. アクセシビリティ

```tsx
interface A11yProps {
  ariaLabel: string;
  role?: string;
  tabIndex?: number;
}

// Semantic HTML (<table>, <caption>, <th>, <td>) for pricing table
// Proper heading hierarchy (h1 → h2 → h3)
// Keyboard navigation support for interactive elements
// ARIA labels for icons and badges
```

**説明**:
- 料金表は`<table>`タグでマークアップ
- 見出し階層の正しい構造化（h1 → h2 → h3）
- スクリーンリーダー対応
- WCAG 2.1 AA準拠

## データフロー

```
User → GET /pricing
  → app/routes/pricing.mdx
  → PricingPage Component
  → Header / Plans / Features / FAQ / CTA / Footer
  → Response (HTML)
```

## テストケース

### 単体テスト

```typescript
// core/app/routes/pricing.test.tsx
import { render, screen } from "@testing-library/react";
import Pricing from "./pricing";

describe("Pricing Page", () => {
  test("displays page title", () => {
    // ページタイトル「Pricing」が表示されることを確認
  });

  test("displays all plans", () => {
    // 4つのプラン（OSS, Basic, Team, Enterprise）が表示されることを確認
  });

  test("displays recommended badge on Team plan", () => {
    // Teamプランにおすすめバッジが表示されることを確認
  });

  test("displays feature comparison table", () => {
    // 機能比較表が表示されることを確認
  });

  test("displays FAQ section", () => {
    // FAQセクションが表示されることを確認
  });

  test("has CTA buttons", () => {
    // 各プランのCTAボタンが表示されることを確認
  });
});
```

### E2Eテスト

```typescript
// e2e/pricing.spec.ts
import { test, expect } from "@playwright/test";

test("pricing page loads correctly", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("h1")).toContainText("Pricing");
});

test("can navigate to signup from pricing page", async ({ page }) => {
  await page.goto("/pricing");
  await page.click('a:has-text("Start Free Trial")');
  // サインアップページへの遷移を確認（将来実装）
});

test("all plans are visible", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator('text=/OSS/i')).toBeVisible();
  await expect(page.locator('text=/Basic/i')).toBeVisible();
  await expect(page.locator('text=/Team/i')).toBeVisible();
  await expect(page.locator('text=/Enterprise/i')).toBeVisible();
});

test("recommended badge is visible on Team plan", async ({ page }) => {
  await page.goto("/pricing");
  const teamCard = page.locator('[data-plan="team"]');
  await expect(teamCard.locator('text=/Recommended/i')).toBeVisible();
});

test("displays correctly on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/pricing");
  await expect(page.locator("h1")).toBeVisible();
});
```

## 設計上の考慮事項

### 料金表の明確性

- 各プランの違いを一目で理解できる
- 機能の有無を視覚的に表現（✅/❌アイコン）
- 数値は具体的に記載（"5 users", "50 users"など）

### CTAの配置

- 各プランカードにCTAボタンを配置
- ページ最下部にも大きなCTAセクションを配置
- プランに応じてCTAテキストを変更（"Get Started", "Start Free Trial", "Contact Sales"）

### レスポンシブ対応

- モバイル: 縦スクロールでプランを1つずつ表示
- タブレット: 2列グリッド
- PC: 4列グリッド（プランカードを横並び）
- 機能比較表は横スクロール可能

### 価格表示

- 月額料金を強調（大きなフォント）
- 年額オプションの追加（将来的に）
- 通貨記号は明確に表示（$, ¥など）

## 依存関係

### パッケージ

- `@remix-run/react`: Remixフレームワーク
- `tailwindcss`: スタイリング
- `@heroicons/react`: アイコン（チェックマーク、×マークなど）

### 内部依存

- `app/root.tsx`: ルートレイアウト
- `~/components/page-layout`: ヘッダー・フッター共通コンポーネント
- `/`: トップページ（ホームリンク）

## 注意事項

- **実装は含まない**: このドキュメントはインターフェース定義のみ
- **料金は暫定**: 実際のサービス公開前に料金見直しの可能性あり
- **無料トライアル**: サインアップ機能実装後に有効化
- **Contact Sales**: お問い合わせフォーム実装が必要（将来的に）
- **通貨対応**: 初期は米ドルのみ、将来的に日本円・ユーロなど追加

## 次のステップ

1. レビュー後、実装フェーズに移行
2. プランの料金・機能の最終確認
3. サインアップフローの設計（Task 3.x以降）
4. お問い合わせフォームの実装（将来的に）

## 関連ドキュメント

- [.tmp/requirements.md](.tmp/requirements.md) - 要件定義
- [.tmp/design.md](.tmp/design.md) - 設計書
- [.tmp/tasks.md](.tmp/tasks.md) - タスクリスト
- [.tmp/pricing.md](.tmp/pricing.md) - 料金表詳細
- [.tmp/tasks/task-2.2-landing-page.md](task-2.2-landing-page.md) - ランディングページ
