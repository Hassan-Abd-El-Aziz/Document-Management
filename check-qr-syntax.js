'use strict';

const fs = require('fs');
const code = fs.readFileSync('C:/Users/Hassan abdelaziz/Downloads/DocEggeec/pages/qr.js', 'utf8');

// Split by lines and test progressively
const lines = code.split('\n');
let testCode = '';

const preamble = `
  var window = { EG: { pages: {} } };
  var document = { createElement: function() { return {}; }, getElementById: function() { return {}; } };
  var EG = window.EG;
  EG.utils = { el: function() { return {}; }, clear: function() {} };
  EG.components = { input: function() { return {}; }, textarea: function() { return {}; }, button: function() { return {}; }, fieldWrap: function() { return {}; }, pageHeader: function() { return {}; }, toast: function() {} };
  EG.i18n = { t: function() { return ''; } };
  EG.api = { qr: { generate: async function() { return ''; } } };
  EG.icon = function() { return ''; };
`;

for (let i = 0; i < lines.length; i++) {
  testCode += lines[i] + '\n';
  try {
    new Function(preamble + testCode);
  } catch (e) {
    console.error('Error at line ' + (i + 1) + ': ' + e.message);
    console.error('Line content: ' + lines[i]);
    process.exit(1);
  }
}

console.log('All lines parsed OK');
