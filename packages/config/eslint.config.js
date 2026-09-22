// Shared ESLint flat config for the KBS monorepo.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'import-x': importX },
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import-x/order': [
        'warn',
        { groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'], 'newlines-between': 'always', alphabetize: { order: 'asc' } },
      ],
    },
  },
  prettier,
  { ignores: ['**/dist/**', '**/.next/**', '**/.expo/**', '**/generated/**', '**/coverage/**', '**/node_modules/**'] },
];

export default base;
