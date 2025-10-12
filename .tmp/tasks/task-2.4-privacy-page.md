# Task 2.4: プライバシーポリシーページ作成

**ステータス**: ドキュメントのみ（実装待ち）
**担当**: 未定
**推定時間**: 2時間
**依存**: Task 2.1

## 概要

DevCle（デブクル）のプライバシーポリシーページを作成します。GDPR・CCPA対応を含む、法的に適切なプライバシーポリシーを提供します。

## 完了条件

- [ ] プライバシーポリシーページ（`/privacy`）が表示される
- [ ] GDPR・CCPA対応のプライバシーポリシーが記載されている
- [ ] データ収集・利用・保管方針が明記されている
- [ ] ナビゲーション（ヘッダー）とフッターが表示される

## 実装内容

### 1. ページコンポーネント

#### ファイル: `core/app/routes/privacy.mdx`

```tsx
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy - DevCle" },
    {
      name: "description",
      content: "DevCleのプライバシーポリシー。個人情報の収集、利用、保護方針について説明します。"
    },
  ];
};

export default function Privacy() {
  // プライバシーポリシーの全文を表示
  // TailwindCSSのプロセスクラスでマークダウンスタイルを適用
  return (
    <div className="min-h-screen bg-white">
      {/* 実装内容: ヘッダー */}
      {/* 実装内容: プライバシーポリシーコンテンツ */}
      {/* 実装内容: フッター */}
    </div>
  );
}
```

**説明**:
- Remixの`MetaFunction`でSEOメタデータを設定
- ヘッダー: トップページへの戻るリンク
- メインコンテンツ: プライバシーポリシーの全文
- フッター: 利用規約へのリンク

### 2. プライバシーポリシーの構成

#### 2.1 ヘッダーセクション

```tsx
interface HeaderProps {
  title: string;
  lastUpdated: string;
}

function PrivacyHeader({ title, lastUpdated }: HeaderProps) {
  // タイトルと最終更新日を表示
  // トップページへの戻るリンク
}
```

**説明**:
- `title`: "プライバシーポリシー" / "Privacy Policy"
- `lastUpdated`: 最終更新日（例: "2025年10月12日"）
- ホームリンク: `/`へのリンク

#### 2.2 プライバシーポリシーコンテンツ

```tsx
interface PrivacySection {
  id: string;
  title: string;
  content: string | string[];
}

interface PrivacyContentProps {
  sections: PrivacySection[];
}

function PrivacyContent({ sections }: PrivacyContentProps) {
  // セクションごとに見出しと本文を表示
  // マークダウンスタイルで読みやすく
}
```

**説明**:

プライバシーポリシーは以下のセクションで構成されます：

1. **第1条（収集する情報）**
   - アカウント情報（メールアドレス、氏名）
   - 開発者データ（GitHub ID、SNS ID、メールアドレス）
   - 活動データ（イベント参加、コントリビューション）
   - 技術情報（IPアドレス、ブラウザ情報、アクセスログ）

2. **第2条（情報の利用目的）**
   - サービスの提供・運営
   - ユーザーサポート
   - サービスの改善・新機能開発
   - 統計データの分析
   - セキュリティ対策

3. **第3条（第三者への提供）**
   - 原則として第三者に提供しない
   - 法令に基づく開示要求がある場合
   - ユーザーの同意がある場合
   - 統計データ（匿名化済み）の公開

4. **第4条（Cookie・トラッキング技術）**
   - 認証Cookie（セッション管理）
   - 分析ツール（PostHog、Google Analytics等）
   - Cookieの無効化方法
   - Do Not Track（DNT）対応

5. **第5条（セキュリティ対策）**
   - データの暗号化（SSL/TLS）
   - アクセス制御（RLS、RBAC）
   - 定期的なセキュリティ監査
   - インシデント対応体制

6. **第6条（データの保管と削除）**
   - データの保管期間
   - アカウント削除時のデータ削除
   - バックアップデータの保管期間
   - 削除要請への対応（14日以内）

7. **第7条（ユーザーの権利）**
   - データアクセス権（閲覧・エクスポート）
   - データ訂正権（誤情報の修正）
   - データ削除権（忘れられる権利）
   - データポータビリティ権（データ移行）
   - 処理制限権（GDPR対応）
   - オプトアウト権（CCPA対応）

8. **第8条（未成年者の利用）**
   - 13歳未満の利用禁止
   - 18歳未満の保護者同意
   - 未成年者データの特別保護

9. **第9条（国際データ転送）**
   - データの保管場所（日本・米国・EU）
   - GDPR適合性（Standard Contractual Clauses）
   - データ転送の同意

10. **第10条（プライバシーポリシーの変更）**
    - 変更時の通知方法（メール・ダッシュボード）
    - 変更後の継続利用による同意
    - 重要な変更時の明示的同意取得

11. **第11条（問い合わせ先）**
    - データ保護責任者（DPO）の連絡先
    - 問い合わせフォームのリンク
    - 苦情申し立て手続き

#### 2.3 スタイリング

```tsx
interface PrivacyStyleClasses {
  container: string;      // "max-w-4xl mx-auto px-4 py-8"
  heading1: string;       // "text-3xl font-bold mb-6"
  heading2: string;       // "text-2xl font-semibold mt-8 mb-4"
  heading3: string;       // "text-xl font-medium mt-6 mb-3"
  paragraph: string;      // "text-gray-700 leading-relaxed mb-4"
  list: string;          // "list-disc list-inside space-y-2 ml-4"
  link: string;          // "text-blue-600 hover:underline"
  table: string;         // "min-w-full divide-y divide-gray-200 my-6"
}
```

