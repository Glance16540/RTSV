// The local tribes' warriors are their towns' men (docs/DESIGN.md: no man comes from nowhere).
//
// A land of the local tribes used to defend itself with a bare number, `Territory.militia`: so many "bands of local
// warriors", with nobody behind them, though the land had a town with people on record like any other. Now the
// bands are counted from that town's grown men, TRIBE.men to a band (as a nation's company is two men,
// armytown.ts):
//
//   - `warriorsOf(c, tid)` is the count everything reads: the map's defence, who an attacker would face, and how
//     many of the town's men take up arms when the land is fought over in person.
//   - A tribe beaten off in an unwatched battle loses bands, and that is men of its town (`tribeBeaten`).
//   - What a tale does to a tribe's readiness for war (story.ts: "fewer men will take up a spear") stands down so
//     many bands of its men; nobody is made or unmade (`tribeArms`).
//   - In a siege fought in person the tribe's warriors are its own men in arms, no clubmen besides (`tribeSide`,
//     `armMen`): those who fall are gone from the town, and those who live are counted home.
//
// So that a tribe is as strong as it was, each tribe's town is made up, once, to the men its old militia stood
// for, with women in proportion (`makeUp`), the first time anything looks into the town. A land that goes back to the tribes later (a revolt) is the town
// it was, with the men it has.
//
// The marauders are not a tribe: they hold a land with no town, and their strength is their band's
// (bandhorde.ts). `Territory.militia` is kept as a mirror of the truth, for the screens that read it and for
// campaigns saved before this.
import type { Campaign, Territory } from './campaign';
import type { Game, Unit } from './game';
import { OLD_SEASON, agesOf, countFrom } from './ageing';
import { folkOf } from './township';
import { needOf } from './larder';

declare module './campaign' {
  interface Territory {
    /** This land's town has been made up to its tribe's strength, or was never a tribe's to begin with (tribes.ts). */
    tribal?: boolean;
    /** Bands of a tribe's men who have stood down: they are of the town, and do not take up arms (tribes.ts). */
    stoodDown?: number;
  }
}

export const TRIBE = {
  /** Men to a band of warriors. */
  men: 2,
  /** A tribe's town is made up with this many women to a man. */
  women: 0.8,
  /** And with this many seasons of its own eating in store. */
  larder: 3,
  /** A tribe beaten off is never left with fewer bands than this. */
  least: 1,
};

const tribe = (t: Territory): boolean => t.owner < 0 && !t.horde;
const marauders = (c: Campaign, tid: number) => (c.bands ?? []).find((b) => b.kind === 'marauders' && b.at === tid);

/**
 * A tribe's town is made up, once, to the men its militia stood for, with women in proportion. A town nobody has
 * yet looked into has no record to make up, and its militia stands as it is until it has one: reading a tribe's
 * strength never founds a town.
 */
function makeUp(c: Campaign, t: Territory): void {
  if (t.tribal) return;
  t.tribal = true;
  if (!tribe(t)) return;
  const f = folkOf(c, t.id), men = Math.max(f.men, Math.max(0, t.militia) * TRIBE.men);
  if (men === f.men) return;
  f.men = men;
  f.women = Math.max(f.women, Math.round(men * TRIBE.women));
  delete f.ages; // their ages are drawn afresh for those there now (ageing.ts)
  // And a larder to match its mouths: a town of this size was not living on a hamlet's store.
  f.stores.food = Math.max(f.stores.food, Math.round(TRIBE.larder * needOf(c, t.id)));
}

/** The bands a land of no nation can field: a tribe's from its town's men under arms, the marauders' their band's strength. */
export function warriorsOf(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (t.horde) return marauders(c, tid)?.strength ?? t.militia;
  if (!t.tribal && !t.folk) return Math.max(0, t.militia - (t.stoodDown ?? 0)); // nobody has looked into this town yet
  makeUp(c, t);
  return Math.max(0, Math.floor(folkOf(c, tid).men / TRIBE.men) - (t.stoodDown ?? 0));
}

