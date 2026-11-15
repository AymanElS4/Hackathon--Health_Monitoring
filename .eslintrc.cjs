/* ESLint (legacy format). Enforces the architecture layers from CLAUDE.md:
 * src/domain is pure and must not import from adapters, ui or application. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {},
  overrides: [
    {
      files: ['src/domain/**/*.ts', 'src/domain/**/*.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/adapters', '**/adapters/**'],
                message: 'src/domain must not import from src/adapters (pure layer, no I/O).',
              },
              {
                group: ['**/ui', '**/ui/**'],
                message: 'src/domain must not import from src/ui.',
              },
              {
                group: ['**/application', '**/application/**'],
                message: 'src/domain must not import from src/application.',
              },
            ],
          },
        ],
      },
    },
  ],
};
