import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Flat config, ESLint 9.
 *
 * Deliberately not type-aware: the check that matters here is the layering one (see
 * `scripts/scan-imports.mjs`), and a type-aware lint run costs more seconds than the
 * whole gate is allowed to take. `npm run typecheck` is the type checker.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.angular/**',
      'coverage/**',
      'evals/**/.build/**',
      'evals/**/out/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript already reports unused locals, and it understands decorators and
      // parameter properties where the base rule does not.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        fdescribe: 'readonly',
        xdescribe: 'readonly',
        it: 'readonly',
        fit: 'readonly',
        xit: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        expect: 'readonly',
        expectAsync: 'readonly',
        spyOn: 'readonly',
        spyOnProperty: 'readonly',
        spyOnAllFunctions: 'readonly',
        jasmine: 'readonly',
        pending: 'readonly',
        fail: 'readonly',
      },
    },
  },
  {
    files: ['**/*.mjs', 'scripts/**'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Plain JavaScript has no types, so the TypeScript variant only duplicates the
      // base rule here and reports every finding twice.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
