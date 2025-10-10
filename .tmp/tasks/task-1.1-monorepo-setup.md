# Task 1.1: プロジェクト構造とモノレポ初期化

**Phase**: 1 - 環境構築とインフラ基盤
**推定時間**: 2時間
**依存タスク**: なし

## 概要

DRMプロジェクトのモノレポ構造を構築し、3つのパッケージ（core, posthog, webhook）の初期設定を行う。

## 目標

- pnpm workspaceによるモノレポ構成
- TypeScript strict mode（`exactOptionalPropertyTypes`含む）の設定
- ESLint 9 flat config による静的解析
- Prettier による統一されたコードフォーマット
- 各パッケージで独立した lint/format/test 環境

## 実装内容

### 1. pnpm workspace設定

```yaml
# pnpm-workspace.yaml
packages:
  - 'core'
  - 'plugins/posthog'
  - 'plugins/webhook'
```

### 2. core パッケージ構成

```typescript
// core/package.json
{
  "name": "@drm/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "remix vite:dev",
    "build": "remix vite:build",
    "start": "remix-serve ./build/server/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest"
  },
  "dependencies": {
    "@remix-run/node": "^2.x",
    "@remix-run/react": "^2.x",
    "@remix-run/serve": "^2.x",
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "@remix-run/dev": "^2.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "typescript": "^5.9.0",
    "eslint": "^9.x",
    "prettier": "^3.x",
    "vitest": "^2.x",
    "vite": "^5.x"
  }
}
```

**ディレクトリ構造:**

```
core/
├── app/               # Remix アプリケーション
│   ├── routes/       # ページルート
│   ├── components/   # UI コンポーネント
│   └── root.tsx      # ルートレイアウト
├── db/               # Drizzle ORM スキーマとマイグレーション
├── services/         # ビジネスロジック
├── plugin-system/    # プラグインシステムのコア
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── package.json
```

### 3. posthog パッケージ構成

```typescript
// plugins/posthog/package.json
{
  "name": "@drm/posthog",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest"
  },
  "dependencies": {
    "posthog-node": "^4.x"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "eslint": "^9.x",
    "prettier": "^3.x",
    "vitest": "^2.x"
  }
}
```

**ディレクトリ構造:**

```
plugins/posthog/
├── src/
│   ├── index.ts      # プラグインエントリーポイント
│   ├── services/     # PostHog API連携サービス
│   └── types/        # 型定義
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── package.json
```

### 4. webhook パッケージ構成

```typescript
// plugins/webhook/package.json
{
  "name": "@drm-plugin/webhook",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "eslint": "^9.x",
    "prettier": "^3.x",
    "vitest": "^2.x"
  }
}
```

**ディレクトリ構造:**

```
plugins/webhook/
├── src/
│   ├── index.ts      # プラグインエントリーポイント
│   └── types/        # 型定義
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── package.json
```

### 5. TypeScript 設定（全パッケージ共通）

```typescript
// tsconfig.json (各パッケージで適用)
interface TypeScriptConfig {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    strict: true,
    exactOptionalPropertyTypes: true,  // 厳密なオプショナルプロパティチェック
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "react-jsx",  // core のみ
    types: ["vitest/globals"]
  }
}
```

**重要:** `exactOptionalPropertyTypes` を有効化することで、`undefined` の明示的な代入を禁止し、型安全性を向上させる。

### 6. ESLint 9 flat config 設定

```typescript
// eslint.config.js (各パッケージで適用)
import js from '@eslint/js';
import typescript from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn'
    }
  }
];
```

**注意:**
- `any` 型の使用を禁止
- 未使用変数をエラーとして検出
- 関数の戻り値型の明示を推奨

### 7. Prettier 設定

```typescript
// prettier.config.js (各パッケージで適用)
export default {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 80,
  arrowParens: 'always'
};
```

### 8. .gitignore

```gitignore
# ルート .gitignore
node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store

# TypeScript
*.tsbuildinfo

# Remix
.cache/
/build

# Testing
coverage/
```

## インターフェース定義

### pnpm workspace 管理

```typescript
/**
 * モノレポのパッケージ管理インターフェース
 *
 * pnpm workspace を使用して3つのパッケージを管理する:
 * - @drm/core: Remix ベースのメインアプリケーション
 * - @drm/posthog: PostHog 統合プラグイン
 * - @drm-plugin/webhook: webhook プラグイン（サンプル）
 */
interface MonorepoWorkspace {
  packages: string[];  // ['core', 'plugins/posthog', 'plugins/webhook']
  sharedDependencies?: string[];  // TypeScript, ESLint, Prettier 等
}
```

### TypeScript strict mode 設定

```typescript
/**
 * TypeScript strict mode 設定
 *
 * すべてのパッケージで以下を有効化:
 * - strict: true（すべての strict チェック）
 * - exactOptionalPropertyTypes: true（オプショナルプロパティの厳密チェック）
 *
 * 例: オプショナルプロパティに明示的な undefined 代入を禁止
 * interface User {
 *   name?: string;
 * }
 * const user: User = { name: undefined };  // エラー（exactOptionalPropertyTypes有効時）
 */
interface StrictTypeScriptConfig {
  compilerOptions: {
    strict: boolean;
    exactOptionalPropertyTypes: boolean;
  };
}
```

### ESLint 9 flat config

```typescript
/**
 * ESLint 9 flat config 設定
 *
 * 各パッケージで TypeScript 推奨ルールを適用:
 * - no-explicit-any: any型の使用禁止
 * - no-unused-vars: 未使用変数の検出
 * - explicit-function-return-type: 関数の戻り値型の明示推奨
 */
interface ESLintFlatConfig {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error';
    '@typescript-eslint/no-unused-vars': 'error';
    '@typescript-eslint/explicit-function-return-type': 'warn';
  };
}
```

## 完了条件

- [ ] `pnpm install` がルートおよび全パッケージで成功
- [ ] `pnpm -r typecheck` が全パッケージでエラーなく完了
- [ ] `pnpm -r lint` が全パッケージでエラーなく完了
- [ ] `pnpm -r format` が全パッケージで正常に動作
- [ ] `pnpm -r test` が全パッケージでプレースホルダテストを実行（3テストがパス）

## 検証方法

```bash
# ルートディレクトリで実行
pnpm install

# 全パッケージでTypeScriptコンパイルチェック
pnpm -r typecheck

# 全パッケージでLintチェック
pnpm -r lint

# 全パッケージでフォーマットチェック
pnpm -r format:check

# 全パッケージでテスト実行
pnpm -r test
```

## 次のタスクへの影響

このタスク完了後、以下のタスクが実行可能になる:
- **Task 1.2**: Docker Compose構成ファイル作成
- **Task 2.1**: Remix初期セットアップ
- **Task 3.1**: Drizzle ORMセットアップ

## 注意事項

1. **ライセンス境界の尊重**
   - `core/` と `plugins/posthog/` はOSSライセンス（MIT予定）
   - `plugins/webhook/` は商用/プロプライエタリライセンス
   - 各パッケージは独立してビルド・配布可能にする

2. **依存関係の最小化**
   - `core` は `plugins` に依存しない
   - `plugins` は `core` のインターフェースのみに依存

3. **exactOptionalPropertyTypes の影響**
   - オプショナルプロパティに `undefined` を明示的に代入できない
   - プロパティを省略することで `undefined` を表現する
   - 既存のコードパターンを見直す必要がある場合がある

## 参考資料

- [pnpm workspace documentation](https://pnpm.io/workspaces)
- [TypeScript exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes)
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Remix v2 documentation](https://remix.run/docs)
