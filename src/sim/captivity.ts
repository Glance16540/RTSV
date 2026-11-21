// What being held costs, by the owner's design (docs/DESIGN.md, "Captivity").
//
// For a time. Someone carried off can be got back for ten minutes from the moment they were seized. After that
// they are lost to their people: sold on from a Work Camp (the keeper is paid for them), dead in the marauders'
// camp. Their people are warned two minutes before, and told when it happens.
//
// A shorter life. Captivity spends a person's years: a man held the whole time comes home about twenty years
// older, a woman thirty, and in proportion for less. Nobody dies of it at the gate: they come home, and live
// what is left to them.
//
// Children. A woman held bears children, in a Work Camp and in the marauders' camp alike. They are entries in
// her record and nothing else: never set on the map, never drawn. While she is held, each one raises what the
// keeper gets out of the camp by half a man's labour. They are hers and her people's: got back, she brings them
// home with her and they are written into a roof of her town to grow up there. Lost, they are lost with her.
// (A people that takes captives into itself, as raiders do, gains the person outright at once: that is in
// game.ts, and holds no one long enough for any of this.)
import { givenNames } from './peoplenames';
import { ELDER_AT, GROW_TIME, LIFESPAN, POP_LIMIT } from './data';
import { GROWN_YEARS, OLD_YEARS } from './ageing';
import type { Building, Captive, Entity, Game, Player, Unit } from './game';
import { CAMP_BIRTH, CAPTIVE_CAP, CAPTIVE_VIRTUE, ESCAPE_TIME, GUARD_DRIVE, GUARD_WATCH, REVOLT_MEN, REVOLT_TIME, isDecadent } from './creed';
import { TYRANT_BIRTH } from './hero';
import { rescue } from './rescue';
import { Child, wardFor } from './nursery';
import { OutHow, cameOut } from './campout';

/** Seconds from being seized during which a captive can still be got back. */
export const CAPTIVE_HOLD = 600;
/** Their people are warned when this many seconds are left. */
export const CAPTIVE_WARN = 120;
/** Years of life a captive loses if held the whole time, and the years a whole adult life runs to. */
export const YEARS_MAN = 20;
export const YEARS_WOMAN = 30;
/** The years a whole adult life runs to, as the town's record reckons them (ageing.ts), so the years lost match. */
export const LIFE_YEARS = (OLD_YEARS - GROWN_YEARS) / ELDER_AT;
/** What each child born in captivity adds to the keeper's output, counted in men's labour. */
export const CHILD_WORK = 0.5;
/** Gold a Work Camp's keeper is paid for a captive sold on. */
export const SOLD_GOLD = 30;

/** Seconds this person has been held. One with no mark of when they were taken (set down by a mission) is not on the clock. */
export const heldFor = (g: Game, c: Captive): number => (c.taken === undefined ? 0 : Math.max(0, g.time - c.taken));
/** Seconds left in which they can be got back; null for one who is not on the clock. */
export const timeLeft = (g: Game, c: Captive): number | null => (c.taken === undefined ? null : Math.max(0, CAPTIVE_HOLD - heldFor(g, c)));
/** Years of life captivity has cost them so far. */
export const yearsSpent = (g: Game, c: Captive): number =>
  (c.gender === 'f' ? YEARS_WOMAN : YEARS_MAN) * Math.min(1, heldFor(g, c) / CAPTIVE_HOLD);
/** Children born to the captives of a camp, and what they add to its keeper's output. */
export const campChildren = (b: Building): number => (b.captives ?? []).reduce((n, c) => n + (c.young?.length ?? 0), 0);
export const campLabour = (b: Building): number => CHILD_WORK * campChildren(b);

// Decided without the game's dice, so the rest of a match is not disturbed by it.
const pick = (g: Game, salt: number): number => (((g.seed * 31 + Math.floor(g.time * 20) * 40503 + salt * 2654435761) >>> 0) % 100000) / 100000;

/** A child is born to a woman held: written into her record. Returns it. */
export function bearCaptive(g: Game, mother: Captive): Child {
  const n = (mother.born ?? 0) + 1, salt = mother.name.length * 131 + n * 17 + mother.from;
  const gender = pick(g, salt) < 0.5 ? 'm' as const : 'f' as const, names = givenNames(mother.people ?? g.players[mother.from]?.civ, gender); // her own people's names (peoplenames.ts)
  const child: Child = {
    id: -Math.floor(g.time * 20) - n, name: names[Math.floor(pick(g, salt + 1) * names.length)], family: mother.family, gender, trait: '', trait2: '',
    lifespan: LIFESPAN[0] + pick(g, salt + 2) * (LIFESPAN[1] - LIFESPAN[0]), left: GROW_TIME, bornAt: 0,
  };
  mother.born = n;
  (mother.young ??= []).push(child);
  return child;
}

