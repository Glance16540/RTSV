// A face of one's own, drawn (src/sim/faces.ts chooses it). An inline SVG bust in the manner of the woodblock icons:
// flat colours, a dark ink line, a cream ground. Nothing here chooses anything: every shape and colour is the face's.
import type { Face } from '../sim/faces';

const INK = '#2e2116';
const GROUND = '#efe2c3';

/** A colour made darker (k < 1) or lighter (k > 1). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const f = (v: number): number => Math.max(0, Math.min(255, Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k)));
  return `#${c.map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}
const path = (d: string, fill: string, extra = ''): string => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"${extra}/>`;
const line = (d: string, w = 1.1, extra = ''): string => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

/** The head's outline, by the jaw. */
function headPath(jaw: Face['jaw']): string {
  if (jaw === 'square') return 'M20 25 C20 12 44 12 44 25 L44 32 C44 40 38.5 44.5 32 44.5 C25.5 44.5 20 40 20 32 Z';
  if (jaw === 'narrow') return 'M21 26 C21 12 43 12 43 26 C43 37 38 44.5 32 44.5 C26 44.5 21 37 21 26 Z';
  return 'M19.5 27 C19.5 12.5 44.5 12.5 44.5 27 C44.5 38 39 44 32 44 C25 44 19.5 38 19.5 27 Z';
}

/** Hair that hangs behind the head and shoulders. */
function backHair(f: Face): string {
  const h = f.hair;
  switch (f.hairStyle) {
    // A man's long hair falls to his jaw; a woman's past her shoulders.
    case 'long': return f.sex === 'm' ? path('M18 30 C15 14 23 9 32 9 C41 9 49 14 46 30 L46.5 40 C44 41.5 42 41 41 39.5 L41 33 L23 33 L23 39.5 C22 41 20 41.5 17.5 40 Z', h)
      : path('M18 30 C15 14 23 9 32 9 C41 9 49 14 46 30 L48 50 C44 51 41 50 40 48 L40 36 L24 36 L24 48 C23 50 20 51 16 50 Z', h);
    case 'braids': return path('M18 28 L16 52 L20 53 L22 30 Z', h) + path('M46 28 L48 52 L44 53 L42 30 Z', h) + line('M16.5 36 L21 37 M16.3 42 L20.6 43 M16.1 48 L20.3 49 M47.5 36 L43 37 M47.7 42 L43.4 43 M47.9 48 L43.7 49', 0.8);
    case 'bun': return `<circle cx="32" cy="10" r="6" fill="${h}" stroke="${INK}" stroke-width="1.3"/>`;
    default: return '';
  }
}

/** Hair over the top of the head. */
function frontHair(f: Face): string {
  const h = f.hair;
  switch (f.hairStyle) {
    case 'bald': return line('M27 15.5 Q30 14.5 33 15', 0.9, ' opacity="0.5"');
    case 'receding': return path('M19.6 27 C19 21 20 18 22 16.5 C22.5 20 22 24 21.5 28 Z', h) + path('M44.4 27 C45 21 44 18 42 16.5 C41.5 20 42 24 42.5 28 Z', h);
    case 'cropped': return path('M20 24 C20 12.5 44 12.5 44 24 C40 18.5 36 17 32 17 C28 17 24 18.5 20 24 Z', h);
    case 'curls': return path('M19 26 C17 11 47 11 45 26 C43 21 40 19 37 20 C35 18 33 19 32 20 C30 18 28 19 27 20 C24 19 21 21 19 26 Z', h)
      + line('M24 15 q1.5 -1.5 3 0 M30 13.5 q1.5 -1.5 3 0 M36 14.5 q1.5 -1.5 3 0', 0.8);
    case 'topknot': return path('M20 24 C20 12.5 44 12.5 44 24 C40 19 36 17.5 32 17.5 C28 17.5 24 19 20 24 Z', h)
      + path('M29.5 13 C29 8 35 8 34.5 13 Z', h) + line('M29.8 11.6 L34.2 11.6', 0.8);
    default: return path('M19 27 C17.5 11.5 46.5 11.5 45 27 C43 20 38 17.5 32 18 C26 17.5 21 20 19 27 Z', h);
  }
}

