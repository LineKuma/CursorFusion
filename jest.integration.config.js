const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  // Integration tests alone cannot achieve 100% coverage;
  // unit tests already enforce full thresholds.
  coverageThreshold: {},
};
