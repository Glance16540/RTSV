// The season's report (docs/DESIGN.md: the world map is the game, people persist). When a season turns, what changed
// in the player's nation since the last one, and for whom: who was born, came of age, died (of age, of hunger, in
// battle), was taken or got back; the raids on its towns and how they went; who drifted to the tavern or the mines;
// towns that rose, were lost or were won; notable people made or lost. Plain data: it draws nothing.
//
// How it is kept. When a season turns (campaign.ts calls `seasonTurned`), the report of the season just ended is
// made from a snapshot taken when that season began, against the nation as it now is and the season's ledger
// (ledger.ts), and a new snapshot is taken. The report waits on the campaign until the player has seen it.
import { ruinWarning } from './ruin';
import type { Campaign } from './campaign';
import { ledgerSince } from './ledger';
import { THREATS, reportLine } from './threats';
import './intrigue';
import './carriedoff';
import { folkOf, living, type Notable } from './township';
import { householdNews } from './kin';
import { isOpen } from './deadtown';
import { reach } from './campaign';

/** A known person, as the report names them. */
export interface Named { name: string; family?: string; gender: 'm' | 'f'; kind: Notable['kind']; deed: string; unit?: string; kids?: number; at: number; land: string }
/** The nation as a season begins. */
export interface Snapshot {
  turn: number; seq: number;
  towns: { id: number; tavern: number; mines: number }[];
  notables: Named[];
  /** Its people held by bands, or by a nation that led them away: each group, the season it was taken, with how many. */
  held: Record<string, { n: number; since: number }>;
}
export interface SeasonReport {
  /** The season it covers: from the turn its snapshot was taken to the turn it was made. */
  from: number; turn: number;
  born: number; grew: number; aged: number; starved: number; fell: number; sick: number;
  /** Men killed in raids on its towns: counted here once, from the raids' own reports, and in no other count. */
  raidDead: number;
  taken: number; back: number; lostForGood: number;
  raids: { at: number; land: string; outcome: 'held' | 'raided' | 'taken'; line: string }[];
  drifted: { tavern: number; mines: number; home: number };
  /** Changes in the leader's household and circle: married, widowed, carried off, freed, someone leaving (kin.ts). */
  household?: { text: string; tone: 'good' | 'bad' | 'plain' }[];
  rose: string[]; lost: string[]; won: string[];
  /** What the stories inside the story did (intrigue.ts): each a line, and the land it is in. */
  stories?: { at: number; land: string; tone: 'good' | 'bad' | 'plain'; text: string }[];
  made: Named[]; gone: (Named & { how: string })[];
  /** Its towns that stand open, with nobody in them (deadtown.ts); and others' open towns its armies can reach. */
  open: string[]; openNear: string[];
  /** The world is going to ruin: what the player is told when it is under twenty seasons off (ruin.ts). */
  ruin?: string;
  /** The player has seen it. */
  seen?: boolean;
}

declare module './campaign' {
  interface Campaign { /** The nation when this season began, the report of the last one, and the last few to look back on (seasonreport.ts). */ seasonFrom?: Snapshot; seasonReport?: SeasonReport; seasonPast?: SeasonReport[] }
}

const named = (c: Campaign, at: number, n: Notable): Named => ({
  name: n.name, gender: n.gender, kind: n.kind, deed: n.deed, at, land: c.territories[at].name,
  ...(n.family ? { family: n.family } : {}), ...(n.unit ? { unit: n.unit } : {}), ...(n.kids ? { kids: n.kids } : {}),
});
const key = (n: { name: string; at: number }): string => `${n.at}|${n.name}`;

/** The nation of people `f` as it stands. */
export function snapshot(c: Campaign, f = 0): Snapshot {
  const own = c.territories.filter((t) => t.owner === f && !t.horde);
  const held: Snapshot['held'] = {};
  for (const b of c.bands ?? []) for (const h of b.held) if (h.owner === f) held[`${b.id}:${h.since}:${h.from}`] = { n: h.men.length + h.women.length, since: h.since };
  // And those a rival nation led away when it took a town (carriedoff.ts): they can be got back for as long as a band's captives.
  for (const x of c.carried ?? []) if (x.held.owner === f) held[`nation:${x.id}`] = { n: x.held.men.length + x.held.women.length, since: x.held.since };
  return {
    turn: c.turn, seq: c.ledgerSeq ?? 0,
    towns: own.map((t) => { const d = folkOf(c, t.id).drifted; return { id: t.id, tavern: d?.tavern ?? 0, mines: d?.mines ?? 0 }; }),
    notables: own.flatMap((t) => living(folkOf(c, t.id)).map((n) => named(c, t.id, n))),
    held,
  };
}

