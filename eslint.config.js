import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import node from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import medic from '@medic/eslint-config';

export default tseslint.config(
  { ignores: ['**/eslint.config.js', '**/.mocharc.cjs', '**/dist/', '**/node_modules/', '**/.c8_output/'] },
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      node,
      promise,
    },
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      // TODO Cannot use medic with eslint 9+ because its format is unsupported
      medic
    ],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': ['error'],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/no-misused-spread': ['off'],
      'array-bracket-newline': ['error', 'consistent'],
      'array-callback-return': ['error', { 'allowImplicit': true }],
      'arrow-spacing': ['error', { before: true, after: true }],
      'brace-style': ['error', '1tbs'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'comma-style': ['error', 'last'],
      'default-param-last': 'error',
      'dot-location': ['error', 'property'],
      'dot-notation': ['error', { 'allowKeywords': true }],
      'func-call-spacing': ['error', 'never'],
      'func-style': ['error', 'expression'],
      'function-call-argument-newline': ['error', 'consistent'],
      'function-paren-newline': ['error', 'consistent'],
      'implicit-arrow-linebreak': ['error', 'beside'],
      'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
      'keyword-spacing': ['error', { 'before': true, 'after': true }],
      'linebreak-style': ['error', 'unix'],
      'lines-between-class-members': ['error', 'always', { 'exceptAfterSingleLine': true }],
      'new-parens': 'error',
      'no-alert': 'error',
      'no-else-return': 'error',
      'no-extra-bind': 'error',
      'no-lone-blocks': 'error',
      'no-nested-ternary': 'error',
      'no-undef-init': 'error',
      'no-useless-rename': 'error',
      'no-whitespace-before-property': 'error',
      'node/no-exports-assign': 'error',
      'rest-spread-spacing': ['error', 'never'],
      'semi-spacing': ['error', { 'before': false, 'after': true }],
      'semi-style': ['error', 'last'],
      'template-curly-spacing': 'error',
    }
  },
  {
    files: ['**/test/**'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
