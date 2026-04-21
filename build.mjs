import fs, { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '.');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

const isProduction = process.env.NODE_ENV === 'production';

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const name of fs.readdirSync(src)) {
            copyRecursive(path.join(src, name), path.join(dest, name));
        }
        return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

async function zipDistFixed() {
    const zipName = isProduction
        ? 'azure-devops-wiki-editor.zip'
        : 'azure-devops-wiki-editor-dev.zip';
    const zipPath = path.join(rootDir, zipName);

    await new Promise((resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('error', reject);
        output.on('close', () => {
            const bytes = archive.pointer();
            console.log(`Wrote ${zipPath} (${bytes} bytes)`);
            resolve();
        });
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(distDir, false);
        archive.finalize();
    });
}

async function main() {
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

    await esbuild.build({
        entryPoints: {
            background: path.join(rootDir, 'src', 'background.ts'),
            content: path.join(rootDir, 'src', 'content.ts'),
        },
        bundle: true,
        outdir: distDir,
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        sourcemap: !isProduction,
        minify: isProduction,
        legalComments: isProduction ? 'none' : 'inline',
        define: {
            'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        },
        logLevel: 'info',
    });

    copyRecursive(publicDir, distDir);
    await zipDistFixed();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
