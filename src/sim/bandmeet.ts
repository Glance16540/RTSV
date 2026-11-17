// A band coming, put to the player (docs/PLAYTEST.md, finding 13: the encounter window never opened by itself,
// because a band that strikes a town is settled on the map without it).
//
// When a band has one of the player's towns for its mark (it is camped where the town is in its reach, or it is on
// the march and the town is its mark where it is bound) and the player has an army that can be ordered against it
// now (bandfight.ts: at the band's place or beside it, not yet marched), the matter is put to the player once:
// go out and fight them in person, send the army to settle it by its own means, or let them come.
//
// And when a band has struck a town of theirs with nobody to answer it, the player is told face to face what it
// came to, once for the season (`struckToTell`).
//
// It does not nag: each band is put once (`Campaign.bandAsked`), and never when nothing can answer. A band put to
// the player while no army could reach it is not counted as asked; it comes up when one can. Nothing here changes
// the rules: the choices are the order the map already gives (`attackBand`) and the settling it already has.
import type { Army, Campaign } from './campaign';
import { armyStrength } from './campaignbase';
import { Band, Raid, reachOf, reportLine, softest } from './threats';
import { THREATS } from './threatsbase';
import { armiesFor, attackBand } from './bandfight';

declare module './campaign' {
  interface Campaign {
    /** Bands already put to the player as coming for a town of theirs, by id (bandmeet.ts). */ bandAsked?: number[];
    /** The season whose strikes on the player's towns have been told to them face to face (bandmeet.ts). */ strikesTold?: number;
  }
}

export interface Coming { band: Band; /** The player's town it has for its mark. */ mark: number; /** It is on the march, not yet where it is bound. */ marching: boolean; /** The army that would go: the strongest that can. */ army: Army }

/** The town a band has for its mark: the softest in its reach, or where it is bound if it is still on the march. */
export function markOf(c: Campaign, b: Band): number | undefined {
  return (softest(c, b) ?? (b.bound !== undefined ? softest(c, b, reachOf(c, { ...b, at: b.bound })) : null))?.id;
}

/** A band coming for a town of the player's that an army of theirs can meet now, and that has not been put to them: the strongest first. */
export function bandComing(c: Campaign): Coming | null {
  if (c.phase !== 'player' || c.pending || c.demand || !c.factions[0]?.alive) return null;
  const asked = c.bandAsked ?? [];
  const all: Coming[] = [];
  for (const b of c.bands ?? []) {
    if (b.kind === 'marauders' || asked.includes(b.id)) continue;
    const mark = markOf(c, b);
    if (mark === undefined || c.territories[mark].owner !== 0) continue;
    const army = armiesFor(c, b.id).sort((x, y) => armyStrength(y, c) - armyStrength(x, c) || x.id - y.id)[0];
    if (!army) continue;
    all.push({ band: b, mark, marching: b.bound !== undefined && softest(c, b)?.id !== mark, army });
  }
  return all.sort((x, y) => y.band.strength - x.band.strength || x.band.id - y.band.id)[0] ?? null;
}

/** The band has been put to the player: it is not put again. */
export function askedOf(c: Campaign, band: number): void {
  const list = (c.bandAsked ??= []);
  if (!list.includes(band)) list.push(band);
  const alive = new Set((c.bands ?? []).map((b) => b.id));
  c.bandAsked = list.filter((id) => alive.has(id)); // a band that is gone is forgotten
}

/** The player sends the army out against it: the battle the map already has (bandfight.ts). Returns whether it opened. */
export function goOut(c: Campaign, coming: Coming): boolean {
  return attackBand(c, coming.army.id, coming.band.id) === 'battle';
}

/** What a season's strikes on the player's towns came to, for telling: each strike, the band that did the worst of it if it is still about, and the words. */
export interface Struck { raids: Raid[]; band?: Band; title: string; lines: string[] }

/**
 * The strikes of the season just turned that got into a town of the player's (raided or taken; one beaten off is
 * good news and waits for the season's card), not yet told: who came, what was lost, who was carried off by name,
 * and how long there is to get them back. Null if there is nothing to tell or it has been told.
 */
export function struckToTell(c: Campaign): Struck | null {
  if (c.phase !== 'player' || c.pending || c.demand || (c.strikesTold ?? -1) >= c.turn) return null;
  const cost = (r: Raid): number => r.killed + r.taken.men + r.taken.women;
  const raids = (c.raids ?? []).filter((r) => r.turn === c.turn && r.owner === 0 && r.outcome !== 'held').sort((x, y) => cost(y) - cost(x) || x.at - y.at);
  if (!raids.length) return null;
  const worst = raids[0], town = c.territories[worst.at].name, who = worst.name[0].toUpperCase() + worst.name.slice(1);
  const lines: string[] = [];
  for (const r of raids) {
    lines.push(reportLine(c, r));
    const goods = (['food', 'wood', 'gold', 'stone'] as const).filter((k) => r.stores[k] > 0).map((k) => `${r.stores[k]} ${k}`);
    if (goods.length || r.burnt) lines.push(`They took ${goods.length ? goods.join(', ') : 'nothing from the stores'}${r.burnt ? `, and burned the ${r.burnt}` : ''}.`);
    if (r.names.length) lines.push(`Among those carried off: ${r.names.join(', ')}.`);
    if (r.taken.men + r.taken.women) lines.push(`They can be got back for ${THREATS.holdFor} seasons, by breaking the band.`);
  }
  return { raids, band: (c.bands ?? []).find((b) => b.id === worst.band), title: raids.length > 1 ? `${raids.length} of your towns were struck` : `${who} ${worst.outcome === 'taken' ? 'sacked' : worst.kind === 'highwaymen' ? 'robbed the road at' : 'raided'} ${town}`, lines };
}
/** The season's strikes have been told. */
export function toldStrikes(c: Campaign): void { c.strikesTold = c.turn; }
