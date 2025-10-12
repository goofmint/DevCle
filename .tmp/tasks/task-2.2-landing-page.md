# Task 2.2: LP（トップページ）作成

**ステータス**: ドキュメントのみ（実装待ち）
**担当**: 未定
**推定時間**: 3時間
**依存**: Task 2.1

## 概要

DevCle（デブクル）のランディングページを作成します。ユーザーに製品の価値を伝え、ダッシュボードへのアクセスや詳細情報へ誘導するためのトップページです。

## 完了条件

- [ ] トップページ（`/`）が表示される
- [ ] ヒーローセクション、機能紹介、CTAが実装されている
- [ ] レスポンシブデザインが適用されている
- [ ] フッターに規約・プライバシーポリシーへのリンクがある

## 実装内容

### 1. ページコンポーネント

#### ファイル: `core/app/routes/_index.tsx`

```tsx
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "DevCle - Developer Relationship Management" },
    {
      name: "description",
      content: "Track developer engagement, measure DevRel ROI, and analyze community funnels with DevCle."
    },
  ];
};

export default function Index() {
  // ヒーローセクション、機能紹介、CTA、フッターを含むランディングページ
  // TailwindCSSを使用してスタイリング
  return (
    <div className="min-h-screen bg-white">
      {/* 実装内容: ヒーローセクション */}
      {/* 実装内容: 機能紹介セクション */}
      {/* 実装内容: CTAセクション */}
      {/* 実装内容: フッター */}
    </div>
  );
}
```

**説明**:
- Remixの`MetaFunction`でSEOメタデータを設定
- ヒーローセクション: キャッチコピーとCTAボタン
- 機能紹介: DRM、ROI、Funnelの3つの主要機能
- フッター: 規約・プライバシーポリシー・ドキュメントへのリンク

### 2. セクション構成

#### 2.1 ヒーローセクション

```tsx
interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

function HeroSection({ title, subtitle, ctaText, ctaLink }: HeroSectionProps) {
  // 大きな見出し、サブタイトル、CTAボタンを表示
  // グラデーション背景やアニメーションで視覚的に魅力的に
}
```

**説明**:
- `title`: メインキャッチコピー（例: "Developer Relationship Management"）
- `subtitle`: 説明文（例: "開発者とのエンゲージメントを可視化し、DevRelの投資対効果を測定"）
- `ctaText`: CTAボタンテキスト（例: "ダッシュボードを見る"）
- `ctaLink`: CTAリンク先（例: "/dashboard"）

#### 2.2 機能紹介セクション

```tsx
interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesSectionProps {
  features: Feature[];
}

function FeaturesSection({ features }: FeaturesSectionProps) {
  // 3カラムグリッドで主要機能を紹介
  // アイコン、タイトル、説明文を各カードに表示
}
```

**説明**:
- 3つの主要機能を紹介:
  1. **DRM（Developer Relationship Management）**: 開発者の活動を一元管理
  2. **ROI分析**: DevRel施策の投資対効果を測定
  3. **ファネル分析**: Awareness→Engagement→Adoption→Advocacyの推移を可視化
- カード形式でアイコン付きで表示

#### 2.3 CTAセクション

```tsx
interface CTASectionProps {
  title: string;
  subtitle: string;
  primaryCTA: {
    text: string;
    link: string;
  };
  secondaryCTA: {
    text: string;
    link: string;
  };
}

function CTASection({ title, subtitle, primaryCTA, secondaryCTA }: CTASectionProps) {
  // 2つのCTAボタンを表示（プライマリ・セカンダリ）
  // 例: "今すぐ始める" / "ドキュメントを読む"
}
```

**説明**:
- プライマリCTA: ダッシュボードへの誘導
- セカンダリCTA: ドキュメントやデモへの誘導

#### 2.4 フッター

```tsx
interface FooterLink {
  text: string;
  href: string;
}

interface FooterProps {
  links: FooterLink[];
  copyright: string;
}

function Footer({ links, copyright }: FooterProps) {
  // フッターリンク（規約、プライバシーポリシー、GitHubなど）
  // コピーライト表示
}
```

**説明**:
- リンク:
  - `/terms`: 利用規約
  - `/privacy`: プライバシーポリシー
  - GitHub リポジトリ（OSS版の場合）
