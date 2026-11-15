/* ESLint (legacy format). Enforces the architecture from ui-build §1.1 and research R18.
 * Layers are declared as eslint-plugin-boundaries element types (see `boundaries/elements`);
 * `boundaries/element-types` says which element may import which. */

const TEST_FILES = [
  '**/tests/**/*.{ts,tsx}',
  '**/*.test.{ts,tsx}',
];

const SOURCE_FILES = ['frontend/src/**/*.{ts,tsx}', 'backend/src/**/*.ts'];

module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'boundaries', 'react'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    // Plain node resolution with TypeScript extensions: resolves relative imports to .ts/.tsx
    // files and `@base-vital/*` workspace packages (their `main` points at src/index.ts).
    'import/resolver': {
      node: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
    },
    'boundaries/elements': [
      // Order matters: the first matching pattern wins.
      { type: 'libs', pattern: 'libs/*/src/**', mode: 'full' },
      { type: 'domain', pattern: 'frontend/src/domain/**', mode: 'full' },
      { type: 'ports', pattern: 'frontend/src/application/ports/**', mode: 'full' },
      { type: 'application', pattern: 'frontend/src/application/**', mode: 'full' },
      { type: 'adapters', pattern: 'frontend/src/adapters/**', mode: 'full' },
      { type: 'ui', pattern: 'frontend/src/ui/**', mode: 'full' },
      { type: 'config', pattern: 'frontend/src/config/**', mode: 'full' },
      { type: 'composition', pattern: 'frontend/src/composition-root.ts', mode: 'full' },
      { type: 'app', pattern: ['frontend/src/App.tsx', 'frontend/src/main.tsx'], mode: 'full' },
      { type: 'backend', pattern: 'backend/**', mode: 'full' },
    ],
  },
  rules: {},
  overrides: [
    {
      // Dependency direction between layers. Anything not listed is disallowed.
      files: ['**/*.{ts,tsx}'],
      rules: {
        'boundaries/element-types': [
          'error',
          {
            default: 'disallow',
            rules: [
              { from: 'libs', allow: ['libs'] },
              { from: 'domain', allow: ['domain', 'libs'] },
              { from: 'ports', allow: ['ports', 'libs'] },
              { from: 'application', allow: ['application', 'domain', 'ports', 'config', 'libs'] },
              { from: 'adapters', allow: ['adapters', 'ports', 'config', 'libs'] },
              { from: 'ui', allow: ['ui', 'application', 'ports', 'config', 'libs'] },
              { from: 'config', allow: ['config', 'libs'] },
              {
                from: 'composition',
                allow: ['composition', 'domain', 'application', 'ports', 'adapters', 'config', 'libs'],
              },
              { from: 'app', allow: ['app', 'composition', 'ui', 'config', 'libs'] },
              { from: 'backend', allow: ['backend', 'libs'] },
            ],
          },
        ],
      },
    },
    {
      // Path-based guards: `boundaries` can only classify imports whose target file exists,
      // so these also catch a relative path into the other app before that file is created.
      files: ['frontend/src/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/backend', '**/backend/**'],
                message: 'frontend must not import backend; share only libs/*.',
              },
              {
                group: ['@base-vital/frontend', '@base-vital/frontend/**', '@base-vital/*/src/**'],
                message: 'Inside frontend use relative imports; import libs only through their package entry.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['backend/src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/frontend', '**/frontend/**'],
                message: 'backend must not import frontend; share only libs/*.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['libs/*/src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/frontend', '**/frontend/**', '**/backend', '**/backend/**'],
                message: 'libs must not import frontend or backend.',
              },
            ],
          },
        ],
      },
    },
    {
      // Only the composition root may instantiate adapters; tests may build fakes freely.
      files: SOURCE_FILES,
      excludedFiles: ['frontend/src/composition-root.ts', ...TEST_FILES],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'NewExpression[callee.name=/(Adapter|Repository|Devices|Recognizer|Synth|Agenda|Clock|Connectivity)$/]',
            message: 'Adapters are created only in frontend/src/composition-root.ts (inject them through ports).',
          },
        ],
      },
    },
    {
      files: ['frontend/src/application/use-cases/**/*.ts'],
      rules: {
        'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      },
    },
    {
      files: ['frontend/src/ui/**/*.{ts,tsx}', 'frontend/src/App.tsx'],
      rules: {
        'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
        // Overrides replace options, so the adapter selector from the source-files block is repeated here.
        'no-restricted-syntax': [
          'error',
          {
            selector: 'NewExpression[callee.name=/(Adapter|Repository|Devices|Recognizer|Synth|Agenda|Clock|Connectivity)$/]',
            message: 'Adapters are created only in frontend/src/composition-root.ts (inject them through ports).',
          },
          {
            selector: "JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal",
            message: 'UI text only in frontend/src/config/messages.es.ts.',
          },
        ],
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      excludedFiles: [
        'frontend/src/config/**',
        'libs/health-rules/src/thresholds.ts',
        'libs/health-rules/src/constants.ts',
        ...TEST_FILES,
      ],
      rules: {
        'no-magic-numbers': [
          'error',
          { ignore: [0, 1, -1], ignoreArrayIndexes: true, ignoreDefaultValues: true },
        ],
      },
    },
  ],
};