function brows(f: Face): string {
  const w = f.brows === 'thick' ? 1.9 : 1.2;
  switch (f.feeling) {
    case 'angry': return line('M23.5 23 L29.5 25.4 M40.5 23 L34.5 25.4', w);
    case 'afraid': return line('M23.5 25 L29.5 22.6 M40.5 25 L34.5 22.6', w);
    case 'grief': return line('M23.5 25.6 Q26.5 23.6 29.5 23 M40.5 25.6 Q37.5 23.6 34.5 23', w);
    default: return line('M23.5 24.8 Q26.5 22.9 29.5 24.2 M40.5 24.8 Q37.5 22.9 34.5 24.2', w);
  }
}

function eyes(f: Face): string {
  if (f.feeling === 'grief') return line('M24.5 28.4 Q26.5 29.8 28.5 28.4 M35.5 28.4 Q37.5 29.8 39.5 28.4', 1.1);
  if (f.feeling === 'content' && f.eyes === 'almond') return line('M24.5 28.6 Q26.5 27.2 28.5 28.6 M35.5 28.6 Q37.5 27.2 39.5 28.6', 1.1);
  const wide = f.feeling === 'afraid';
  const ry = f.eyes === 'almond' ? (wide ? 1.5 : 1) : (wide ? 1.9 : 1.5), rx = f.eyes === 'almond' ? 2.2 : 1.8;
  const one = (cx: number): string => `<ellipse cx="${cx}" cy="28.4" rx="${rx}" ry="${ry}" fill="#f7f1e3" stroke="${INK}" stroke-width="0.9"/><circle cx="${cx}" cy="28.5" r="${Math.min(ry, 1.05)}" fill="${INK}"/>`;
  return one(26.5) + one(37.5);
}

function nose(f: Face): string {
  if (f.nose === 'long') return line('M32 28 L30.4 35 Q32 36 33.6 35', 1);
  if (f.nose === 'broad') return line('M31.4 29 Q29.3 34 30.4 35.3 Q32 36.3 33.6 35.3 Q34.7 34 32.6 29', 1);
  return line('M32 29.5 L30.9 33.6 Q32 34.4 33.1 33.6', 1);
}

function mouth(f: Face): string {
  switch (f.feeling) {
    case 'afraid': return `<ellipse cx="32" cy="39" rx="2" ry="1.7" fill="#5a2a22" stroke="${INK}" stroke-width="1"/>`;
    case 'grief': return line('M28.8 40 Q32 37.8 35.2 40', 1.2);
    case 'angry': return line('M28.4 39.8 L30 39 L34 39 L35.6 39.8', 1.3);
    default: return line('M28.4 38.4 Q32 41.2 35.6 38.4', 1.2);
  }
}

function beard(f: Face): string {
  const h = f.hair, tache = path('M27.4 36.6 Q32 34.3 36.6 36.6 Q34.5 38.2 32 37 Q29.5 38.2 27.4 36.6 Z', h);
  switch (f.beard) {
    case 'stubble': return path('M21 31 C21 40 26 44.3 32 44.3 C38 44.3 43 40 43 31 C41 37 37 39.5 32 39.5 C27 39.5 23 37 21 31 Z', h, ' opacity="0.35" stroke-opacity="0"');
    case 'moustache': return tache;
    case 'short': return path('M20 29 C20 41 25.5 46.5 32 46.5 C38.5 46.5 44 41 44 29 C42 36.5 37.5 39.6 32 39.6 C26.5 39.6 22 36.5 20 29 Z', h) + tache;
    case 'full': return path('M19.6 28 C19 43 25 50 32 50.5 C39 50 45 43 44.4 28 C42.5 36.5 37.5 40 32 40 C26.5 40 21.5 36.5 19.6 28 Z', h) + tache + line('M28 45 L29 48 M32 46 L32 49.5 M36 45 L35 48', 0.7);
    case 'long': return path('M19.6 28 C19 42 24 50 32 57 C40 50 45 42 44.4 28 C42.5 36.5 37.5 40 32 40 C26.5 40 21.5 36.5 19.6 28 Z', h) + tache + line('M28 45 L30 51 M32 46 L32 54 M36 45 L34 51', 0.7);
    default: return '';
  }
}

