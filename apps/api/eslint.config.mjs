import { base } from '@kbs/config/eslint';

export default [
  ...base,
  {
    rules: {
      // NestJS DI relies on runtime class references in constructor signatures (emitDecoratorMetadata);
      // `import type` would erase them and break injection.
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
    },
  },
];
