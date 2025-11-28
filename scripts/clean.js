const fs = require('fs');
const path = require('path');

/**
 * Recursively remove a directory or file
 */
function removeRecursive(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
        fs.readdirSync(targetPath).forEach(file => {
            removeRecursive(path.join(targetPath, file));
        });
        fs.rmdirSync(targetPath);
        console.log(`Removed directory: ${targetPath}`);
    } else {
        fs.unlinkSync(targetPath);
        console.log(`Removed file: ${targetPath}`);
    }
}

// Remove dist directory
removeRecursive(path.join(__dirname, '..', 'dist'));

// Remove zip files matching pattern azure-devops-wiki-editor*.zip
const rootDir = path.join(__dirname, '..');
fs.readdirSync(rootDir)
    .filter(file => file.startsWith('azure-devops-wiki-editor') && file.endsWith('.zip'))
    .forEach(file => {
        removeRecursive(path.join(rootDir, file));
    });

console.log('Clean completed.');

