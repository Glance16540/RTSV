// The story's turn (docs/PORTING.md: the hubs keep to an import and a call or two). The rules that use story.ts's
// words and numbers: what befalls the whole world, the tales put before the player and how an answer is carried
// out, and how each rival people answers its own. Moved out of campaign.ts as it stood, with nothing changed.
//
// campaign.ts calls `storyTurn(c)` once a season. Whoever puts a tale to the player uses `taleNow`, `taleText`,
// `canAnswer` and `answerTale`.
import type { Campaign } from './campaign';
import { MAX_ARMY, MAX_FAVOR, armyAt, armySize, casualties, faithOf, luck, placeAt, placesOf, shiftVirtue, tell } from './campaign';
import { LEANING } from './creed';
import { canPayFor, payFor } from './prices';
import { COMET_VIRTUE, TALES, TALE_EVERY, TALE_FROM, TALE_RIVAL, Tale, TaleChoice, WORLD_CHANCE, WORLD_EVENTS, WORLD_FROM, WORLD_REST, WorldKind } from './story';
import { leaningWith } from './temper';
import { tribeArms } from './tribes';

/** The words of a tale with its names filled in. */
export function taleText(c: Campaign, text: string): string {
  const t = c.tale;
  if (!t) return text;
  return text.replace(/\{land\}/g, c.territories[t.land]?.name ?? 'your land').replace(/\{rival\}/g, t.rival > 0 ? `the ${c.factions[t.rival].name}` : 'a rival').replace(/\{tribe\}/g, c.territories[t.tribe]?.name ?? 'the next valley').replace(/\{place\}/g, placeAt(c, t.land)?.name ?? 'the old place')
    .replace(/(^|[.!?] )the /g, (_, lead: string) => `${lead}The `);
}
export const taleNow = (c: Campaign): Tale | undefined => (c.tale ? TALES.find((x) => x.id === c.tale!.id) : undefined);
/** Can the player afford this answer to the tale before them? */
export function canAnswer(c: Campaign, choice: 'a' | 'b'): boolean {
  const tale = taleNow(c);
  return !!tale && c.phase === 'player' && (tale[choice].supplies >= 0 || canPayFor(c, 0, 'dealing', -tale[choice].supplies));
}
/** The player answers the tale before them. */
export function answerTale(c: Campaign, choice: 'a' | 'b'): boolean {
  const tale = taleNow(c), t = c.tale;
  if (!tale || !t || !canAnswer(c, choice)) return false;
  const ch: TaleChoice = tale[choice], me = c.factions[0];
  const result = taleText(c, ch.result);
  c.tale = null;
  (c.answers ??= []).push({ id: tale.id, choice, turn: c.turn, land: t.land, rival: t.rival, tribe: t.tribe });
  if (ch.supplies < 0) payFor(c, 0, 'dealing', -ch.supplies, { at: t.land }); else me.supplies += ch.supplies;
  if (ch.favor && t.rival > 0) c.factions[t.rival].favor = Math.max(-MAX_FAVOR, Math.min(MAX_FAVOR, (c.factions[t.rival].favor ?? 0) + ch.favor));
  if (ch.militia && c.territories[t.tribe]?.owner < 0) tribeArms(c, t.tribe, ch.militia);
  if (ch.join && c.territories[t.tribe]?.owner < 0 && !c.territories[t.tribe].horde) {
    const land = c.territories[t.tribe];
    land.owner = 0;
    tell(c, `${land.name} came under your rule of its own will${placeAt(c, land.id) ? `, and ${placeAt(c, land.id)!.name} with it` : ''}.`);
  }
  if (ch.company) {
    const home = c.territories.find((x) => x.capital === 0 && x.owner === 0) ?? c.territories[t.land];
    const a = armyAt(c, home.id);
    if (a && a.owner === 0) { if (armySize(a) < MAX_ARMY) a.units.infantry = (a.units.infantry ?? 0) + 1; }
    else if (!a) c.armies.push({ id: c.nextArmy++, owner: 0, at: home.id, units: { infantry: 1 }, hero: false, vet: 0, moved: true });
  }
  c.log.push(result);
  tell(c, `${tale.title}: ${result}`);
  shiftVirtue(c, 0, ch.virtue);
  return true;
}

