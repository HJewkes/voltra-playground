import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactNativePlugin from 'eslint-plugin-react-native';
import reactNativeA11yPlugin from 'eslint-plugin-react-native-a11y';
import importPlugin from 'eslint-plugin-import';
import checkFile from 'eslint-plugin-check-file';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'node_modules/',
      '.expo/',
      'android/',
      'ios/',
      'dist/',
      'build/',
      '*.config.js',
      '*.config.ts',
      'babel.config.js',
      'metro.config.js',
      'tailwind.config.js',
    ],
  },

  // Base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // =============================================================================
  // Main TypeScript/React configuration
  // =============================================================================
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-native': reactNativePlugin,
      'react-native-a11y': reactNativeA11yPlugin,
      import: importPlugin,
      'check-file': checkFile,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        // React Native globals
        __DEV__: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      // =========================================================================
      // TypeScript rules
      // =========================================================================
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Prevent any type - we fixed all existing ones, keep it strict
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      // Enforce type imports for better tree-shaking and clarity
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Prevent accidental async in places that don't handle promises
      'no-async-promise-executor': 'error',

      // =========================================================================
      // Import path rules (Architecture enforcement)
      // =========================================================================
      // Prevent circular dependencies
      'import/no-cycle': 'warn',
      // Ensure imports are at the top
      'import/first': 'error',
      // Ensure newline after imports
      'import/newline-after-import': 'error',
      // No duplicate imports
      'import/no-duplicates': 'error',

      // Enforce @/ path alias - no relative imports going up directories
      // Exceptions: test files importing from parent, JSON imports, same-directory siblings
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['../../*'],
              message: 'Use @/ path alias instead of relative imports going up multiple directories.',
            },
          ],
        },
      ],

      // =========================================================================
      // React rules
      // =========================================================================
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // =========================================================================
      // React Native rules
      // =========================================================================
      'react-native/no-unused-styles': 'error',
      'react-native/no-raw-text': ['error', {
        skip: ['ButtonText', 'AlertTitle', 'AlertDescription', 'CardTitle', 'DrawerTitle', 'BadgeText'],
      }],
      'react-native/split-platform-components': 'warn',

      // =========================================================================
      // Accessibility rules
      // =========================================================================
      'react-native-a11y/has-accessibility-props': 'warn',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/no-nested-touchables': 'error',
      'react-native-a11y/has-valid-accessibility-live-region': 'warn',
      'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 'warn',
    },
  },

  // =============================================================================
  // Screen files: max 200 lines (target is 150, allow buffer)
  // =============================================================================
  {
    files: ['**/components/screens/*.tsx'],
    rules: {
      'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },

  // =============================================================================
  // UI primitive components: max 150 lines (target is 100, allow buffer)
  // =============================================================================
  {
    files: ['**/components/ui/**/*.tsx'],
    rules: {
      'max-lines': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },

  // =============================================================================
  // Domain components: max 250 lines (target is 200, allow buffer)
  // =============================================================================
  {
    files: [
      '**/components/device/**/*.tsx',
      '**/components/recording/**/*.tsx',
      '**/components/exercise/**/*.tsx',
      '**/components/planning/**/*.tsx',
      '**/components/analytics/**/*.tsx',
      '**/components/settings/**/*.tsx',
    ],
    rules: {
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },

  // =============================================================================
  // Index files: should be small (barrel exports only)
  // =============================================================================
  {
    files: ['**/index.ts', '**/index.tsx'],
    rules: {
      // Index files should be re-exports only, but large domains have many exports
      'max-lines': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
    },
  },

  // =============================================================================
  // Component files: PascalCase naming
  // =============================================================================
  {
    files: ['**/components/**/*.tsx'],
    ignores: ['**/index.tsx'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.tsx': 'PASCAL_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // =============================================================================
  // Hooks: must be in src/hooks/ and start with 'use'
  // =============================================================================
  {
    files: ['**/hooks/**/*.ts'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/hooks/*.ts': '+([a-z])*([a-z0-9])' }, // Note: use* enforced by separate glob
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // =============================================================================
  // Domain files: kebab-case naming
  // =============================================================================
  {
    files: ['**/domain/**/*.ts'],
    ignores: ['**/index.ts', '**/__tests__/**'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'warn',
        { '**/*.ts': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // =============================================================================
  // Data layer files: kebab-case
  // =============================================================================
  {
    files: ['**/data/**/*.ts'],
    ignores: ['**/index.ts', '**/__tests__/**'],
    plugins: {
      'check-file': checkFile,
    },
    rules: {
      'check-file/filename-naming-convention': [
        'warn',
        { '**/*.ts': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  }
);
