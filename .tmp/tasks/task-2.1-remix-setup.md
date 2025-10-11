# Task 2.1: Remix初期セットアップ

**タスク番号**: 2.1
**フェーズ**: Phase 2 - Remixアプリケーション基盤
**依存**: Task 1.2（Docker Compose構成ファイル作成）
**推定時間**: 2時間
**優先度**: 高

---

## 目的

Remix v2アプリケーションの初期セットアップを完了し、以下を実現する：
- TailwindCSS統合によるスタイリング基盤
- エラーバウンダリによる堅牢なエラーハンドリング
- 環境変数の読み込み（DATABASE_URL、REDIS_URL）
- 開発環境での動作確認

---

## 完了条件

- [ ] TailwindCSSが導入され、スタイルが適用される
- [ ] ルートレイアウトにエラーバウンダリが設定される
- [ ] 環境変数が読み込まれ、利用可能になる
- [ ] Remixアプリが起動し、ルートページが表示される
- [ ] `pnpm dev`で開発サーバーが起動する
- [ ] `pnpm typecheck`でTypeScriptエラーがない
- [ ] `pnpm lint`でESLintエラーがない

---

## 実装内容

### 1. TailwindCSS設定

#### 依存パッケージのインストール

```bash
# drm-coreディレクトリで実行
cd ../drm-core
pnpm add -D tailwindcss postcss autoprefixer
pnpm exec tailwindcss init --ts -p
```

#### tailwind.config.ts - Tailwind設定

```typescript
import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS configuration for DRM core application
 *
 * This configuration:
 * - Scans app directory for Tailwind classes
 * - Uses default theme with minimal customization
 * - Prepares for future design system extension
 */
export default {
  content: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Future: Add custom colors, fonts, spacing, etc.
    },
  },
  plugins: [],
} satisfies Config;
```

**説明**:
- `content`: Tailwindクラスをスキャンするパスを指定
- `theme.extend`: 将来的にカスタムテーマを追加する場所

#### app/tailwind.css - Tailwindスタイルシート

```css
/**
 * Tailwind CSS styles for DRM core application
 *
 * This file imports Tailwind's base, components, and utilities.
 * Custom styles should be added after the @tailwind directives.
 */
@tailwind base;
@tailwind components;
@tailwind utilities;

/**
 * Custom base styles
 */
@layer base {
  body {
    @apply antialiased;
  }
}

/**
 * Custom component styles
 * Example:
 * @layer components {
 *   .btn-primary {
 *     @apply bg-blue-500 text-white px-4 py-2 rounded;
 *   }
 * }
 */

/**
 * Custom utility styles
 * Example:
 * @layer utilities {
 *   .text-gradient {
 *     @apply bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500;
 *   }
 * }
 */
```

**説明**:
- `@tailwind`: Tailwindの基本スタイルをインポート
- `@layer`: カスタムスタイルを追加する場所

#### app/root.tsx - スタイルシートのインポート

```typescript
import type { LinksFunction } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';

// Import Tailwind CSS
import styles from './tailwind.css?url';

/**
 * Root layout component for the DRM application
 *
 * This component wraps all routes and provides:
 * - HTML document structure
 * - Meta tags and links (including Tailwind CSS)
 * - Scripts and scroll restoration
 * - Error boundary for unhandled errors
 */
export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: styles }];
};

export function Layout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Root component that renders the current route
 */
export default function App(): JSX.Element {
  return <Outlet />;
}

/**
 * Error boundary for unhandled errors
 *
 * This component catches all unhandled errors in the application
 * and displays a user-friendly error page.
 */
export function ErrorBoundary(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <title>エラーが発生しました</title>
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-center text-gray-900">
            エラーが発生しました
          </h1>
          <p className="mt-2 text-center text-gray-600">
            申し訳ございません。予期しないエラーが発生しました。
          </p>
          <div className="mt-6">
            <a
              href="/"
              className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              トップページに戻る
            </a>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
```

**変更点**:
- `import styles from './tailwind.css?url'`: TailwindCSSをインポート
- `links`: スタイルシートをリンクに追加
- `html lang="en"`: 英語設定
- `ErrorBoundary`: エラーページを実装（Tailwindクラスを使用）

