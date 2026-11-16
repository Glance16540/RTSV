/**
 * The phases of a battle on the map, for systems to hang on (docs/PORTING.md: systems stay separate).
 * campaign.ts sets a battle up, settles it when nobody watches, and writes back what a battle fought in person
 * left. A dozen systems each have something to do at one of those moments: stores and faith are written down
 * before a town changes hands, a taken town resents it, the dead are counted to their towns and their houses.
 * Those were direct calls threaded through the three functions. Here each moment has a name, and a system is
 * registered for it once, in one table (campaign.ts, `BATTLE_HOOKS`), so the battle functions name no system.
 *
 * The order is the table's order and nothing else: hooks of one phase run in the order they were registered, and
 * the phases come where campaign.ts calls them. Nothing here decides anything; it only carries the calls.
 *
 *   setup      a battle is about to be laid out for play (battleConfig)
 *   settling   a battle is decided and no longer pending; nothing has changed hands yet (resolvePending)
 *   counted    the two armies are known and the town's toll is taken: what the victor felled can be counted
 *   taken      the attacker has won and the town is about to change hands
 *   repulsed   the attacker was thrown back
 *   settled    all of it is done, and whoever is beaten is gone from the map
 *   written    a battle fought in person has been settled and its field is being read back (finishBattle)
 *   housed     the town's people and stores are as that battle left them
 */
import type { Army, BattleAfter, Campaign, Pending } from './campaign';

export type BattlePhase = 'setup' | 'settling' | 'counted' | 'taken' | 'repulsed' | 'settled' | 'written' | 'housed';
export const BATTLE_PHASES: BattlePhase[] = ['setup', 'settling', 'counted', 'taken', 'repulsed', 'settled', 'written', 'housed'];
/** What a hook is told of the battle, besides the campaign and the pending record: plain data, filled in as the battle goes. */
export interface BattleNote {
  /** How it was settled: nobody watched, or it was fought and this side won. Absent while it is being set up. */
  how?: 'auto' | 'attacker' | 'defender';
  attackerWon?: boolean;
  /** Men of the town killed by rule in a battle nobody watched (township.ts). */
  toll?: number;
  /** The attacking army, and the army that stood in the land, as they were when the battle was settled. */
  army?: Army; defArmy?: Army;
  /** A battle fought in person: what the game handed back, as campaign.ts's BattleAfter has it, and whether the player's side won. */
  after?: BattleAfter; playerWon?: boolean;
  /** The town's people were read back from the field (not a field battle, not a camp). */
  census?: boolean;
}
export type BattleHook = (c: Campaign, p: Pending, b: BattleNote) => void;
export interface Registered { phase: BattlePhase; system: string; run: BattleHook }

/** A table of hooks: who is registered for which phase, in the order they will run. */
export class BattleHooks {
  private readonly table: Registered[] = [];
  /** Register a system for a phase. It runs after everything already registered for that phase. */
  on(phase: BattlePhase, system: string, run: BattleHook): this { this.table.push({ phase, system, run }); return this; }
  /** Run a phase: every hook registered for it, in order. */
  run(phase: BattlePhase, c: Campaign, p: Pending, b: BattleNote = {}): void { for (const h of this.table) if (h.phase === phase) h.run(c, p, b); }
  /** Who is registered for a phase, in the order they run: for a test, or for whoever ports the table. */
  order(phase?: BattlePhase): string[] { return this.table.filter((h) => !phase || h.phase === phase).map((h) => (phase ? h.system : `${h.phase}: ${h.system}`)); }
}
