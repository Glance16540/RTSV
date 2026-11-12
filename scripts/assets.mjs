// Scans public/assets and writes manifest.json so the game knows which generated
// assets exist. Runs automatically before `npm run dev` and `npm run build`.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
// Who voiced each leader: a credit_<nation>.txt beside the recordings, as the voice booth writes it.
manifest.credits = {};
if (existsSync(join(root, 'voice'))) {
  for (const file of readdirSync(join(root, 'voice')).sort()) {
    const m = /^credit_([a-z]+)\.txt$/.exec(file);
    const name = m && readFileSync(join(root, 'voice', file), 'utf8').trim().slice(0, 60);
    if (m && name) manifest.credits[m[1]] = name;
  }
}
manifest.personas = {};
if (existsSync(join(root, 'voice'))) {
  for (const file of readdirSync(join(root, 'voice')).sort()) {
    const m = /^persona_([a-z]+)\.txt$/.exec(file);
    if (m && readFileSync(join(root, 'voice', file), 'utf8').trim() === 'alt') manifest.personas[m[1]] = 'alt';
  }
}
// A leader rewritten by whoever voices them: character_<nation>.json, as the voice booth writes it.
manifest.characters = {};
if (existsSync(join(root, 'voice'))) {
  for (const file of readdirSync(join(root, 'voice')).sort()) {
    const m = /^character_([a-z]+)\.json$/.exec(file);
    if (!m) continue;
    try {
      const c = JSON.parse(readFileSync(join(root, 'voice', file), 'utf8'));
      if (c && typeof c === 'object') manifest.characters[m[1]] = { name: c.name, title: c.title, temper: c.temper, lines: c.lines };
    } catch {
      console.warn(`assets: ${file} is not valid JSON and was ignored`);
    }
  }
}
// A picture the voice actor chose for their leader: portrait_<nation>.png beside the recordings.
manifest.portraits = {};
if (existsSync(join(root, 'voice'))) {
  for (const file of readdirSync(join(root, 'voice')).sort()) {
    const m = /^portrait_([a-z]+)\.(png|jpe?g|webp)$/.exec(file);
    if (m) manifest.portraits[m[1]] = file;
  }
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`assets: ${Object.entries(manifest).map(([k, v]) => `${Object.keys(v).length} ${k}`).join(', ')}`);