---

### 2. 環境変数の読み込み

#### app/env.server.ts - 環境変数管理（新規作成）

```typescript
/**
 * Server-side environment variable management
 *
 * This module provides type-safe access to environment variables.
 * All environment variables are validated at startup to ensure
 * the application has the required configuration.
 *
 * IMPORTANT: This file must only be imported in server-side code
 * (loaders, actions, *.server.ts files). Never import in client code.
 */

/**
 * Environment variables interface
 */
interface Env {
  DATABASE_URL: string;
  REDIS_URL: string;
  SESSION_SECRET: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

/**
 * Get and validate environment variables
 *
 * @throws {Error} If required environment variables are missing
 * @returns {Env} Validated environment variables
 */
function getEnv(): Env {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  // Validate required environment variables
  const missing: string[] = [];

  if (!env.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }
  if (!env.REDIS_URL) {
    missing.push('REDIS_URL');
  }
  if (!env.SESSION_SECRET) {
    missing.push('SESSION_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Validate NODE_ENV
  if (!['development', 'production', 'test'].includes(env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: ${env.NODE_ENV}\n` +
        'NODE_ENV must be one of: development, production, test'
    );
  }

  return env as Env;
}

/**
 * Validated environment variables
 *
 * This is initialized at module load time, so any missing variables
 * will cause the application to fail fast at startup.
 */
export const env = getEnv();
```

**説明**:
- サーバーサイド専用の環境変数管理
- 起動時にバリデーションを実行
- 型安全なアクセスを提供

#### 使用例（app/routes/api_.health.tsx）

```typescript
import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { env } from '~/env.server';

