import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function removeRecursive(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return;
    }

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
        for (const file of fs.readdirSync(targetPath)) {
            removeRecursive(path.join(targetPath, file));
        }
        fs.rmSync(targetPath, { recursive: true });
        console.log(`Removed directory: ${targetPath}`);
    } else {
        fs.unlinkSync(targetPath);
        console.log(`Removed file: ${targetPath}`);
    }
}

const rootDir = path.join(__dirname, '..');
removeRecursive(path.join(rootDir, 'dist'));

for (const file of fs.readdirSync(rootDir)) {
    if (file.startsWith('azure-devops-wiki-editor') && file.endsWith('.zip')) {
        removeRecursive(path.join(rootDir, file));
    }
}

console.log('Clean completed.');