/** A child is born in a Work Camp, to the woman there who has borne fewest. Null when it holds no woman. */
export function campChild(g: Game, b: Building): Child | null {
  const women = (b.captives ?? []).filter((c) => c.gender === 'f');
  if (!women.length) return null;
  return bearCaptive(g, women.reduce((a, c) => ((a.born ?? 0) <= (c.born ?? 0) ? a : c)));
}

const say = (g: Game, player: number, text: string): void => { if (g.players[player] && !g.players[player].defeated) g.events.push({ t: 'msg', player, text }); };

/**
 * One second for everyone held in a camp. Their children grow a second older (and wait to come of age at home);
 * those two minutes from being lost are named to their people; those whose time is up are lost. Returns how many were.
 */
export function tendCaptives(g: Game, b: Building): number {
  if (!b.captives?.length) return 0;
  const lair = b.type === 'lair';
  let lost = 0;
  for (let i = b.captives.length - 1; i >= 0; i--) {
    const c = b.captives[i], left = timeLeft(g, c);
    if (!g.bornOnly) for (const k of c.young ?? []) k.left = Math.max(1, k.left - 1); // nobody ages in a campaign town
    if (left === null) continue;
    if (left <= CAPTIVE_WARN && !c.warned && left > 0) {
      c.warned = true;
      say(g, c.from, `⏳ ${c.name} has been held ${Math.round(heldFor(g, c) / 60)} minutes. In two more ${c.gender === 'f' ? 'she' : 'he'} will be ${lair ? 'dead' : 'sold on'}, and past getting back.`);
    }
    if (left > 0) continue;
    if (lair) {
      b.captives.splice(i, 1);
      const kids = c.young?.length ?? 0, with_ = kids ? ` ${kids === 1 ? 'The child' : `The ${kids} children`} born there ${kids === 1 ? 'is' : 'are'} lost with ${c.gender === 'f' ? 'her' : 'him'}.` : '';
      say(g, c.from, `🕯️ ${c.name}, held by the marauders, is dead.${with_}`);
    } else sellOn(g, b, i);
    lost++;
  }
  return lost;
}

/** One held in a work camp is sold on: lost to their people, and SOLD_GOLD to the camp's keeper. */
export function sellOn(g: Game, b: Building, i: number): void {
  const c = b.captives?.[i];
  if (!c) return;
  b.captives!.splice(i, 1);
  const kids = c.young?.length ?? 0, with_ = kids ? ` ${kids === 1 ? 'The child' : `The ${kids} children`} born there ${kids === 1 ? 'is' : 'are'} lost with ${c.gender === 'f' ? 'her' : 'him'}.` : '';
  say(g, c.from, `🕯️ ${c.name} has been sold on from the work camp and is lost to you.${with_}`);
  const keeper = g.players[b.owner];
  if (keeper) { keeper.res.gold += SOLD_GOLD; say(g, b.owner, `⛓️ ${c.name} has been sold on for ${SOLD_GOLD} gold.`); }
}

/**
 * Someone held has got home, by whatever way: `v` is the villager they are again. The years captivity cost are
 * on them, it is set down in their record, and a woman's children come with her to a roof of her town.
 */
export function comeHome(g: Game, c: Captive, v: Unit): void {
  const years = Math.round(yearsSpent(g, c));
  if (years >= 1 && v.lifespan > 0) {
    v.age = Math.min(v.lifespan * 0.98, v.age + (yearsSpent(g, c) / LIFE_YEARS) * v.lifespan);
    (v.story ??= [...(c.story ?? [])]).push({ t: g.time, s: `Held ${Math.max(1, Math.round(heldFor(g, c) / 60))} minutes: came home ${years} ${years === 1 ? 'year' : 'years'} older` });
  }
  const young = c.young ?? [];
  if (!young.length) return;
  c.young = [];
  const home = g.players[c.from];
  const roof = wardFor(g.buildings, { id: 0, owner: c.from, type: '', complete: true, dead: false, x: v.x, y: v.y });
  if (roof) (roof.young ??= []).push(...young); else (home.wards ??= []).push(...young);
  home.pop += young.length * v.def.pop; // counted among the town's people from now, as any child is
  (v.story ??= [...(c.story ?? [])]).push({ t: g.time, s: `Brought home ${young.length === 1 ? 'the child' : `${young.length} children`} born in captivity` });
  say(g, c.from, `${c.name} has brought home ${young.length === 1 ? `a child, ${young[0].name},` : `${young.length} children`} born in captivity. ${young.length === 1 ? 'It is' : 'They are'} yours, and will grow up ${roof ? `under the roof of a ${roof.def.name.toLowerCase()}` : 'among your people'}.`);
}

