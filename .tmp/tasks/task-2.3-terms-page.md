# Task 2.3: 利用規約ページ作成

**ステータス**: ドキュメントのみ（実装待ち）
**担当**: 未定
**推定時間**: 2時間
**依存**: Task 2.1

## 概要

DevCle（デブクル）の利用規約ページを作成します。OSS版とSaaS版の両方に対応した、法的に適切な利用規約を提供します。

## 完了条件

- [ ] 利用規約ページ（`/terms`）が表示される
- [ ] OSS版・SaaS版共通の利用規約が記載されている
- [ ] TailwindCSSでマークダウンスタイルが適用されている
- [ ] ナビゲーション（ヘッダー）とフッターが表示される

## 実装内容

### 1. ページコンポーネント

#### ファイル: `core/app/routes/terms.tsx`

```tsx
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service - DevCle" },
    {
      name: "description",
      content: "DevCle利用規約。サービスの利用条件、ユーザーの権利と義務について説明します。"
    },
  ];
};

export default function Terms() {
  // 利用規約の全文を表示
  // TailwindCSSのプロセスクラスでマークダウンスタイルを適用
  return (
    <div className="min-h-screen bg-white">
      {/* 実装内容: ヘッダー */}
      {/* 実装内容: 利用規約コンテンツ */}
      {/* 実装内容: フッター */}
    </div>
  );
}
```

**説明**:
- Remixの`MetaFunction`でSEOメタデータを設定
- ヘッダー: トップページへの戻るリンク
- メインコンテンツ: 利用規約の全文
- フッター: プライバシーポリシーへのリンク

### 2. 利用規約の構成

#### 2.1 ヘッダーセクション

```tsx
interface HeaderProps {
  title: string;
  lastUpdated: string;
}

function TermsHeader({ title, lastUpdated }: HeaderProps) {
  // タイトルと最終更新日を表示
  // トップページへの戻るリンク
}
```

**説明**:
- `title`: "利用規約" / "Terms of Service"
- `lastUpdated`: 最終更新日（例: "2025年10月12日"）
- ホームリンク: `/`へのリンク

#### 2.2 利用規約コンテンツ

```tsx
interface TermsSection {
  id: string;
  title: string;
  content: string | string[];
}

interface TermsContentProps {
  sections: TermsSection[];
}

function TermsContent({ sections }: TermsContentProps) {
  // セクションごとに見出しと本文を表示
  // マークダウンスタイルで読みやすく
}
```

**説明**:

利用規約は以下のセクションで構成されます：

1. **第1条（適用範囲）**
   - サービスの提供範囲
   - OSS版とSaaS版の違い
   - 規約の適用対象

2. **第2条（定義）**
   - ユーザー、サービス、コンテンツの定義
   - テナント、開発者データの定義

3. **第3条（利用登録）**
   - アカウント作成方法
   - ユーザーの責任（ID・パスワード管理）
   - 登録情報の正確性

4. **第4条（プライバシーとデータ保護）**
   - 個人情報の取り扱い（プライバシーポリシーへの参照）
   - データの所有権（ユーザーのデータはユーザーに帰属）
   - データのエクスポート権

5. **第5条（禁止事項）**
   - 不正アクセス、スパム行為の禁止
   - 第三者の権利侵害の禁止
   - サービスの妨害行為の禁止

6. **第6条（サービスの変更・停止）**
   - サービス内容の変更権
   - メンテナンスによる一時停止
   - サービス終了時の通知義務

7. **第7条（免責事項）**
   - サービスの可用性保証の制限
   - データ損失の免責
   - 間接損害の免責

8. **第8条（知的財産権）**
   - ソフトウェアのライセンス（OSS版: MIT/BSL、SaaS版: 商用）
   - ユーザーコンテンツの権利
   - 商標の使用制限

9. **第9条（準拠法と管轄裁判所）**
   - 日本法に準拠
   - 東京地方裁判所を第一審の専属管轄裁判所とする

10. **第10条（規約の変更）**
    - 規約変更時の通知方法
    - 変更後の継続利用による同意

#### 2.3 スタイリング

```tsx
interface TermsStyleClasses {
  container: string;      // "max-w-4xl mx-auto px-4 py-8"
  heading1: string;       // "text-3xl font-bold mb-6"
  heading2: string;       // "text-2xl font-semibold mt-8 mb-4"
  paragraph: string;      // "text-gray-700 leading-relaxed mb-4"
  list: string;          // "list-disc list-inside space-y-2"
  link: string;          // "text-blue-600 hover:underline"
}
```