- コピーライト: "© 2025 DevCle. All rights reserved."

### 3. スタイリング

#### TailwindCSSクラスの活用

```tsx
// 実装例のインターフェース定義
interface TailwindClassNames {
  container: string;      // "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
  heading: string;        // "text-4xl md:text-6xl font-bold"
  subheading: string;     // "text-xl md:text-2xl text-gray-600"
  button: {
    primary: string;      // "bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
    secondary: string;    // "bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg"
  };
  card: string;          // "bg-white shadow-lg rounded-lg p-6"
}
```

**説明**:
- レスポンシブデザイン: `sm:`, `md:`, `lg:`ブレークポイントを使用
- カラーパレット: ブルー系をメインカラーとして使用
- シャドウ・角丸: カードやボタンに視覚的な深みを追加

### 4. アクセシビリティ

```tsx
interface A11yProps {
  ariaLabel: string;
  role?: string;
  tabIndex?: number;
}

// すべてのインタラクティブ要素にaria-label属性を追加
// フォーカス状態の視覚的フィードバック
// キーボードナビゲーション対応
```

**説明**:
- `aria-label`でスクリーンリーダー対応
- フォーカス時のアウトライン表示
- セマンティックHTML（`<nav>`, `<main>`, `<footer>`）の使用

## データフロー

```
User → GET /
  → app/routes/_index.tsx
  → LandingPage Component
  → Hero / Features / CTA / Footer
  → Response (HTML)
```

## テストケース

### 単体テスト

```typescript
// core/app/routes/_index.test.tsx
import { render, screen } from "@testing-library/react";
import Index from "./_index";

describe("Landing Page", () => {
  test("displays hero section", () => {
    // ヒーローセクションが表示されることを確認
  });

  test("displays feature cards", () => {
    // 3つの機能カードが表示されることを確認
  });

  test("displays CTA buttons", () => {
    // CTAボタンが表示され、正しいリンクがあることを確認
  });

  test("displays footer links", () => {
    // フッターに規約・プライバシーポリシーリンクがあることを確認
  });
});
```

### E2Eテスト

```typescript
// e2e/landing-page.spec.ts
import { test, expect } from "@playwright/test";

test("landing page loads correctly", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Developer Relationship Management");
});

test("CTA button navigates to dashboard", async ({ page }) => {
  await page.goto("/");
  await page.click('a[href="/dashboard"]');
  await expect(page).toHaveURL(/\/dashboard/);
});

test("footer links are clickable", async ({ page }) => {
  await page.goto("/");
  await page.click('a[href="/terms"]');
  await expect(page).toHaveURL(/\/terms/);
});
```

## 設計上の考慮事項

### パフォーマンス

- 画像の遅延読み込み（`loading="lazy"`）
- CSSの最小化（TailwindCSSのPurge機能）
- 初期表示時の静的コンテンツのみ（クライアントサイドの非同期処理なし）

### SEO

- メタタグ（title, description）の最適化
- セマンティックHTML構造
- 構造化データ（JSON-LD）の追加（将来的に）

### レスポンシブ対応

- モバイルファースト設計
- タブレット・デスクトップでの表示最適化
- タッチ対応（ボタンサイズ48x48px以上）

## 依存関係

### パッケージ

- `@remix-run/react`: Remixフレームワーク
- `tailwindcss`: スタイリング

### 内部依存

- `app/root.tsx`: ルートレイアウト
- `/terms`, `/privacy`: フッターリンク先（Task 2.3, 2.4）

## 注意事項

- **実装は含まない**: このドキュメントはインターフェース定義のみ
- **将来的な拡張**: ブログ記事一覧、お客様の声セクションなどの追加が可能
- **多言語対応**: 初期は英語のみ、将来的に日本語対応を検討
- **ダークモード**: 初期は未対応、将来的に追加可能

## 次のステップ

1. レビュー後、実装フェーズに移行
2. デザインモックアップの作成（オプション）
3. コンテンツ文言の最終確認
4. Task 2.3（利用規約）、Task 2.4（プライバシーポリシー）との統合

## 関連ドキュメント

- [.tmp/requirements.md](.tmp/requirements.md) - 要件定義
- [.tmp/design.md](.tmp/design.md) - 設計書
- [.tmp/tasks.md](.tmp/tasks.md) - タスクリスト
