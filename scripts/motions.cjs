// Writes src/client/motions.json from a rigged character file (KayKit Adventurers, CC0, by Kay Lousberg).
// Usage: node scripts/motions.cjs <path to Knight.glb>   (needs the dev server's port 5199 free)
const { chromium } = require('playwright');
const { createServer } = require('vite');
const fs = require('fs');
const path = require('path');
(async () => {
  const src = path.resolve(process.argv[2]);
  const root = path.join(__dirname, '..');
  const server = await createServer({ root, server: { port: 5199, strictPort: true, fs: { allow: [root, path.dirname(src)] } }, logLevel: 'error' });
  await server.listen();
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error', e.message));
  await p.goto(`http://localhost:5199/scripts/motions-dump.html?src=${encodeURIComponent('/@fs' + src)}`);
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
  const motions = await p.evaluate(() => window.motions);
  fs.writeFileSync(path.join(root, 'src', 'client', 'motions.json'), JSON.stringify(motions));
  console.log(Object.entries(motions).map(([k, v]) => `${k} ${v.frames.length}f`).join(', '));
  await b.close();
  await server.close();
})();
