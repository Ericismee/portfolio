import js from '@eslint/js';
import ts from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default ts.config(
  {
    ignores: [
      '.next/**',
      '.data/**',
      '.chrome-preview/**',
      'node_modules/**',
      'src/**',
      'backend/**',
      'tests/*.mjs',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, 'react-hooks/set-state-in-effect': 'off' },
  },
);
