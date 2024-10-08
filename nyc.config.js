'use strict';

module.exports = {
  extends: '@istanbuljs/nyc-config-typescript',
  reporter: ['text-summary', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['src/commands/**/*', 'src/index.ts'],
  all: true,
  'check-coverage': true,
  'report-dir': '.nyc_output/reports',
  branches: 100,
  lines: 100,
  functions: 100,
  statements: 100,
};
