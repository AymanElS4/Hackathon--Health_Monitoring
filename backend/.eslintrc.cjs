/* ESLint (legacy format) for the backend package. Intentionally NOT `root: true`: it cascades on
 * top of the root `.eslintrc.cjs`, adding the backend-local hexagonal rules on top of the shared ones. */

module.exports = {
  overrides: [
    {
      // Application and domain must not know about frameworks, the database driver or adapters.
      // Replaces the root `no-restricted-imports` options for these files, so the frontend ban
      // from the root backend override is repeated here.
      files: ['src/application/**/*.ts', 'src/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@nestjs/*'],
                message: 'application/domain must not depend on frameworks or adapters (hexagonal); use ports',
              },
              {
                group: ['pg'],
                message: 'application/domain must not depend on frameworks or adapters (hexagonal); use ports',
              },
              {
                group: ['express'],
                message: 'application/domain must not depend on frameworks or adapters (hexagonal); use ports',
              },
              {
                group: ['**/adapters/**'],
                message: 'application/domain must not depend on frameworks or adapters (hexagonal); use ports',
              },
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
      // Only the Nest composition module binds adapters. Tests are outside `src/` and are not affected.
      files: ['src/**/*.ts'],
      excludedFiles: ['src/app.module.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: 'NewExpression[callee.name=/(Adapter|Repository|Probe|Clock)$/]',
            message: 'Backend adapters are bound only in backend/src/app.module.ts (Nest providers).',
          },
        ],
      },
    },
  ],
};
