'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['public/**', 'node_modules/**'] },
  js.configs.recommended,
  { languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, nodebb: 'readonly' } } },
];