function lines(f: Face): string {
  let s = '';
  if (f.lines >= 1) s += line('M28.5 34.5 Q27.5 37 28.4 38.6 M35.5 34.5 Q36.5 37 35.6 38.6', 0.7, ' opacity="0.7"');
  if (f.lines >= 2) s += line('M27 19.6 Q32 18.6 37 19.6 M21.7 28.6 L20.6 27.6 M21.7 29.6 L20.4 30 M42.3 28.6 L43.4 27.6 M42.3 29.6 L43.6 30', 0.7, ' opacity="0.7"');
  if (f.lines >= 3) s += line('M26.5 21.2 Q32 20.2 37.5 21.2 M25 31 Q26.5 32 28 31.2 M36 31.2 Q37.5 32 39 31', 0.7, ' opacity="0.7"');
  return s;
}

/** What is worn on the head: drawn over the hair. */
function hat(f: Face): string {
  const g = f.garb, metal = '#8f949a', bronze = '#b08a4a';
  switch (f.headgear) {
    case 'cap': return path('M19.5 23 C19.5 10.5 44.5 10.5 44.5 23 Z', shade(g, 0.8)) + path('M19 21.5 L45 21.5 L45 24.5 L19 24.5 Z', shade(g, 0.6));
    case 'hood': return path('M14 46 C11 18 21 7 32 7 C43 7 53 18 50 46 L44 46 C45 34 45 28 44.5 24 C43.5 16 38 12.5 32 12.5 C26 12.5 20.5 16 19.5 24 C19 28 19 34 20 46 Z', shade(g, 0.85));
    case 'veil': { const c = shade(g, 1.55); return path('M15 50 C12 20 21 8.5 32 8.5 C43 8.5 52 20 49 50 L44 48 C45.5 36 45 28 44 23 C42.5 16 38 13.5 32 13.5 C26 13.5 21.5 16 20 23 C19 28 18.5 36 20 48 Z', c) + line('M24 15 Q32 12.5 40 15', 0.7, ' opacity="0.6"'); }
    case 'scarf': return path('M18.5 25 C17.5 11 46.5 11 45.5 25 C42 20.5 37 18.5 32 18.5 C27 18.5 22 20.5 18.5 25 Z', shade(g, 1.2)) + path('M43.5 24 L48 30 L44 30.5 Z', shade(g, 1.2));
    case 'fur': return path('M20 20 C20 6 44 6 44 20 Z', shade(g, 0.85)) + path('M17.5 19 Q32 14 46.5 19 L46.5 24 Q32 19.5 17.5 24 Z', '#8a6a4a') + line('M20 20 l1 2.5 M24 18.6 l1 2.5 M28 18 l0.8 2.5 M32 17.7 l0.6 2.5 M36 18 l0.4 2.5 M40 18.6 l0 2.5 M44 19.6 l-0.6 2.5', 0.6);
    case 'turban': { const c = shade(g, 1.35); return path('M18 23 C16 8 48 8 46 23 C42 20 37 19 32 19 C27 19 22 20 18 23 Z', c) + line('M19 18 Q32 11 45 18 M20.5 13.5 Q32 8.5 43.5 14', 0.8) + `<circle cx="32" cy="15.5" r="1.5" fill="${f.trim}" stroke="${INK}" stroke-width="0.8"/>`; }
    case 'wrap': return path('M19 23 C17 4 47 4 45 23 C41 20 37 19 32 19 C27 19 23 20 19 23 Z', shade(g, 1.1)) + line('M20 16 Q32 9 44 16 M22 10.5 Q32 5.5 42 10.5', 0.8);
    case 'headcloth': { const c = shade(g, 1.45); return path('M16 46 C13 20 21 10 32 10 C43 10 51 20 48 46 L44 44 C45 34 45 27 44.4 23 L19.6 23 C19 27 19 34 20 44 Z', c) + path('M18.6 20.5 Q32 17.5 45.4 20.5 L45.4 23.5 Q32 20.5 18.6 23.5 Z', INK); }
    case 'fillet': return path('M19.4 20.4 Q32 17.6 44.6 20.4 L44.6 22.4 Q32 19.6 19.4 22.4 Z', f.trim);
    case 'circlet': return path('M19.4 20 Q32 17.2 44.6 20 L44.6 22.4 Q32 19.6 19.4 22.4 Z', '#d1aa3e') + path('M30.4 18.6 L32 15 L33.6 18.6 Z', '#d1aa3e') + path('M24 19.4 L25 16.8 L26.2 19.1 Z M37.8 19.1 L39 16.8 L40 19.4 Z', '#d1aa3e');
    case 'helm_nasal': return path('M18.6 25 C18 9.5 46 9.5 45.4 25 Z', metal) + path('M18.4 23 L45.6 23 L45.6 26 L18.4 26 Z', shade(metal, 0.8)) + path('M30.9 25.6 L33.1 25.6 L33 34 L31 34 Z', shade(metal, 0.8));
    case 'helm_crest': return path('M27 9 C30 3 40 3 46 9 L44 13 C40 9 33 9 29 13 Z', '#a8342a') + path('M18.6 26 C18 10 46 10 45.4 26 Z', bronze) + path('M18.6 24 L23.5 24 L23 37 L19.4 35 Z M45.4 24 L40.5 24 L41 37 L44.6 35 Z', shade(bronze, 0.85));
    case 'helm_cone': return path('M18.4 25 C19 16 26 10 32 4 C38 10 45 16 45.6 25 Z', metal) + path('M18.6 23 L45.4 23 L45.4 26 L18.6 26 Z', shade(metal, 0.75)) + path('M18.4 26 L17 40 L21 41 L20.6 27 Z M45.6 26 L47 40 L43 41 L43.4 27 Z', shade(metal, 0.9)) + line('M17.6 30 L20.8 30.6 M17.3 34 L20.9 34.6 M46.4 30 L43.2 30.6 M46.7 34 L43.1 34.6', 0.6);
    case 'helm_round': return path('M19 24 C19 10 45 10 45 24 Z', metal) + path('M14.5 24.5 Q32 21 49.5 24.5 L48 27 Q32 23.8 16 27 Z', shade(metal, 0.8));
    case 'helm_kabuto': return path('M13 34 C12 24 18 22 20 22 L44 22 C46 22 52 24 51 34 L45 32 L45 26 L19 26 L19 32 Z', '#3a3430') + path('M19 24 C19 9.5 45 9.5 45 24 Z', '#4a403a') + path('M26 14 L32 18 L38 14 L37 12 L32 15.4 L27 12 Z', '#c9a23a') + line('M21 17 L43 17 M20 20.5 L44 20.5', 0.6);
    case 'helm_cap': return path('M19.4 24.5 C19.4 11 44.6 11 44.6 24.5 Z', bronze) + line('M20 21.5 Q32 18.5 44 21.5', 0.7);
    default: return '';
  }
}

