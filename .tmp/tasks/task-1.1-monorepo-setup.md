# Task 1.1: プロジェクト構造とモノレポ初期化

**Phase**: 1 - 環境構築とインフラ基盤
**推定時間**: 2時間
**依存タスク**: なし

## 概要

DRMプロジェクトの初期構造を構築し、coreパッケージの初期設定を行う。

**注意**: プラグイン（posthog等）は現時点では不要。coreパッケージのみを構築する。

## 目標

- coreパッケージの構築
- TypeScript strict mode（`exactOptionalPropertyTypes`含む）の設定
- ESLint 9 flat config による静的解析
- Prettier による統一されたコードフォーマット
- 独立した lint/format/test 環境

## 実装内容

### 1. core パッケージ構成

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

### 2. TypeScript 設定

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

### 3. ESLint 9 flat config 設定

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

### 4. Prettier 設定

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

### 5. .gitignore

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

- [ ] `pnpm install` がcoreパッケージで成功
- [ ] `pnpm typecheck` がエラーなく完了
- [ ] `pnpm lint` がエラーなく完了
- [ ] `pnpm format` が正常に動作
- [ ] `pnpm test` でプレースホルダテストがパス

## 検証方法

```bash
# core/ディレクトリで実行
cd core
pnpm install

# TypeScriptコンパイルチェック
pnpm typecheck

# Lintチェック
pnpm lint

# フォーマットチェック
pnpm format:check

# テスト実行
pnpm test
```

## 次のタスクへの影響

このタスク完了後、以下のタスクが実行可能になる:
- **Task 1.2**: Docker Compose構成ファイル作成
- **Task 2.1**: Remix初期セットアップ
- **Task 3.1**: Drizzle ORMセットアップ

## 注意事項

1. **プラグインは今は不要**
   - この段階ではcoreパッケージのみを構築
   - プラグイン（posthog等）は後のタスクで実装予定

2. **ライセンス**
   - `core/` はOSSライセンス（MIT予定）

3. **exactOptionalPropertyTypes の影響**
   - オプショナルプロパティに `undefined` を明示的に代入できない
   - プロパティを省略することで `undefined` を表現する
   - 既存のコードパターンを見直す必要がある場合がある

## 参考資料

- [TypeScript exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes)
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Remix v2 documentation](https://remix.run/docs)
