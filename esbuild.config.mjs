import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const prod = process.argv[2] === 'production';
const outdir = resolve('dist');

if (!existsSync(outdir)) {
  mkdirSync(outdir, { recursive: true });
}

// Build main plugin — occt-import-js kept external (internal Node refs prevent bundling)
await esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'cjs',
  external: ['obsidian', 'electron', 'occt-import-js'],
  outfile: resolve(outdir, 'main.js'),
  sourcemap: prod ? false : 'inline',
  minify: prod,
});

// Copy static assets
copyFileSync('manifest.json', resolve(outdir, 'manifest.json'));
copyFileSync('styles.css', resolve(outdir, 'styles.css'));

// Copy occt-import-js for runtime loading (JS + WASM + worker)
const occtDist = resolve('node_modules/occt-import-js/dist');
const files = readdirSync(occtDist);
for (const file of files) {
  const src = join(occtDist, file);
  if (statSync(src).isFile()) {
    copyFileSync(src, resolve(outdir, file));
    console.log(`  copied: ${file}`);
  }
}

console.log('✅ Build complete → dist/');
