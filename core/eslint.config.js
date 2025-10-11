import js from '@eslint/js';
import typescript from 'typescript-eslint';

export default [
  // Apply ESLint recommended rules
  js.configs.recommended,

  // Apply TypeScript ESLint recommended rules
  ...typescript.configs.recommended,

  // Custom rules for strict TypeScript development
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Error: Disallow unused variables
      '@typescript-eslint/no-unused-vars': 'error',

      // Error: Disallow the 'any' type
      '@typescript-eslint/no-explicit-any': 'error',

      // Warn: Require explicit return types on functions
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          // Allow expressions (e.g., arrow functions in JSX)
          allowExpressions: true,
          // Allow typed function expressions
          allowTypedFunctionExpressions: true,
          // Allow higher-order functions
          allowHigherOrderFunctions: true,
        },
      ],
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'build/**',
      '.cache/**',
      'dist/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
];
