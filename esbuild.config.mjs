import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const prod = process.argv[2] === 'production';
const outdir = resolve('dist');

if (!existsSync(outdir)) {
  mkdirSync(outdir, { recursive: true });
}

// Plugin: stub Node builtins in occt-import-js so it can be bundled for browser
const occtNodeStubPlugin = {
  name: 'occt-node-stub',
  setup(build) {
    build.onLoad({ filter: /occt-import-js\.js$/ }, async (args) => {
      let source = readFileSync(args.path, 'utf-8');
      // Replace Node-specific requires and globals used only in Node.js fallback
      source = source.replace(/require\("fs"\)/g, 'null');
      source = source.replace(/require\("path"\)/g, 'null');
      source = source.replace(/__dirname\s*\+\s*"[^"]*"/g, '""');
      return { contents: source, loader: 'js' };
    });
  },
};

// Build main plugin — occt-import-js bundled in (Node refs stubbed)
await esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'cjs',
  external: ['obsidian', 'electron'],
  plugins: [occtNodeStubPlugin],
  outfile: resolve(outdir, 'main.js'),
  sourcemap: prod ? false : 'inline',
  minify: prod,
});

// Copy static assets
copyFileSync('manifest.json', resolve(outdir, 'manifest.json'));
copyFileSync('styles.css', resolve(outdir, 'styles.css'));

// Copy only the WASM file (JS is now bundled into main.js)
copyFileSync(
  resolve('node_modules/occt-import-js/dist/occt-import-js.wasm'),
  resolve(outdir, 'occt-import-js.wasm')
);
console.log('  copied: occt-import-js.wasm');

console.log('✅ Build complete → dist/');
