import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Changed from 'node' to support React components
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'], // Added tsx
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!lib/**/*.test.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-markdown$': '<rootDir>/tests/__mocks__/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/tests/__mocks__/remark-gfm.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|unified|bail|is-plain-obj|trough|vfile|unist-.*|unified|remark-.*|mdast-.*|micromark.*|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens|pretty-bytes)/)',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,

  // Verbose output configuration - provides detailed pass/fail info per test
  verbose: true,
  bail: false,
  notify: false,
  notifyMode: 'failure-change',

  // Built-in reporter with verbose output
  reporters: [
    [
      'default',
      {
        verbose: true,
      }
    ]
  ],

  // Test name pattern for verbose logging
  testNamePattern: '.*',
};

export default config;