/** What changed for people `f` since the snapshot `s` was taken. */
export function reportSince(c: Campaign, s: Snapshot, f = 0): SeasonReport {
  const r: SeasonReport = { from: s.turn, turn: c.turn, born: 0, grew: 0, aged: 0, starved: 0, fell: 0, sick: 0, raidDead: 0, open: [], openNear: [], taken: 0, back: 0, lostForGood: 0, raids: [], drifted: { tavern: 0, mines: 0, home: 0 }, rose: [], lost: [], won: [], made: [], gone: [] };
  // The season's own ledger: births, coming of age, deaths of age and hunger, and the fallen.
  for (const e of ledgerSince(c, s.seq)) if (e.owner === f) r[e.kind] += e.n;
  // Raids on its towns, with how they went.
  for (const x of c.raids ?? []) if (x.owner === f && x.turn > s.turn) { r.raids.push({ at: x.at, land: c.territories[x.at].name, outcome: x.outcome, line: reportLine(c, x) }); r.raidDead += x.killed; }
  // The stories inside the story: what each did this season.
  const stories = (c.intrigueNews ?? []).filter((n) => n.owner === f && n.turn > s.turn).map((n) => ({ at: n.at, land: c.territories[n.at].name, tone: n.tone, text: n.text }));
  if (stories.length) r.stories = stories;
  // Its people held by bands: those newly taken, those got back, and those held too long.
  const now = snapshot(c, f);
  for (const [k, g] of Object.entries(now.held)) if (!s.held[k]) r.taken += g.n;
  for (const [k, g] of Object.entries(s.held)) {
    if (now.held[k]) continue;
    if (c.turn - g.since < THREATS.holdFor) r.back += g.n; else r.lostForGood += g.n;
  }
  // Who has drifted from their work, town by town (drift.ts), and who has come back to it.
  const was = new Map(s.towns.map((t) => [t.id, t]));
  for (const t of now.towns) {
    const b = was.get(t.id);
    if (!b) continue;
    const dt = t.tavern - b.tavern, dm = t.mines - b.mines;
    if (dt > 0) r.drifted.tavern += dt; else r.drifted.home -= dt;
    if (dm > 0) r.drifted.mines += dm; else r.drifted.home -= dm;
  }
  // Towns that rose, were lost or were won.
  const had = new Set(s.towns.map((t) => t.id)), has = new Set(now.towns.map((t) => t.id));
  for (const id of had) {
    if (has.has(id)) continue;
    const rose = (c.events ?? []).some((e) => e.at === id && e.kind === 'revolt' && e.turn > s.turn);
    (rose ? r.rose : r.lost).push(c.territories[id].name);
  }
  for (const id of has) if (!had.has(id)) r.won.push(c.territories[id].name);
  // Notable people made, and lost (wherever their town now is).
  const before = new Set(s.notables.map(key));
  r.made = now.notables.filter((n) => !before.has(key(n)));
  for (const n of s.notables) {
    const rec = c.territories[n.at].folk?.notables.find((x) => x.name === n.name);
    if (rec?.lost) r.gone.push({ ...n, how: rec.lost.how });
  }
  const home = householdNews(c, f, s.turn);
  if (home.length) r.household = home.map((x) => ({ text: x.text, tone: x.tone }));
  // Towns standing open: its own, and others' its armies could walk into.
  r.open = now.towns.filter((t) => isOpen(c, t.id)).map((t) => c.territories[t.id].name);
  const near = new Set(c.armies.filter((a) => a.owner === f).flatMap((a) => reach(c, a.at)));
  r.openNear = c.territories.filter((t) => t.owner !== f && near.has(t.id) && isOpen(c, t.id)).map((t) => t.name);
  if (ruinWarning(c)) r.ruin = ruinWarning(c);
  return r;
}

/** Whether anything at all happened in a season's report. */
export const anything = (r: SeasonReport): boolean =>
  r.born + r.grew + r.aged + r.starved + r.fell + (r.sick ?? 0) + r.raidDead + r.taken + r.back + r.lostForGood + r.drifted.tavern + r.drifted.mines + r.drifted.home > 0 ||
  r.raids.length + r.rose.length + r.lost.length + r.won.length + r.made.length + r.gone.length + (r.open?.length ?? 0) + (r.openNear?.length ?? 0) + (r.household?.length ?? 0) + (r.stories?.length ?? 0) + (r.ruin ? 1 : 0) > 0;

