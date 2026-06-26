#!/usr/bin/env node

/**
 * Version synchronization script
 *
 * Ensures version numbers are consistent across:
 * 1. package.json
 * 2. manifest.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJsonPath = path.join(__dirname, '..', 'package.json');
let packageJson;
try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
    console.error(`Error reading or parsing ${packageJsonPath}:`, error.message);
    process.exit(1);
}
const version = packageJson.version;

console.log(`Synchronizing version ${version} across project files...`);

const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');
let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
    console.error(`Error reading or parsing ${manifestPath}:`, error.message);
    process.exit(1);
}
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`- Updated manifest.json to version ${version}`);

console.log('Version sync complete!');
