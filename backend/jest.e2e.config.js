module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/e2e/**/*.test.js',
    '**/tests/integration/**/*.test.js'
  ],
  setupFilesAfterEnv: ['./tests/setup.js', './tests/e2e.setup.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  runInBand: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage-e2e',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};