/** A season has turned: report the one just ended, and begin keeping the next. Called once a turn (campaign.ts). */
export function seasonTurned(c: Campaign, f = 0): void {
  if (c.seasonFrom && c.factions[f]?.alive) {
    const r = reportSince(c, c.seasonFrom, f);
    if (anything(r)) { c.seasonReport = r; c.seasonPast = [...(c.seasonPast ?? []), { ...r }].slice(-PAST_SEASONS); } else delete c.seasonReport;
  }
  c.seasonFrom = snapshot(c, f);
}
/** Seasons' reports kept to look back on. */
export const PAST_SEASONS = 8;
/** The seasons' reports kept, newest first. */
export const pastSeasons = (c: Campaign): SeasonReport[] => [...(c.seasonPast ?? [])].reverse();
/** The report waiting for the player, if there is one they have not yet seen. */
export const reportDue = (c: Campaign): SeasonReport | null => (c.seasonReport && !c.seasonReport.seen ? c.seasonReport : null);

/** The report as lines of words, only those with something in them. Counts for everyone; known people are in `made` and `gone`. */
export function reportLines(r: SeasonReport): { kind: 'people' | 'loss' | 'captives' | 'raid' | 'drift' | 'land' | 'story'; tone: 'good' | 'bad' | 'plain'; text: string }[] {
  const n = (k: number, one: string, many: string): string => `${k} ${k === 1 ? one : many}`;
  const out: ReturnType<typeof reportLines> = [];
  const add = (kind: (typeof out)[number]['kind'], tone: (typeof out)[number]['tone'], text: string): void => { out.push({ kind, tone, text }); };
  if (r.born) add('people', 'good', `${n(r.born, 'child was', 'children were')} born.`);
  if (r.grew) add('people', 'good', `${n(r.grew, 'child came', 'children came')} of age.`);
  if (r.aged) add('loss', 'plain', `${n(r.aged, 'died', 'died')} of old age.`);
  if (r.starved) add('loss', 'bad', `${n(r.starved, 'died', 'died')} of hunger.`);
  if (r.sick) add('loss', 'bad', `${n(r.sick, 'died', 'died')} of plague.`);
  if (r.fell) add('loss', 'bad', `${n(r.fell, 'man was', 'men were')} killed in battle.`);
  if (r.raidDead) add('loss', 'bad', `${n(r.raidDead, 'man was', 'men were')} killed in raids.`);
  const dead = r.aged + r.starved + r.fell + (r.sick ?? 0) + (r.raidDead ?? 0);
  if ([r.aged, r.starved, r.fell, r.sick ?? 0, r.raidDead ?? 0].filter(Boolean).length > 1) add('loss', 'plain', `${dead} died in all.`);
  if (r.taken) add('captives', 'bad', `${n(r.taken, 'was', 'were')} carried off.`);
  if (r.back) add('captives', 'good', `${n(r.back, 'was', 'were')} got back.`);
  if (r.lostForGood) add('captives', 'bad', `${n(r.lostForGood, 'was', 'were')} held too long and will not be seen again.`);
  for (const x of r.raids) add('raid', x.outcome === 'held' ? 'good' : 'bad', x.line);
  if (r.drifted.tavern) add('drift', 'bad', `${n(r.drifted.tavern, 'woman went', 'women went')} to the tavern.`);
  if (r.drifted.mines) add('drift', 'bad', `${n(r.drifted.mines, 'man went', 'men went')} to the mines.`);
  if (r.drifted.home) add('drift', 'good', `${n(r.drifted.home, 'came', 'came')} back to their work.`);
  for (const t of r.rose) add('land', 'bad', `${t} rose and threw you off.`);
  for (const t of r.lost) add('land', 'bad', `${t} was lost.`);
  for (const t of r.won) add('land', 'good', `${t} is yours.`);
  for (const x of r.household ?? []) add('people', x.tone, x.text);
  for (const t of r.open ?? []) add('land', 'bad', `${t} stands open: nobody is left in it, and anyone who marches on it has it. Send people by convoy, or an army to hold it.`);
  for (const t of r.openNear ?? []) add('land', 'good', `${t} stands open, within reach of your armies: march on it and it is yours.`);
  for (const x of r.stories ?? []) add('story', x.tone, x.text);
  if (r.ruin) add('land', 'bad', r.ruin);
  return out;
}
