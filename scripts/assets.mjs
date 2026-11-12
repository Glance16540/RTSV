// Scans public/assets and writes manifest.json so the game knows which generated
// assets exist. Runs automatically before `npm run dev` and `npm run build`.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const root = 'public/assets';
const kinds = { icons: ['.png', '.webp', '.jpg', '.jpeg', '.svg'], models: ['.glb'], art: ['.png', '.webp', '.jpg', '.jpeg'], voice: ['.mp3', '.ogg', '.wav', '.m4a'] };
const manifest = {};
for (const [dir, exts] of Object.entries(kinds)) {
  manifest[dir] = {};
  const path = join(root, dir);
  if (!existsSync(path)) continue;
  for (const file of readdirSync(path).sort()) {
    const ext = extname(file).toLowerCase();
    if (exts.includes(ext)) manifest[dir][basename(file, extname(file)).toLowerCase()] = file;
  }
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`assets: ${Object.entries(manifest).map(([k, v]) => `${Object.keys(v).length} ${k}`).join(', ')}`);
