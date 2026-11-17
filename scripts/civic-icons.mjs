// Draws the icons of the town buildings that came without a painted one (granary, mill, well, infirmary, watch house,
// fortress, inn) as SVG in the manner of the others in public/assets/icons: ink outlines, flat washes, a few strokes of
// hatching, grass at the foot, on parchment. Run `node scripts/civic-icons.mjs`; `npm run assets` picks them up.
import { writeFileSync } from 'node:fs';

const INK = '#3b2a1d', PAPER = '#f4e7c9';
const C = {
  wood: '#a8754a', woodDark: '#7d5434', thatch: '#d9b25e', thatchDark: '#b48b3d', stone: '#cfc6b4', stoneDark: '#a99f8c',
  tile: '#b85c3c', tileDark: '#8f4129', plaster: '#efe6d2', grass: '#6f8a3a', grassDark: '#55702a', sail: '#ece0c2',
  iron: '#5b5650', water: '#6f9fb0', red: '#a8402e', cloth: '#d8cfb8', gold: '#c99a3a', glass: '#e7c35a',
};
const S = (w = 2.8) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const poly = (pts, fill, w) => `<polygon points="${pts}" fill="${fill}" ${S(w)}/>`;
const rect = (x, y, w, h, fill, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${S(sw)}/>`;
const line = (x1, y1, x2, y2, w = 1.4) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${S(w)}/>`;
const path = (d, fill = 'none', w) => `<path d="${d}" fill="${fill}" ${S(w)}/>`;
const circle = (cx, cy, r, fill, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${S(w)}/>`;
/** Short strokes across a shape, as the painted icons shade a roof or a wall. */
const hatch = (x, y, w, h, gap = 6, slant = 4) => { let s = ''; for (let i = x + 3; i < x + w - 2; i += gap) s += line(i, y + 2, i + slant, y + h - 2, 1); return s; };
const planks = (x, y, w, h, gap = 7) => { let s = ''; for (let i = x + gap; i < x + w - 1; i += gap) s += line(i, y + 1, i, y + h - 1, 1.1); return s; };
const courses = (x, y, w, h, gap = 8) => { let s = ''; for (let j = y + gap, k = 0; j < y + h - 1; j += gap, k++) { s += line(x + 1, j, x + w - 1, j, 1); for (let i = x + (k % 2 ? 6 : 11); i < x + w - 2; i += 11) s += line(i, j, i, Math.min(j + gap, y + h - 1), 1); } return s; };
const tuft = (x, y, s = 1) => path(`M${x - 6 * s},${y} q${3 * s},${-9 * s} ${5 * s},${-11 * s} M${x},${y} q0,${-10 * s} ${1 * s},${-13 * s} M${x + 6 * s},${y} q${-2 * s},${-8 * s} ${-4 * s},${-11 * s}`, 'none', 1.6);
const ground = (x1, x2, y) => path(`M${x1},${y} C${x1 + 20},${y - 4} ${x2 - 20},${y - 4} ${x2},${y}`, 'none', 2) + tuft(x1 + 6, y, 0.8) + tuft(x2 - 8, y, 0.9);
const sack = (x, y) => path(`M${x - 7},${y} q-2,-12 3,-15 l-2,-4 h12 l-2,4 q5,3 3,15 z`, C.cloth, 2) + line(x - 3, y - 18, x + 3, y - 18, 1.4);
const barrel = (x, y, w = 16, h = 20) => `<ellipse cx="${x}" cy="${y - h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${C.wood}" ${S(2)}/>` + line(x - w / 2 + 1, y - h * 0.3, x + w / 2 - 1, y - h * 0.3, 1.3) + line(x - w / 2 + 1, y - h * 0.7, x + w / 2 - 1, y - h * 0.7, 1.3);

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" width="144" height="144">
<defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0.10 0"/></filter></defs>
<rect width="144" height="144" fill="${PAPER}"/><rect width="144" height="144" filter="url(#grain)"/>
${body}
</svg>
`;

const icons = {
  // A granary raised on staddle stones out of the reach of rats, under a thatch, with a ladder and sacks.
  granary: svg([
    ground(14, 130, 124),
    ...[30, 56, 82, 108].map((x) => path(`M${x - 4},124 l2,-14 h4 l2,14 z`, C.stone, 2) + `<ellipse cx="${x}" cy="108" rx="9" ry="3.5" fill="${C.stoneDark}" ${S(2)}/>`),
    rect(22, 66, 96, 38, C.wood), planks(22, 66, 96, 38, 8),
    rect(60, 76, 18, 28, C.woodDark), line(69, 76, 69, 104, 1.2),
    poly('12,70 70,30 132,70', C.thatch), path('M12,70 L132,70', 'none', 2.4), hatch(30, 44, 84, 22, 7, -3),
    path('M88,124 L100,96 M98,124 L110,96 M90,118 L101,118 M93,111 L104,111 M96,104 L106,104', 'none', 2),
    sack(26, 124), sack(40, 124),
  ].join('')),

  // A windmill: a stone tower narrowing upward, a cap, four lattice sails.
  mill: svg([
    ground(22, 122, 128),
    poly('48,128 56,62 88,62 96,128', C.stone), courses(52, 64, 40, 64, 10),
    path('M64,128 v-18 q8,-8 16,0 v18', C.woodDark, 2),
    rect(68, 80, 8, 10, C.woodDark, 1.8),
    path('M50,64 Q72,36 94,64 Z', C.tile, 2.4), hatch(58, 46, 30, 16, 6, 2),
    ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => {
      const x2 = 72 + dx * 40, y2 = 56 + dy * 36, nx = -dy * 6, ny = dx * 6;
      return poly(`${72 + dx * 6},${56 + dy * 5} ${x2},${y2} ${x2 + nx},${y2 + ny} ${72 + dx * 6 + nx},${56 + dy * 5 + ny}`, C.sail, 1.8) + line(72 + dx * 6 + nx / 2, 56 + dy * 5 + ny / 2, x2 + nx / 2, y2 + ny / 2, 1);
    }),
    circle(72, 56, 4.5, C.woodDark, 2),
    sack(32, 128), sack(112, 128),
  ].join('')),

  // A well: a round curb of stones, two posts and a little roof, a windlass, a bucket on its rope.
  well: svg([
    ground(16, 128, 126),
    line(42, 98, 42, 46, 3.4), line(102, 98, 102, 46, 3.4),
    poly('30,52 72,24 114,52', C.tile), hatch(44, 34, 56, 16, 7, -3),
    rect(44, 60, 56, 7, C.woodDark, 2), line(100, 63, 112, 63, 2.4), line(112, 63, 112, 74, 2.4),
    line(72, 67, 72, 90, 1.4),
    path('M64,90 h16 l-2,12 h-12 z', C.wood, 2), line(64, 94, 80, 94, 1.1),
    `<path d="M30,96 h84 v22 q-42,10 -84,0 z" fill="${C.stone}" ${S(2.4)}/>`, `<ellipse cx="72" cy="96" rx="42" ry="7" fill="${C.water}" ${S(2.4)}/>`,
    courses(32, 100, 80, 18, 8),
    barrel(20, 126, 13, 16),
  ].join('')),

  // An infirmary: a long whitewashed house with a tiled roof, a herb on its sign, herbs drying, a mortar and pestle.
  infirmary: svg([
    ground(10, 134, 124),
    rect(20, 70, 104, 54, C.plaster), line(20, 84, 124, 84, 1.2),
    line(48, 70, 48, 124, 1.6), line(96, 70, 96, 124, 1.6),
    poly('10,72 34,42 110,42 134,72', C.tile), hatch(30, 46, 86, 22, 7, -3),
    path('M62,124 v-28 q10,-9 20,0 v28', C.woodDark, 2), line(72, 91, 72, 124, 1.1),
    rect(28, 92, 13, 13, C.glass, 1.8), line(34.5, 92, 34.5, 105, 1), rect(103, 92, 13, 13, C.glass, 1.8), line(109.5, 92, 109.5, 105, 1),
    line(28, 76, 44, 76, 1.6), ...[31, 36, 41].map((x) => path(`M${x},76 l-2,8 h5 z`, C.grass, 1.4)),
    `<path d="M100,124 l3,-12 h18 l3,12 z" fill="${C.stoneDark}" ${S(2)}/>`, line(108, 114, 120, 100, 2.4),
    `<g transform="translate(78,40)"><rect x="-8" y="-24" width="16" height="22" rx="2" fill="${C.plaster}" ${S(2)}/><path d="M0,-5 v-16 M0,-10 q-6,-1 -6,-7 q5,1 6,5 M0,-14 q6,-1 6,-7 q-5,1 -6,5" fill="${C.grass}" ${S(1.4)}/></g>`,
  ].join('')),

  // A watch house: a small timber house with a bell under its own roof above the door, and a lantern.
  watchhouse: svg([
    ground(14, 130, 124),
    rect(28, 74, 88, 50, C.wood), planks(28, 74, 88, 50, 9),
    poly('18,76 72,48 126,76', C.thatch), hatch(36, 56, 72, 18, 7, -3),
    line(60, 48, 60, 22, 2.4), line(84, 48, 84, 22, 2.4), poly('52,24 72,8 92,24', C.tile, 2.2),
    path('M64,40 q0,-14 8,-14 q8,0 8,14 z', C.gold, 2.2), circle(72, 42, 2.4, INK, 1),
    path('M60,124 v-26 h24 v26', C.woodDark, 2),
    line(100, 92, 100, 124, 2.6), line(100, 92, 110, 92, 2.4), `<path d="M106,94 h8 v12 h-8 z" fill="${C.glass}" ${S(1.8)}/>`, line(110, 92, 110, 94, 1.6),
    rect(36, 88, 12, 12, C.glass, 1.8),
  ].join('')),

  // A fortress: a stone keep between two towers, crenellated, a gate and a banner.
  fortress: svg([
    ground(10, 134, 126),
    rect(40, 50, 64, 76, C.stone), courses(40, 50, 64, 76, 10),
    rect(16, 40, 30, 86, C.stone), courses(16, 40, 30, 86, 10), rect(98, 40, 30, 86, C.stone), courses(98, 40, 30, 86, 10),
    ...[16, 26, 36, 98, 108, 118].map((x) => rect(x, 32, 8, 9, C.stone, 2)),
    ...[42, 54, 66, 78, 90].map((x) => rect(x, 42, 8, 9, C.stone, 2)),
    path('M58,126 v-30 q14,-14 28,0 v30', C.woodDark, 2.2), line(64, 96, 64, 126, 1), line(72, 88, 72, 126, 1), line(80, 96, 80, 126, 1),
    rect(27, 62, 7, 12, INK, 1), rect(110, 62, 7, 12, INK, 1),
    line(72, 42, 72, 10, 2.2), path('M72,12 h24 l-6,7 l6,7 h-24 z', C.red, 2),
  ].join('')),

  // An inn: a two-storey timber house on a road, a sign with a tankard, a barrel by the door.
  inn: svg([
    ground(10, 134, 126),
    rect(26, 58, 88, 68, C.plaster), line(26, 90, 114, 90, 2), line(56, 58, 56, 126, 1.6), line(86, 58, 86, 126, 1.6),
    path('M26,90 L56,58 M56,90 L86,58 M86,90 L114,58', 'none', 1.4),
    poly('16,60 40,26 100,26 124,60', C.tile), hatch(34, 30, 72, 26, 7, -3),
    rect(92, 14, 12, 20, C.stoneDark, 2),
    path('M62,126 v-24 q9,-8 18,0 v24', C.woodDark, 2),
    rect(32, 98, 14, 14, C.glass, 1.8), rect(92, 98, 14, 14, C.glass, 1.8), rect(34, 66, 14, 12, C.glass, 1.8), rect(94, 66, 14, 12, C.glass, 1.8),
    line(114, 70, 134, 70, 2.4), line(122, 70, 122, 74, 1.4), line(132, 70, 132, 74, 1.4),
    rect(118, 74, 18, 18, C.wood, 2), `<path d="M122,79 h8 v9 h-8 z M130,81 q4,0 4,3 q0,3 -4,3" fill="${C.gold}" ${S(1.4)}/>`,
    barrel(16, 126, 14, 18),
  ].join('')),
};

for (const [k, s] of Object.entries(icons)) writeFileSync(new URL(`../public/assets/icons/${k}.svg`, import.meta.url), s);
console.log('civic icons:', Object.keys(icons).join(', '));
