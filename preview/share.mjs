// Single-file, non-Cloudflare alternative. Contains only the isolated preview.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' });
const dist = join(here, 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*src="\.\/([^"?]+)(?:\?[^" ]*)?"[^>]*><\/script>/g)].map(match => match[1]);
if (!scripts.includes('preview-runtime.js') || !scripts.includes('basho-app.js')) throw Error('Preview entry scripts were not found');
const bundle = await build({
  stdin: { contents: scripts.map(file => `import ${JSON.stringify('./'+file)};`).join('\n'), resolveDir: dist },
  bundle: true, format: 'iife', target: 'es2022', minify: true, write: false,
});
const embedAssets = value => value.replaceAll(/\.\/assets\/[a-z0-9-]+\.png/g, file => 'data:image/png;base64,'+readFileSync(join(dist, file)).toString('base64'));
const javascript = embedAssets(bundle.outputFiles[0].text).replace(/<\/script/gi, '<\\/script');
const stylesheet = embedAssets(readFileSync(join(dist, 'basho-styles.css'), 'utf8'));
html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
html = html.replace(/<link\b[^>]*href="\.\/basho-styles\.css[^>]*>/, `<style>${stylesheet}</style>`);
html = html.replace(/<link\b[^>]*rel="manifest"[^>]*>/gi, '');
html = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'">`);
html = html.replace('</body>', `<script>${javascript}</script></body>`);
html = embedAssets(html);
if (/<script\b[^>]*src=/i.test(html) || /<link\b[^>]*href="\.\//i.test(html)) throw Error('The shared preview must be self-contained');
writeFileSync(join(here, 'share.html'), html);
console.log('Created preview/share.html: '+Buffer.byteLength(html)+' bytes. No deployment credentials are needed to view this file.');
