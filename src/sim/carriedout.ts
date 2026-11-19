// Those carried off in a battle, as the field leaves them (docs/DESIGN.md, "Captivity"; "People persist").
//
// A side's people seized in a battle fought in person are held by those who seized them as it ends: led by a raider
// on his way home, or kept in a work camp or the marauders' lair. The town's count has always told how many
// (battlefolk.ts `Census.taken`), and they were gone. Here, as the battle ends, each is written down by name: their
// house, man or woman, their age as the record keeps it, and the children borne to them in the camp. The map side
// (battlecarried.ts) holds them in a land of the people who took them, to be got back as those a nation carries off
// from a town it takes are (carriedoff.ts).
// Plain data: it reads the field and imports nothing of the campaign.
import { GROWN_SEASON, LAST_SEASON, SEASONS_A_YEAR, yearsOf } from './ageing';
import type { Captive, Game } from './game';

/** One of a town's people carried off in a battle, as the field leaves them. */
export interface CarriedOne { name: string; family?: string; gender: 'm' | 'f'; /** Their age on the record, in seasons. */ seasons: number; /** Children borne to them in the camp. */ young?: number; /** Held by the wild's marauders, not a people of the battle. */ wild?: boolean }

declare module './township' {
  interface Census { /** Its people held by those who seized them as the battle ended, by name (carriedout.ts). */ carried?: CarriedOne[] }
}

const one = (c: Captive, wild: boolean): CarriedOne => ({
  name: c.name, ...(c.family ? { family: c.family } : {}), gender: c.gender === 'm' ? 'm' : 'f',
  seasons: Math.max(GROWN_SEASON, Math.min(LAST_SEASON, Math.round(yearsOf(c.age, c.lifespan) * SEASONS_A_YEAR))),
  ...(c.young?.length ? { young: c.young.length } : {}), ...(wild ? { wild: true } : {}),
});

/** As the battle ends: this side's people held by those who seized them, by name. Nothing where none are. */
export function carriedOut(g: Game, owner: number): { carried?: CarriedOne[] } {
  const out: CarriedOne[] = [];
  for (const u of g.units) if (!u.dead && u.captive && u.captive.from === owner && u.owner !== owner) out.push(one(u.captive, !!g.players[u.owner]?.neutral));
  for (const b of g.buildings) if (!b.dead && b.owner !== owner) for (const c of b.captives ?? []) if (c.from === owner) out.push(one(c, !!g.players[b.owner]?.neutral));
  return out.length ? { carried: out } : {};
}
