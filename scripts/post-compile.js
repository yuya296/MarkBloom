#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'out', 'packages', 'extension', 'src', 'extension.js');
const target = path.join(__dirname, '..', 'out', 'extension.js');

if (!fs.existsSync(source)) {
    console.error(`post-compile: source not found: ${source}`);
    process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
