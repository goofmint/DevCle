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
import { DarkModeProvider } from './contexts/dark-mode-context';

/**
 * Root layout component for the DRM application
 *
 * This component wraps all routes and provides:
 * - HTML document structure
 * - Meta tags and links (including Tailwind CSS)
 * - Scripts and scroll restoration
 * - Dark mode management via Context API
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
 * Wraps all routes with DarkModeProvider for app-level dark mode management
 */
export default function App(): JSX.Element {
  return (
    <DarkModeProvider>
      <Outlet />
    </DarkModeProvider>
  );
}

/**
 * Error boundary for unhandled errors
 *
 * This component catches all unhandled errors in the application
 * and displays a user-friendly error page with:
 * - Clear error indication (icon and heading)
 * - Apologetic message in Japanese
 * - Link to return to homepage
 * - Styled with Tailwind CSS classes
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
          {/* Error icon */}
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

          {/* Error heading */}
          <h1 className="mt-4 text-2xl font-bold text-center text-gray-900">
            エラーが発生しました
          </h1>

          {/* Error message */}
          <p className="mt-2 text-center text-gray-600">
            申し訳ございません。予期しないエラーが発生しました。
          </p>

          {/* Return to homepage button */}
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