/** The world's own events, and the tales that come before each people in turn. */
export function storyTurn(c: Campaign): void {
  // Something that befalls everyone.
  if (c.world && c.world.until < c.turn) { c.log.push(`${WORLD_EVENTS[c.world.kind].name} is over.`); c.world = null; c.worldRest = c.turn + WORLD_REST; }
  if (!c.world && c.turn >= Math.max(WORLD_FROM, c.worldRest ?? 0) && luck(c, 70) < WORLD_CHANCE) {
    const kinds = Object.keys(WORLD_EVENTS) as WorldKind[];
    const kind = kinds[Math.floor(luck(c, 71) * kinds.length)], def = WORLD_EVENTS[kind];
    c.log.push(`${def.icon} ${def.name}. ${def.desc}${def.turns ? ` It will last ${def.turns} turns.` : ''}`);
    tell(c, def.tell);
    if (def.turns) c.world = { kind, until: c.turn + def.turns - 1 };
    else {
      c.worldRest = c.turn + WORLD_REST;
      if (kind === 'comet') for (const f of c.factions) if (f.alive) shiftVirtue(c, f.id, COMET_VIRTUE);
      if (kind === 'pestilence') for (const a of c.armies.slice()) if (armySize(a) >= 3 && !faithOf(c, a.owner).steadfast) casualties(a, 1);
    }
  }
  // A tale for the player, and each rival answers one of its own as its people lean.
  if (c.turn < TALE_FROM || (c.turn - TALE_FROM) % TALE_EVERY) return;
  c.factions.forEach((f) => {
    if (!f.alive || !f.isAI) return;
    shiftVirtue(c, f.id, luck(c, 80 + f.id) < leaningWith(f.civ, LEANING[f.civ] ?? 0.5) ? TALE_RIVAL : -TALE_RIVAL);
  });
  const mine = c.territories.filter((t) => t.owner === 0);
  if (!mine.length || c.phase === 'over') return;
  const rivals = c.factions.filter((f) => f.alive && f.id > 0);
  const tribes = mine.flatMap((t) => t.adj).filter((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
  const asked = (c.asked ??= []);
  // First, whatever an earlier answer has led to: the same land, the same rival, the same tribe.
  for (const x of TALES) {
    if (!x.after || asked.includes(x.id)) continue;
    const was = (c.answers ?? []).find((a) => a.id === x.after!.id && a.choice === x.after!.choice);
    if (!was) continue;
    const land = c.territories[was.land]?.owner === 0 ? was.land : mine[0].id;
    if ((x.needs === 'rival' && !c.factions[was.rival]?.alive) || (x.needs === 'tribe' && (c.territories[was.tribe]?.owner !== -1 || c.territories[was.tribe].horde))) { asked.push(x.id); continue; } // the thread is dropped
    asked.push(x.id);
    c.lastTale = x.id;
    c.tale = { id: x.id, land, rival: was.rival, tribe: was.tribe };
    c.log.push(`${x.title}: a matter is brought before you.`);
    return;
  }
  // Otherwise a new matter: one about a named place the player holds, or one that could come to anybody.
  const held = placesOf(c).filter((p) => c.territories[p.at].owner === 0);
  const fits = TALES.filter((x) => !x.after && x.id !== c.lastTale && (x.needs !== 'rival' || rivals.length) && (x.needs !== 'tribe' || tribes.length) && (!x.place || held.some((p) => p.kind === x.place)));
  const fresh = fits.filter((x) => !asked.includes(x.id));
  const open = fresh.length ? fresh : fits;
  const tale = open[Math.floor(luck(c, 90) * open.length)];
  if (!tale) return;
  c.lastTale = tale.id;
  asked.push(tale.id);
  c.tale = {
    id: tale.id, land: tale.place ? held.find((p) => p.kind === tale.place)!.at : mine[Math.floor(luck(c, 91) * mine.length)].id,
    rival: rivals.length ? rivals[Math.floor(luck(c, 92) * rivals.length)].id : -1,
    tribe: tribes.length ? tribes[Math.floor(luck(c, 93) * tribes.length)] : -1,
  };
  c.log.push(`${tale.title}: a matter is brought before you.`);
}