**説明**:
- TailwindCSSの`prose`クラスを活用（`@tailwindcss/typography`プラグイン）
- レスポンシブデザイン: モバイルでも読みやすい行間・フォントサイズ
- リンク: 青色で下線、ホバー時に視覚的フィードバック

### 3. アクセシビリティ

```tsx
interface A11yProps {
  ariaLabel: string;
  role?: string;
  tabIndex?: number;
}

// セマンティックHTML（<article>, <section>, <h1>-<h6>）の使用
// 見出し階層の正しい構造化
// フォーカス可能な要素のキーボードナビゲーション対応
```

**説明**:
- `<article>`タグで利用規約全体をマークアップ
- 見出しレベルの一貫性（h1→h2→h3）
- スクリーンリーダー対応

## データフロー

```
User → GET /terms
  → app/routes/terms.tsx
  → TermsPage Component
  → Header / Content / Footer
  → Response (HTML)
```

## テストケース

### 単体テスト

```typescript
// core/app/routes/terms.test.tsx
import { render, screen } from "@testing-library/react";
import Terms from "./terms";

describe("Terms Page", () => {
  test("displays page title", () => {
    // ページタイトル「利用規約」が表示されることを確認
  });

  test("displays all sections", () => {
    // 第1条〜第10条のすべてのセクションが表示されることを確認
  });

  test("displays last updated date", () => {
    // 最終更新日が表示されることを確認
  });

  test("has link to home page", () => {
    // ホームページへのリンクがあることを確認
  });

  test("has link to privacy policy", () => {
    // プライバシーポリシーへのリンクがあることを確認
  });
});
```

### E2Eテスト

```typescript
// e2e/terms.spec.ts
import { test, expect } from "@playwright/test";

test("terms page loads correctly", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.locator("h1")).toContainText("利用規約");
});

test("can navigate back to home", async ({ page }) => {
  await page.goto("/terms");
  await page.click('a[href="/"]');
  await expect(page).toHaveURL("/");
});

test("can navigate to privacy policy", async ({ page }) => {
  await page.goto("/terms");
  await page.click('a[href="/privacy"]');
  await expect(page).toHaveURL("/privacy");
});

test("all sections are visible", async ({ page }) => {
  await page.goto("/terms");
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator(`text=/第${i}条/`)).toBeVisible();
  }
});
```

## 設計上の考慮事項

### 法的コンプライアンス

- **OSS版とSaaS版の共通性**: 両方に適用可能な汎用的な規約
- **データ保護**: GDPR、CCPAに準拠したデータの権利記載
- **免責事項**: OSS版では特に「現状有姿」の免責を明記

### 多言語対応

- 初期は日本語のみ
- 将来的に英語版を追加（`/en/terms`）
- i18nライブラリ（`remix-i18next`）の導入を検討

### バージョン管理

- 規約変更時の履歴管理
- ユーザーへの変更通知（メール・ダッシュボード通知）
- 過去バージョンへのアクセス（`/terms?version=1.0`）

### レスポンシブ対応

- モバイルファースト設計
- 長文でも読みやすい行間・フォントサイズ
- 目次（Table of Contents）の追加（将来的に）

## 依存関係

### パッケージ

- `@remix-run/react`: Remixフレームワーク
- `tailwindcss`: スタイリング
- `@tailwindcss/typography`: プロセスクラス（オプション）

### 内部依存

- `app/root.tsx`: ルートレイアウト
- `/`: トップページ（ホームリンク）
- `/privacy`: プライバシーポリシー（フッターリンク）

## 注意事項

- **実装は含まない**: このドキュメントはインターフェース定義のみ
- **法的レビュー**: 実際のサービス公開前に弁護士によるレビューを推奨
- **定期的な更新**: サービス内容の変更に応じて規約を更新
- **ユーザー同意**: 初回登録時および規約変更時に同意取得UIを実装（将来的に）

## 次のステップ

1. レビュー後、実装フェーズに移行
2. 利用規約の文言の最終確認（法的レビュー）
3. Task 2.4（プライバシーポリシー）との整合性確認
4. ヘッダーコンポーネントの共通化（LP、規約、プライバシーポリシーで共通化）

## 関連ドキュメント

- [.tmp/requirements.md](.tmp/requirements.md) - 要件定義
- [.tmp/design.md](.tmp/design.md) - 設計書
- [.tmp/tasks.md](.tmp/tasks.md) - タスクリスト
- [.tmp/tasks/task-2.2-landing-page.md](task-2.2-landing-page.md) - ランディングページ
