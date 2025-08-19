module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
  verbose: true,
  // Set timeout to 30 seconds since some tests might take longer
  testTimeout: 30000
};
