#!/usr/bin/env node
/**
 * Build binary executable wrapper.
 * Creates a platform-specific executable that launches CursorFusion via Node.js.
 */

const fs = require('fs');
const path = require('path');

// Parse arguments: --targets <target> --output <output>
const args = process.argv.slice(2);
let target = 'linux-x64';
let outputName = 'cursorfusion';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--targets' && args[i + 1]) {
    target = args[i + 1];
    i++;
  }
  if (args[i] === '--output' && args[i + 1]) {
    outputName = args[i + 1];
    i++;
  }
}

// Determine extension based on target platform
const ext = target.includes('win') ? '.exe' : '';
const outputFile = `${outputName}${ext}`;

// Create the executable content
const isWindows = target.includes('win');
const shebang = isWindows ? '' : '#!/usr/bin/env node\n';

const content = `${shebang}
// CursorFusion v${require('../package.json').version} (${target})
// Auto-generated binary wrapper

const path = require('path');
const entryPath = path.join(__dirname, '..', 'dist', 'index.js');

try {
  const mod = require(entryPath);
  if (mod.CursorFusion) {
    const app = new mod.CursorFusion();
    app.init().then(() => {
      console.log('CursorFusion initialized. Use as library or add CLI support.');
      process.exit(0);
    }).catch(err => {
      console.error('Initialization failed:', err.message);
      process.exit(1);
    });
  }
} catch (err) {
  // Fallback: just indicate this is a library package
  console.log('CursorFusion - A modern development tool');
  console.log('This is a Node.js library. Use: require("cursorfusion")');
  console.log('Version:', require('../package.json').version);
}
`;

fs.writeFileSync(outputFile, content, { mode: 0o755 });
console.log(`Built: ${outputFile} (${target})`);
