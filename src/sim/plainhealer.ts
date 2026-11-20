/**
 * Every town has a plain healer (docs/DESIGN.md, "Every town has a plain healer", the owner's word).
 *
 * Since the Prophet and the Shaman became a mirror pair (darkarts.ts) the Priest is the healer of the towns of
 * good standing and the Shaman of the low, and a town in the middle had neither: its army marched with nobody
 * to bind a wound. The Healer is every people's, at any standing: no faith, no calamities, and of no standing
 * at all, so nothing bars her. She mends slower than either (`UNITS.healer.heal` against the Shaman's and the
 * Priest's), and she does not cure plague: she binds wounds, and a plague-struck soldier she tends keeps his
 * sickness, which is still the Priest's and the Shaman's to lift (and the Church's, for the Faithful).
 *
 *   - `healerFor`: the healer a town's standing gives its army: a Priest in a town of good standing, a Shaman in
 *     one of low, the plain Healer in the middle. The computer keeps one or two of whichever it is (ai.ts).
 *   - `curesPlague`: whether this healer lifts plague from those she tends: every healer but the plain one.
 *   - `HEALERS`: the three, for whoever counts an army's healers.
 */
import type { Game } from './game';
import { UNITS } from './data';
import type { UnitDef } from './data';

/** The healers an army may keep: the plain one, and the two of standing. */
export const HEALERS = ['healer', 'shaman', 'priest'];
/** Of each kind, the most the computer keeps. */
export const HEALERS_KEPT = 2;

/** The healer this people's standing gives its army now. */
export function healerFor(g: Game, pid: number): 'priest' | 'shaman' | 'healer' {
  if (!g.creedBar(pid, UNITS.priest)) return 'priest';
  if (!g.creedBar(pid, UNITS.shaman)) return 'shaman';
  return 'healer';
}
/** Does this healer lift plague from those tended: every one but the plain Healer. */
export const curesPlague = (def: UnitDef): boolean => !!def.heal && def.id !== 'healer';
