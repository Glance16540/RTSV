// Soldiers who make a name. Every soldier's kills are counted; one who has felled enough is known by name, and when
// the leader has fallen such a soldier can be raised on the shields to lead in their place. On the campaign map the
// best of them who lives through a battle is remembered with the army, and is the captain a succession can turn to.

import { NAMES_M } from './data';
import { HeroSpec, MAX_RANK } from './hero';

/** Foes a soldier must have felled to be known by name and fit to lead. */
export const CHAMPION_KILLS = 3;
/** A soldier remembered with an army on the campaign map: who they are, what they have done, and what they fight as. */
export interface Champion { name: string; kills: number; unit: string }

/** Only those who fight on foot or in the saddle can be raised: not engines, ships, beasts or holy men. */
export const canLead = (cls: string): boolean => cls === 'infantry' || cls === 'ranged' || cls === 'cavalry';
/** The veterancy a soldier's kills are worth when they take up the rule: a rank for every three. */
export const rankForKills = (kills: number): number => Math.max(0, Math.min(MAX_RANK, Math.floor(kills / CHAMPION_KILLS)));
/** The name a soldier is known by, fixed by who they are and not by chance. */
export const championName = (id: number): string => NAMES_M[Math.abs(id) % NAMES_M.length];
/** A soldier as a leader: strong in the arm, a Warlord, with a fighter's powers and no house behind them. */
export const championSpec = (name: string): HeroSpec => ({ name, female: false, calling: 'warlord', bent: 'strength', might: 3, guard: 2, vigour: 1, powers: [0, 1, 1], look: {} });
/** Make safe a champion handed back from a battle. */
export function cleanChampion(ch: Partial<Champion> | null | undefined): Champion | undefined {
  if (!ch || typeof ch !== 'object' || typeof ch.name !== 'string' || !ch.name) return undefined;
  return { name: ch.name.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, 40), kills: Math.max(0, Math.round(Number(ch.kills) || 0)), unit: typeof ch.unit === 'string' ? ch.unit.replace(/[<>&"`]/g, '').slice(0, 30) : 'soldier' };
}