/** Everyone taken from this town who is still held or being led away, soonest lost first: for its own record of them. */
export function takenFrom(g: Game, owner: number): { c: Captive; where: string; left: number | null }[] {
  const out: { c: Captive; where: string; left: number | null }[] = [];
  for (const b of g.buildings) for (const c of b.captives ?? []) if (c.from === owner) out.push({ c, where: b.type === 'lair' ? 'the marauders\' camp' : `${g.players[b.owner]?.name ?? 'a'}'s ${b.def.name}`, left: timeLeft(g, c) });
  for (const u of g.units) if (u.captive && !u.dead && u.captive.from === owner) out.push({ c: u.captive, where: 'the road, being led away', left: timeLeft(g, u.captive) });
  return out.sort((a, b) => (a.left ?? Infinity) - (b.left ?? Infinity));
}

// ---- Taking, keeping and freeing (moved out of game.ts as they stood) ----

/** Can g unit carry a villager off? Slavers always; among raiders, any fighter on foot or horse. */
export function canSeize(g: Game, u: Unit): boolean {
  return g.slaves(u) || (g.raider(u.owner) && !u.def.naval && (u.def.cls === 'infantry' || u.def.cls === 'cavalry' || u.def.cls === 'ranged' || u.def.cls === 'hero'));
}
/** Raiders do not cut down a grown villager on sight: they are worth more alive. */
export function spared(g: Game, u: Unit, e: Entity): boolean {
  return e.kind === 'unit' && e.type === 'villager' && e.growT <= 0 && !g.slaves(u) && g.canSeize(u) && e.owner !== g.wild;
}
/** Is g villager free for g raider to take: he has his hands free, there is room, and no comrade is already at it. */
export function takes(g: Game, u: Unit, e: Entity): boolean {
  if (u.captive || g.players[u.owner].pop >= POP_LIMIT) return false;
  for (const o of g.units) if (o !== u && o.owner === u.owner && o.order?.t === 'capture' && o.order.id === e.id) return false;
  return true;
}
/** Where a raider takes a captive to join the tribe: the nearest hall, else any roof of theirs. */
export function hearthOf(g: Game, u: Unit): Building | null {
  let best: Building | null = null, bd = Infinity;
  for (const b of g.buildings) {
    if (b.owner !== u.owner || !b.complete || b.def.wall || b.type === 'farm') continue;
    const d = Math.hypot(b.x - u.x, b.y - u.y) + (b.type === 'towncenter' ? 0 : b.type === 'house' ? 6 : 14);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
/** A captive taken into a raiding tribe becomes one of its own villagers. */
export function adopt(g: Game, owner: number, c: Captive, x: number, y: number): void {
  const at = g.landPf.nearestFree(x, y);
  const v = g.spawnUnit('villager', owner, at.x, at.y, c.gender);
  v.name = c.name; v.family = c.family; v.trait = c.trait; v.trait2 = c.trait2; v.age = c.age; v.lifespan = c.lifespan;
  v.kids = c.kids; v.captiveKids = c.born; v.story = [...(c.story ?? []), { t: g.time, s: `Taken into the ${g.players[owner].name}` }];
  v.people = c.people ?? g.players[c.from]?.civ;
  g.msg(owner, `${c.name} has been taken into the tribe.`);
}

/** The nearest of a Slaver's own work camps that can take another captive. */
export function campWithRoom(g: Game, u: Unit): Building | null {
  let best: Building | null = null, bd = Infinity;
  for (const b of g.buildings) {
    if (b.owner !== u.owner || !b.def.camp || !b.complete || (b.captives?.length ?? 0) >= b.def.camp) continue;
    const d = Math.hypot(b.x - u.x, b.y - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** A captive set free returns to their own people as they were, if those people still stand. */
export function freeCaptive(g: Game, c: Captive, x: number, y: number): void {
  const home = g.players[c.from];
  if (!home || home.defeated) return;
  const at = g.landPf.nearestFree(x, y);
  const v = g.spawnUnit('villager', c.from, at.x, at.y, c.gender);
  v.name = c.name; v.family = c.family; v.trait = c.trait; v.trait2 = c.trait2; v.age = c.age; v.lifespan = c.lifespan;
  v.kids = c.kids; v.captiveKids = c.born;
  if (c.people) v.people = c.people;
  v.story = [...(c.story ?? []), { t: g.time, s: 'Freed, and came home' }];
  // What the marauders did to her is not undone by burning their camp: she will bear no more children. But she
  // has come through it, and works like one who means to live.
  if (c.held && c.gender === 'f') v.freed = true;
  comeHome(g, c, v);
  g.msg(c.from, c.held ? `${c.name} is free of the marauders and has come home${c.born ? `, having borne them ${c.born} ${c.born === 1 ? 'child' : 'children'}` : ''}.` : `${c.name} is free and has come home.`);
}

// ---- The work camps (moved out of game.ts as they stood) ----

/** How many of a camp's captives its guards cannot keep an eye on. */
export function unwatched(b: Building): number { return Math.max(0, (b.captives?.length ?? 0) - GUARD_WATCH * Math.min(b.def.guards ?? 0, b.staff?.length ?? 0)); }
/** One captive gets out of a camp and makes for home on foot: they can be run down again on the way. */
export function breakOut(g: Game, b: Building, i: number, how?: OutHow): void {
  const c = b.captives!.splice(i, 1)[0], home = g.players[c.from];
  if (!home || home.defeated) return;
  const at = g.landPf.nearestFree(b.x, b.y + b.size / 2 + 0.8);
  const v = g.spawnUnit('villager', c.from, at.x, at.y, c.gender);
  v.name = c.name; v.family = c.family; v.trait = c.trait; v.trait2 = c.trait2; v.age = c.age; v.lifespan = c.lifespan;
  v.kids = c.kids; v.captiveKids = c.born; v.story = [...(c.story ?? []), { t: g.time, s: 'Got out of the camp' }];
  if (c.people) v.people = c.people;
  comeHome(g, c, v);
  if (how) cameOut(g, v, how); // slipped away, or out with a rising: how it is drawn for a little while (campout.ts)
  const tc = g.tcs[c.from]?.[0];
  if (tc) g.cmdMove(c.from, [v.id], tc.x, tc.y + tc.size / 2 + 1);
  g.msg(c.from, `${c.name} has got out of the camp and is running for home.`);
}
/**
 * What holding people costs. By night, a captive no guard is watching may slip away; and a camp with enough men
 * unwatched may rise: they fire the place and half of all it holds break out at once. Each guard posted watches
 * three. (Decided without the game's dice, so the rest of the match is not disturbed by it.)
 */
export function campNight(g: Game, p: Player, b: Building): void {
  const loose = unwatched(b);
  if (!loose) return;
  const roll = (salt: number): number => (((g.seed * 31 + b.id * 2654435761 + Math.floor(g.time) * 40503 + salt * 7919) >>> 0) % 100000) / 100000;
  const menLoose = Math.min(loose, b.captives!.filter((c) => c.gender === 'm').length);
  if (menLoose >= REVOLT_MEN && roll(1) < 1 / REVOLT_TIME) {
    const out = Math.ceil(b.captives!.length / 2);
    for (let k = 0; k < out; k++) breakOut(g, b, b.captives!.length - 1, 'rise');
    b.burnT = Math.max(b.burnT, 10);
    b.hp = Math.max(1, b.hp - b.maxHp * 0.25);
    g.msg(p.id, `⛓️ The work camp has risen in the night! ${out} captives have broken out and the stockade is burning. Post more guards.`);
    g.events.push({ t: 'alert', player: p.id, x: b.x, y: b.y });
    return;
  }
  if (roll(2) < 1 / ESCAPE_TIME) { // one at a time, about one a night: a trickle, where a rising is a flood
    breakOut(g, b, b.captives!.length - 1, 'slip'); // the last brought in is the least watched
    g.msg(p.id, '⛓️ A captive has slipped away from the work camp in the night. A guard would have seen it.');
  }
}

export function updateCamps(g: Game, p: Player): void {
  p.captives = 0;
  p.captiveMen = 0;
  for (const b of g.buildings) {
    if (b.owner !== p.id || !b.captives?.length) continue;
    if (tendCaptives(g, b) && !b.captives.length) continue;
    // The men are put to work; the women held there bear children, who are theirs and are kept on their records.
    const men = b.captives.filter((c) => c.gender === 'm').length, women = b.captives.length - men;
    p.captives += b.captives.length;
    // Men under a guard's eye are driven harder.
    p.captiveMen += men * (1 + GUARD_DRIVE * Math.min(b.def.guards ?? 0, b.staff?.length ?? 0)) + campLabour(b);
    // Under a decadent leader's eye the camps are made to fill the town far faster.
    b.campT = (b.campT ?? 0) + (women / CAMP_BIRTH) * (g.leaders[p.id] && !g.leaders[p.id]!.dead && isDecadent(p.virtue) ? TYRANT_BIRTH : 1);
    if (b.campT >= 1) { b.campT = 0; campChild(g, b); }
    if (rescue(g, b) && !b.captives.length) continue;
    if (g.night) campNight(g, p, b);
  }
  if (p.captives) g.shiftVirtue(p.id, (-Math.min(CAPTIVE_CAP, p.captives) * CAPTIVE_VIRTUE) / 60);
}
