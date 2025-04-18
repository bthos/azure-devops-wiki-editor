#!/usr/bin/env node

/**
 * Version synchronization script
 * 
 * This script ensures that version numbers are consistent across:
 * 1. package.json
 * 2. manifest.json
 * 3. version.txt
 */

const fs = require('fs');
const path = require('path');

// Read the version from package.json
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

// Update manifest.json
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

// Update version.txt
const versionTxtPath = path.join(__dirname, '..', 'version.txt');
fs.writeFileSync(versionTxtPath, version);
console.log(`- Updated version.txt to ${version}`);

console.log('Version sync complete!');