/**
 * Health check API endpoint
 *
 * This endpoint returns the health status of the application,
 * including database and Redis connection status.
 *
 * Interface: GET /api/health
 * Response: { status: 'ok', db: boolean, redis: boolean, env: string }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Environment variables are available via env object
  console.log('Environment:', env.NODE_ENV);
  console.log('Database URL:', env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')); // Mask password

  // TODO: Implement actual DB/Redis health checks in Task 2.5
  const health = {
    status: 'ok',
    db: false, // Will be implemented in Task 2.5
    redis: false, // Will be implemented in Task 2.5
    env: env.NODE_ENV,
  };

  return json(health);
}
```

---

### 3. postcss.config.js - PostCSS設定（新規作成）

```javascript
/**
 * PostCSS configuration for Tailwind CSS
 *
 * This configuration enables:
 * - Tailwind CSS processing
 * - Autoprefixer for browser compatibility
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## ファイル構成

```
drm-core/
├── app/
│   ├── env.server.ts              # 環境変数管理（新規）
│   ├── root.tsx                   # ルートレイアウト（更新: Tailwind + ErrorBoundary）
│   ├── tailwind.css               # Tailwindスタイルシート（新規）
│   └── routes/
│       ├── _index.tsx             # トップページ（既存）
│       └── api_.health.tsx        # ヘルスチェックAPI（更新: env使用例）
├── tailwind.config.ts             # Tailwind設定（新規）
├── postcss.config.js              # PostCSS設定（新規）
├── package.json                   # パッケージ定義（更新: Tailwind依存追加）
└── vite.config.ts                 # Vite設定（既存）
```

---

## 動作確認手順

### 1. 依存パッケージのインストール

```bash
cd /Users/nakatsugawa/Code/DevRel/devcle/drm-core
pnpm install
```

**期待結果**:
```
Dependencies installed successfully
```

### 2. TypeScriptコンパイル確認

```bash
pnpm typecheck
```

**期待結果**:
```
No TypeScript errors
```

### 3. ESLint確認

```bash
pnpm lint
```

**期待結果**:
```
No ESLint errors
```

### 4. 開発サーバー起動（Dockerなし）

```bash
# 環境変数を設定（テスト用）
export DATABASE_URL="postgresql://devcle:test@localhost:5432/devcle"
export REDIS_URL="redis://:test@localhost:6379/0"
export SESSION_SECRET="test-secret"

pnpm dev
```

**期待結果**:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://0.0.0.0:3000/
```

### 5. ルートページ表示確認

```bash
curl http://localhost:3000/
```

**期待結果**:
- HTMLが返却される
- Tailwindクラスが含まれる

### 6. ヘルスチェックAPI確認

```bash
curl http://localhost:3000/api/health
```

**期待結果**:
```json
{
  "status": "ok",
  "db": false,
  "redis": false,
  "env": "development"
}
```

### 7. Docker環境での起動確認

```bash
cd /Users/nakatsugawa/Code/DevRel/devcle/app
docker compose -f docker-compose.yml -f docker-compose-dev.yml up -d core
docker compose logs -f core
```

**期待結果**:
- コンテナが正常に起動
- Remixアプリが起動
- ポート3000でリスニング

### 8. エラーバウンダリの確認

意図的にエラーを発生させてエラーページを確認:

```typescript
// app/routes/_index.tsxに一時的に追加
export function loader() {
  throw new Error('Test error');
}
```

ブラウザで`http://localhost:3000/`にアクセスし、エラーページが表示されることを確認。

確認後、テストコードを削除。

---

## トラブルシューティング

### 問題1: Tailwindスタイルが適用されない

**原因**: `tailwind.config.ts`の`content`パスが間違っている

**解決策**:
```bash
# Tailwindクラスを使用しているファイルを確認
grep -r "className=" app/

# tailwind.config.tsのcontentパスを確認
cat tailwind.config.ts

# 必要に応じて修正
```

### 問題2: 環境変数が読み込まれない

**原因**: `.env`ファイルが存在しない、またはDocker環境変数が未設定

**解決策**:
```bash
# .envファイルを確認（appディレクトリ）
cd /Users/nakatsugawa/Code/DevRel/devcle/app
cat .env

# 存在しない場合は.env.exampleからコピー
cp .env.example .env

# Docker環境変数を確認
docker compose config | grep -E "(DATABASE_URL|REDIS_URL|SESSION_SECRET)"
```

### 問題3: TypeScriptエラーが発生

**原因**: `env.server.ts`の型定義が不正

**解決策**:
```bash
# TypeScriptエラーを確認
pnpm typecheck

# app/env.server.tsの型を確認
cat app/env.server.ts

# 必要に応じて修正
```

### 問題4: pnpm devが起動しない

**原因**: ポート3000が既に使用されている

**解決策**:
```bash
# ポート3000を使用しているプロセスを確認
lsof -i :3000

# プロセスを終了
kill -9 <PID>

# または別のポートを使用
pnpm dev --port 3001
```

---

## 依存関係

### 前提条件
- Task 1.1（プロジェクト初期構造）が完了していること
- Task 1.2（Docker Compose構成）が完了していること
- Node.js 20+、pnpm 8+がインストールされていること

### 次のタスク
- Task 2.2（LP作成）: Remixルートと Tailwindを使用
- Task 2.3（利用規約）: Remixルーティングを使用
- Task 2.4（プライバシーポリシー）: Remixルーティングを使用
- Task 2.5（ヘルスチェックAPI）: env.server.tsを使用

---

## チェックリスト

- [ ] TailwindCSS、PostCSS、Autoprefixerをインストール
- [ ] `tailwind.config.ts`作成
- [ ] `postcss.config.js`作成
- [ ] `app/tailwind.css`作成
- [ ] `app/root.tsx`更新（Tailwindインポート、ErrorBoundary追加、lang="en"）
- [ ] `app/env.server.ts`作成
- [ ] `pnpm install`が成功
- [ ] `pnpm typecheck`がエラーなし
- [ ] `pnpm lint`がエラーなし
- [ ] `pnpm dev`で開発サーバーが起動
- [ ] ルートページが表示される
- [ ] Tailwindスタイルが適用される
- [ ] エラーバウンダリが機能する
- [ ] 環境変数が読み込まれる
- [ ] Docker環境で起動確認

---

## 参考資料

- [Remix Documentation](https://remix.run/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Remix + Tailwind Setup](https://remix.run/docs/en/main/guides/styling#tailwind-css)
- [Remix Error Boundaries](https://remix.run/docs/en/main/route/error-boundary)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
