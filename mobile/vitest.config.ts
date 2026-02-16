import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.integration.test.tsx', 'test/**/*.test.ts'],
    server: {
      deps: {
        // Force titan through Vite's transform pipeline so the
        // react-native alias is applied to its internal imports
        inline: ['@titan-design/react-ui'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/__fixtures__/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  define: {
    __DEV__: true,
  },
  resolve: {
    extensions: ['.ios.ts', '.ios.tsx', '.ios.js', '.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-native': path.resolve(__dirname, './test/react-native-mock.ts'),
    },
  },
});
