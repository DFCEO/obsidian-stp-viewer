import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const VAULT_PLUGIN_DIR = process.env.OBSIDIAN_VAULT
  ? resolve(process.env.OBSIDIAN_VAULT, '.obsidian', 'plugins', 'stp-viewer')
  : resolve('C:/Users/zj199/Documents/ff/.obsidian/plugins/stp-viewer');

if (!existsSync(VAULT_PLUGIN_DIR)) {
  mkdirSync(VAULT_PLUGIN_DIR, { recursive: true });
}

const distDir = resolve('dist');
const files = readdirSync(distDir);

for (const file of files) {
  const src = join(distDir, file);
  if (!statSync(src).isFile()) continue;
  const dst = join(VAULT_PLUGIN_DIR, file);
  copyFileSync(src, dst);
  console.log(`  ✅ ${file}`);
}

console.log(`\n✅ Plugin installed to: ${VAULT_PLUGIN_DIR}`);
console.log('   Reload Obsidian → Settings → Community plugins → enable STP Viewer');
