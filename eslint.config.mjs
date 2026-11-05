import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Keep the installed Next/TypeScript rules; do not weaken them to hide legacy debt.
export default [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next*/**', 'out/**', 'build/**', 'next-env.d.ts',
      'src/_archive/**', 'src/lib/shared/types/supabase.ts',
    ],
  },
];
