// eslint-disable-next-line
const commonConfig = require('../../test-resources/jest.common.config');
module.exports = {
  ...commonConfig,
  displayName: 'openapi-generator',
  setupFilesAfterEnv: ['jest-extended/all']
};
