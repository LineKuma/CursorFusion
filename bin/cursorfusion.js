#!/usr/bin/env node
/**
 * CursorFusion CLI entry point.
 */
const { CursorFusion } = require('../src/index');

const app = new CursorFusion({ silent: false });

app.init().then(() => {
  const version = app.getVersion();
  console.log(`CursorFusion ${version}`);
}).catch(err => {
  console.error('Failed to initialize:', err.message);
  process.exit(1);
});
