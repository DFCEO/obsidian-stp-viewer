import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

const prod = process.argv[2] === 'production';
const outdir = resolve('dist');

if (!existsSync(outdir)) {
  mkdirSync(outdir, { recursive: true });
}

// Build main plugin — occt-import-js kept external
await esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'cjs',
  external: ['obsidian', 'electron', 'fs', 'occt-import-js'],
  outfile: resolve(outdir, 'main.js'),
  sourcemap: prod ? false : 'inline',
  minify: prod,
  loader: { '.wasm': 'copy' },
});

// Fix occt-import-js paths: both require() and import()
let mainJs = readFileSync(resolve(outdir, 'main.js'), 'utf-8');
mainJs = mainJs.replace(/require\("occt-import-js"\)/g, 'require("./occt-import-js.js")');
mainJs = mainJs.replace(/require\('occt-import-js'\)/g, "require('./occt-import-js.js')");
mainJs = mainJs.replace(/import\("occt-import-js"\)/g, 'import("./occt-import-js.js")');
mainJs = mainJs.replace(/import\('occt-import-js'\)/g, "import('./occt-import-js.js')");
writeFileSync(resolve(outdir, 'main.js'), mainJs);
console.log('  fixed: occt-import-js paths');

// Copy static assets
copyFileSync('manifest.json', resolve(outdir, 'manifest.json'));
copyFileSync('styles.css', resolve(outdir, 'styles.css'));

// Copy occt-import-js dist (JS + WASM) to plugin output
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
