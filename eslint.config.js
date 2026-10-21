import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'outils-design/**', 'public/**'] },
  js.configs.recommended,
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: '18.3' } },
    rules: {
      'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'off', 'react/jsx-no-undef': 'error', 'react/jsx-key': 'warn', 'react/no-unknown-property': 'error',
      'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'off',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }], 'no-undef': 'error', 'no-irregular-whitespace': 'off', 'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