/** Is the hair drawn under this headgear at all (a hood or helmet hides the top of it)? */
const hidesHair = (h: Face['headgear']): boolean => h !== 'none' && h !== 'fillet' && h !== 'circlet';

/** The face as an SVG string, sized by its container. */
export function faceSvg(f: Face, title = ''): string {
  const skin = f.skin, garb = f.garb;
  const parts = [
    `<rect x="0.5" y="0.5" width="63" height="63" rx="6" fill="${GROUND}"/>`,
    hidesHair(f.headgear) && (f.headgear === 'hood' || f.headgear === 'veil' || f.headgear === 'headcloth') ? '' : backHair(f),
    path('M3 64 C5 51 17 46.5 32 46.5 C47 46.5 59 51 61 64 Z', garb),
    path('M26.5 46.6 L32 53 L37.5 46.6', f.trim, ' fill-opacity="0"'),
    path('M27 38 L27 48 Q32 50.5 37 48 L37 38 Z', shade(skin, 0.88)),
    `<ellipse cx="19.6" cy="29.5" rx="2.2" ry="3.2" fill="${skin}" stroke="${INK}" stroke-width="1.1"/>`,
    `<ellipse cx="44.4" cy="29.5" rx="2.2" ry="3.2" fill="${skin}" stroke="${INK}" stroke-width="1.1"/>`,
    path(headPath(f.jaw), skin),
    f.ruddy ? `<circle cx="24.6" cy="34" r="2.6" fill="#d9826a" opacity="0.35"/><circle cx="39.4" cy="34" r="2.6" fill="#d9826a" opacity="0.35"/>` : '',
    lines(f),
    hidesHair(f.headgear) ? '' : frontHair(f),
    beard(f),
    brows(f), eyes(f), nose(f), mouth(f),
    hat(f),
  ];
  return `<svg class="ico face" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img"${title ? ` aria-label="${title}"` : ''}>${parts.join('')}</svg>`;
}
