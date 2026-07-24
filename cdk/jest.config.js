module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/cdk.out/'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  passWithNoTests: true,
};
