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
import { GROW_TIME, LIFESPAN, NAMES_F, NAMES_M } from './data';
import type { Building, Captive, Game, Unit } from './game';
import { Child, wardFor } from './nursery';

/** Seconds from being seized during which a captive can still be got back. */
export const CAPTIVE_HOLD = 600;
/** Their people are warned when this many seconds are left. */
export const CAPTIVE_WARN = 120;
/** Years of life a captive loses if held the whole time, and the years a whole adult life runs to. */
export const YEARS_MAN = 20;
export const YEARS_WOMAN = 30;
export const LIFE_YEARS = 54;
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
  const gender = pick(g, salt) < 0.5 ? 'm' as const : 'f' as const, names = gender === 'm' ? NAMES_M : NAMES_F;
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
    for (const k of c.young ?? []) k.left = Math.max(1, k.left - 1);
    if (left === null) continue;
    if (left <= CAPTIVE_WARN && !c.warned && left > 0) {
      c.warned = true;
      say(g, c.from, `⏳ ${c.name} has been held ${Math.round(heldFor(g, c) / 60)} minutes. In two more ${c.gender === 'f' ? 'she' : 'he'} will be ${lair ? 'dead' : 'sold on'}, and past getting back.`);
    }
    if (left > 0) continue;
    b.captives.splice(i, 1);
    lost++;
    const kids = c.young?.length ?? 0, with_ = kids ? ` ${kids === 1 ? 'The child' : `The ${kids} children`} born there ${kids === 1 ? 'is' : 'are'} lost with ${c.gender === 'f' ? 'her' : 'him'}.` : '';
    if (lair) say(g, c.from, `🕯️ ${c.name}, held by the marauders, is dead.${with_}`);
    else {
      say(g, c.from, `🕯️ ${c.name} has been sold on from the work camp and is lost to you.${with_}`);
      const keeper = g.players[b.owner];
      if (keeper) { keeper.res.gold += SOLD_GOLD; say(g, b.owner, `⛓️ ${c.name} has been sold on for ${SOLD_GOLD} gold.`); }
    }
  }
  return lost;
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