/** Keep the old number true to what it stood for. */
export function mirror(c: Campaign, tid: number): void {
  const t = c.territories[tid];
  if (t.owner < 0 && (t.horde || t.tribal)) t.militia = Math.max(t.horde ? 1 : 0, warriorsOf(c, tid));
}
/** Once a season: every land of no nation shows the bands it really has. */
export function tribesSeason(c: Campaign): void {
  for (const t of c.territories) {
    // A land a nation holds is marked, so that if it goes back to the tribes it keeps the people it has.
    if (t.owner >= 0) { t.tribal = true; continue; }
    if (!t.horde && t.folk) makeUp(c, t);
    mirror(c, t.id);
  }
}

/** A land of no nation beat off an attack and lost so many bands in doing it: a tribe's are men of its town, the marauders' their band's. Returns the men lost. */
export function tribeBeaten(c: Campaign, tid: number, bands: number): number {
  const t = c.territories[tid];
  if (bands <= 0) { mirror(c, tid); return 0; } // it may have lost men to the fight all the same (township.ts)
  if (t.horde) {
    const b = marauders(c, tid);
    if (b) b.strength = Math.max(1, b.strength - bands); else t.militia = Math.max(1, t.militia - bands);
    mirror(c, tid);
    return 0;
  }
  folkOf(c, tid); makeUp(c, t);
  const f = folkOf(c, tid), lose = Math.max(0, Math.min(bands * TRIBE.men, f.men - TRIBE.least * TRIBE.men));
  if (lose > 0) {
    // The young men stood in front.
    const ages = agesOf(c, tid, f);
    const young = ages.m.map((s, i) => [s, i] as const).filter(([s]) => s < OLD_SEASON).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, lose);
    const gone = new Set(young.map(([, i]) => i));
    ages.m = ages.m.filter((_, i) => !gone.has(i));
    countFrom(f, ages);
  }
  mirror(c, tid);
  return lose;
}

/** A tale changes how ready a tribe is for war: so many bands of its men stand down (a negative number) or take up arms again. Nobody is made or unmade. */
export function tribeArms(c: Campaign, tid: number, bands: number): void {
  const t = c.territories[tid];
  if (t.horde || t.owner >= 0 || !bands) return;
  folkOf(c, tid); makeUp(c, t);
  const all = Math.floor(folkOf(c, tid).men / TRIBE.men);
  t.stoodDown = Math.max(0, Math.min(Math.max(0, all - TRIBE.least), (t.stoodDown ?? 0) - bands));
  if (!t.stoodDown) delete t.stoodDown;
  mirror(c, tid);
}

/**
 * What a land of no nation fields when it is fought over in person. A tribe in its town: so many of its own men
 * take up arms (`warriors`), and no clubmen besides. A tribe met in the open, away from its town, and the
 * marauders, who have none: two clubmen to a band, as before.
 */
export function tribeSide(c: Campaign, tid: number, field: boolean): { clubmen: number; warriors: number } {
  const t = c.territories[tid];
  if (!t.horde && !field) { folkOf(c, tid); makeUp(c, t); } // the town turns out, so its record is made up now
  const bands = warriorsOf(c, tid);
  if (t.horde || field) return { clubmen: bands * 2, warriors: 0 };
  return { clubmen: 0, warriors: Math.min(folkOf(c, tid).men, bands * TRIBE.men) };
}

/**
 * In a battle: so many of this side's grown men take up arms where they stand. Each is the same person, with his
 * name and his years, and is counted with the town's people when the battle is over (game.ts `census`).
 * Returns those armed.
 */
export function armMen(g: Game, owner: number, n: number, as = 'clubman'): Unit[] {
  const men = g.units.filter((u) => u.owner === owner && !u.dead && u.type === 'villager' && u.gender === 'm' && u.growT <= 0 && !g.isElder(u)).sort((a, b) => a.id - b.id).slice(0, Math.max(0, Math.round(n)));
  const out: Unit[] = [];
  for (const v of men) {
    const u = g.spawnUnit(g.trainedAs(owner, as), owner, v.x, v.y);
    u.name = v.name; u.family = v.family; u.age = v.age; u.lifespan = v.lifespan; u.story = v.story; u.kids = v.kids;
    v.enlisted = true;
    g.perish(v);
    out.push(u);
  }
  return out;
}
