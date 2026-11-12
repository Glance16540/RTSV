// Cuts the generated icon sheets (4 by 4 grids, see scripts/icon-sheets.json) into one small image per icon
// in public/assets/icons. Usage: node scripts/slice-icons.cjs <folder holding sheet0.png … sheet8.png>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const dir = process.argv[2];
  const { sheets } = JSON.parse(fs.readFileSync(path.join(__dirname, 'icon-sheets.json'), 'utf8'));
  const out = path.join(__dirname, '..', 'public', 'assets', 'icons');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  let n = 0;
  for (let s = 0; s < sheets.length; s++) {
    const src = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, `sheet${s}.png`)).toString('base64');
    const cells = await p.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const cw = img.width / 4, ch = img.height / 4, res = [];
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('canvas'); c.width = c.height = 112;
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
        // A hair inside each cell, so a neighbour's edge never shows.
        g.drawImage(img, (i % 4) * cw + cw * 0.02, Math.floor(i / 4) * ch + ch * 0.02, cw * 0.96, ch * 0.96, 0, 0, 112, 112);
        res.push(c.toDataURL('image/webp', 0.86).split(',')[1]);
      }
      return res;
    }, src);
    sheets[s].forEach(([key], i) => { fs.writeFileSync(path.join(out, key + '.webp'), Buffer.from(cells[i], 'base64')); n++; });
  }
  // The same picture serves two commands.
  fs.copyFileSync(path.join(out, 'release.webp'), path.join(out, 'unstaffall.webp'));
  console.log(n + 1, 'icons written to', out);
  await b.close();
})();
