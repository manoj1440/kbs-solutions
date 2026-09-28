import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    // F-813: all tables go through components/data-table; ui/table is a low-level primitive.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/ui/table', '**/ui/table'],
              message: 'Use @/components/data-table instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/data-table/**', 'src/components/ui/table.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);

export default eslintConfig;