**説明**:
- TailwindCSSの`prose`クラスを活用（`@tailwindcss/typography`プラグイン）
- レスポンシブデザイン: モバイルでも読みやすい行間・フォントサイズ
- リンク: 青色で下線、ホバー時に視覚的フィードバック
- 表組み: データ分類表などで使用

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
// 言語属性（lang="ja"）の設定
```

**説明**:
- `<article>`タグでプライバシーポリシー全体をマークアップ
- 見出しレベルの一貫性（h1→h2→h3）
- スクリーンリーダー対応
- WCAG 2.1 AA準拠

## データフロー

```
User → GET /privacy
  → app/routes/privacy.mdx
  → PrivacyPage Component
  → Header / Content / Footer
  → Response (HTML)
```

## テストケース

### 単体テスト

```typescript
// core/app/routes/privacy.test.tsx
import { render, screen } from "@testing-library/react";
import Privacy from "./privacy";

describe("Privacy Page", () => {
  test("displays page title", () => {
    // ページタイトル「プライバシーポリシー」が表示されることを確認
  });

  test("displays all sections", () => {
    // 第1条〜第11条のすべてのセクションが表示されることを確認
  });

  test("displays last updated date", () => {
    // 最終更新日が表示されることを確認
  });

  test("has link to home page", () => {
    // ホームページへのリンクがあることを確認
  });

  test("has link to terms of service", () => {
    // 利用規約へのリンクがあることを確認
  });

  test("displays contact information", () => {
    // 問い合わせ先が表示されることを確認
  });
});
```

### E2Eテスト

```typescript
// e2e/privacy.spec.ts
import { test, expect } from "@playwright/test";

test("privacy page loads correctly", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("h1")).toContainText("プライバシーポリシー");
});

test("can navigate back to home", async ({ page }) => {
  await page.goto("/privacy");
  await page.click('a[href="/"]');
  await expect(page).toHaveURL("/");
});

test("can navigate to terms of service", async ({ page }) => {
  await page.goto("/privacy");
  await page.click('a[href="/terms"]');
  await expect(page).toHaveURL("/terms");
});

test("all sections are visible", async ({ page }) => {
  await page.goto("/privacy");
  for (let i = 1; i <= 11; i++) {
    await expect(page.locator(`text=/第${i}条/`)).toBeVisible();
  }
});

test("displays GDPR rights section", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("text=/ユーザーの権利/")).toBeVisible();
  await expect(page.locator("text=/データアクセス権/")).toBeVisible();
});
```

## 設計上の考慮事項

### 法的コンプライアンス

- **GDPR対応**: EU居住者の権利を保護（データアクセス、削除、移行）
- **CCPA対応**: カリフォルニア州居住者の権利を保護（オプトアウト）
- **個人情報保護法**: 日本の法令に準拠
- **データ分類**: 個人情報の種類と保護レベルを明記

### 透明性の確保

- **平易な言葉**: 法的文書でありながら理解しやすい表現
- **具体例**: Cookie・トラッキングの具体的な利用例を記載
- **視覚化**: データフロー図やアイコンで理解を促進

### 多言語対応

- 初期は日本語のみ
- 将来的に英語版を追加（`/en/privacy`）
- i18nライブラリ（`remix-i18next`）の導入を検討

### バージョン管理

- ポリシー変更時の履歴管理
- ユーザーへの変更通知（メール・ダッシュボード通知）
- 過去バージョンへのアクセス（`/privacy?version=1.0`）

### レスポンシブ対応

- モバイルファースト設計
- 長文でも読みやすい行間・フォントサイズ
- 目次（Table of Contents）の追加（将来的に）
- アンカーリンクでセクションジャンプ

## 依存関係

### パッケージ

- `@remix-run/react`: Remixフレームワーク
- `tailwindcss`: スタイリング
- `@tailwindcss/typography`: プロセスクラス（オプション）

### 内部依存

- `app/root.tsx`: ルートレイアウト
- `/`: トップページ（ホームリンク）
- `/terms`: 利用規約（フッターリンク）

## 注意事項

- **実装は含まない**: このドキュメントはインターフェース定義のみ
- **法的レビュー**: 実際のサービス公開前に弁護士によるレビューを推奨
- **定期的な更新**: データ処理方法の変更に応じてポリシーを更新
- **同意取得UI**: 初回登録時およびポリシー変更時に同意取得UIを実装（将来的に）
- **Cookie同意バナー**: GDPR対応のCookie同意バナーを実装（将来的に）

## 次のステップ

1. レビュー後、実装フェーズに移行
2. プライバシーポリシーの文言の最終確認（法的レビュー）
3. Task 2.3（利用規約）との整合性確認
4. ヘッダーコンポーネントの共通化（LP、規約、プライバシーポリシーで共通化）
5. Cookie同意バナーの設計（GDPR対応）

## 関連ドキュメント

- [.tmp/requirements.md](.tmp/requirements.md) - 要件定義
- [.tmp/design.md](.tmp/design.md) - 設計書
- [.tmp/tasks.md](.tmp/tasks.md) - タスクリスト
- [.tmp/tasks/task-2.2-landing-page.md](task-2.2-landing-page.md) - ランディングページ
- [.tmp/tasks/task-2.3-terms-page.md](task-2.3-terms-page.md) - 利用規約ページ
