/**
 * What a campaign battle or a visit says of itself before it begins and after it ends (docs/PLAYTEST.md, 2 and 3).
 *
 * Before: a battle out of the campaign, and a visit to a town, opened on the skirmish's rules ("train villagers",
 * "bring down your rivals' Town Centers"), which are not theirs. `briefingOf` says what this one is: what kind of
 * battle, whom the player leads, what winning means here, and that no villager is bought (birthonly.ts).
 *
 * After: the end card of a field battle showed a score chart with nothing on it and a table of noughts, and called
 * four tribesmen "your enemy in ruins". `Tally` counts the battle as it is fought: who each side began with, by
 * kind, who fell, and the fallen who had a name; `verdictOf` finds words the size of what happened.
 *
 * Plain data and words: nothing is drawn here.
 */
import { UNITS } from './data';
import type { Game } from './game';

export type BattleKind = 'field' | 'attack' | 'defend' | 'visit';
export interface Briefing { lead: string; sections: { title: string; text: string }[] }

const many = (n: number, one: string, more = `${one}s`): string => `${n} ${n === 1 ? one : more}`;
const plural = (name: string): string => (/(man|men)$/i.test(name) ? name.replace(/man$/i, 'men') : /s$/i.test(name) ? name : `${name}s`);
/** A side by kind, in words: "4 Clubmen, 2 Slingers and a leader". */
export function forceText(units: Record<string, number>): string {
  const parts = Object.entries(units).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, n]) => `${n} ${n === 1 ? UNITS[type]?.name ?? type : plural(UNITS[type]?.name ?? type)}`);
  if (!parts.length) return 'nobody';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** What the player is told before a campaign battle or a visit begins. */
export function briefingOf(o: { kind: BattleKind; mine: Record<string, number>; foes?: Record<string, number>; foe?: string; leader?: string; minutes?: number }): Briefing {
  const lead = o.kind === 'field' ? 'The armies have met in open country. There is nothing to build: destroy every enemy soldier. Whoever is left standing marches on.'
    : o.kind === 'attack' ? 'Your army has made camp before their town. Bring down their Town Center and keep them from raising another, and the land is yours.'
    : o.kind === 'defend' ? 'The enemy is at the gates of your town. Bring down their camp\'s Town Center and keep them from raising another, and the land stays yours.'
    : `No enemy is here. For up to ${o.minutes ?? 5} minutes the town is yours to order: build, set your people to work, see who lives in it. What stands when you leave stays on the map.`;
  const who = o.kind === 'visit'
    ? `The people of this town: ${forceText(o.mine)}.${o.leader ? ` ${o.leader} is here with them.` : ''}`
    : `${forceText(o.mine)}${o.leader ? `, led by ${o.leader}` : ', with no leader on the field'}. They are the companies you marched here on the map${o.kind === 'defend' ? ', and the people of the town' : ''}.`;
  const against = o.kind === 'visit' ? '' : `${o.foe ?? 'The enemy'}: ${forceText(o.foes ?? {})}${o.kind === 'field' ? '' : ', and whatever their town can raise'}.`;
  const win = o.kind === 'field' ? 'The battle is won when no enemy soldier is left on the field, and lost when none of yours is. There is no town here, and nothing to gather or build.'
    : o.kind === 'attack' ? 'The battle is won when their Town Center is down and they have not begun another within a minute and a half: the town is then yours on the map, as it stands. It is lost if your own camp falls the same way.'
    : o.kind === 'defend' ? 'The battle is won when the attackers\' Town Center is down and they have not begun another within a minute and a half. It is lost if yours falls the same way: the town is then theirs on the map.'
    : 'Nothing is won or lost here. Leave when you like; when the time is up you are taken back to the map.';
  const after = o.kind === 'visit' ? 'What you build, what your people gather, and where they work go back to the map with the town.'
    : 'Whoever of your soldiers lives is your army on the map afterwards; the fallen are their towns\' dead, and their houses are told.';
  const people = o.kind === 'field' ? 'No one is trained here: you fight with who you brought.'
    : 'No villager is bought at the Town Center here: a town has only the people born to it. A soldier is one of its men, trained. The nation\'s age is advanced on the map, not in a battle or a visit.';
  return {
    lead,
    sections: [
      { title: o.kind === 'visit' ? 'Who is here' : 'Who you lead', text: who },
      ...(against ? [{ title: 'Against you', text: against }] : []),
      { title: o.kind === 'visit' ? 'What this is' : 'What winning means', text: win },
      { title: 'People', text: people },
      { title: 'Afterwards', text: after },
    ],
  };
}

export interface SideTally { began: number; fell: number; left: number; /** By kind: [began, fell]. */ kinds: Record<string, [number, number]> }
/**
 * A battle counted as it is fought. Make one when the battle begins, call `watch` now and then (whoever arrives
 * later is counted from then), and `removed` for every unit taken off the field.
 */
export class Tally {
  private readonly known = new Map<number, { owner: number; type: string; name: string }>();
  private readonly sides = new Map<number, SideTally>();
  /** The fallen who had a name, by side, in the order they fell. */
  readonly named: { owner: number; name: string; type: string }[] = [];
  constructor(game: Game) { this.watch(game); }
  private side(owner: number): SideTally { let s = this.sides.get(owner); if (!s) this.sides.set(owner, (s = { began: 0, fell: 0, left: 0, kinds: {} })); return s; }
  /** Count whoever is on the field and not yet counted: soldiers only (a villager is not of the army). */
  watch(game: Game): void {
    for (const u of game.units) {
      if (u.dead || this.known.has(u.id) || game.players[u.owner]?.neutral || u.type === 'villager') continue;
      this.known.set(u.id, { owner: u.owner, type: u.type, name: u.family ? `${u.name} ${u.family}` : u.name });
      const s = this.side(u.owner);
      s.began++;
      (s.kinds[u.type] ??= [0, 0])[0]++;
    }
  }
  /** A unit is gone from the field. */
  removed(id: number): void {
    const k = this.known.get(id);
    if (!k) return;
    this.known.delete(id);
    const s = this.side(k.owner);
    s.fell++;
    (s.kinds[k.type] ??= [0, 0])[1]++;
    if (k.name) this.named.push({ owner: k.owner, name: k.name, type: k.type });
  }
  /** One side, or several counted together. */
  of(owners: number[]): SideTally {
    const out: SideTally = { began: 0, fell: 0, left: 0, kinds: {} };
    for (const o of owners) {
      const s = this.sides.get(o);
      if (!s) continue;
      out.began += s.began; out.fell += s.fell;
      for (const [k, [b, f]] of Object.entries(s.kinds)) { const x = (out.kinds[k] ??= [0, 0]); x[0] += b; x[1] += f; }
    }
    out.left = out.began - out.fell;
    return out;
  }
}

/** Words the size of what happened: `felled` of the enemy down, `lost` of the player's own, on a field or before a town. */
export function verdictOf(win: boolean, field: boolean, felled: number, lost: number, foe = 'the enemy'): string {
  const size = felled + lost;
  const what = size <= 12 ? 'A skirmish' : size <= 40 ? 'A battle' : 'A great battle';
  const cost = lost === 0 ? 'without the loss of a man' : `at the cost of ${many(lost, 'man', 'men')}`;
  if (win) {
    const tail = size <= 12 ? 'It will be remembered by those who were there.' : size <= 40 ? 'It will be told at home.' : 'Your people will tell this story for ages.';
    return field ? `${what} won ${cost}: ${many(felled, 'man', 'men')} of ${foe} ${felled === 1 ? 'is' : 'are'} down and the field is yours. ${tail}`
      : `${what} won ${cost}: the town is taken or held, and ${many(felled, 'man', 'men')} of ${foe} ${felled === 1 ? 'is' : 'are'} down. ${tail}`;
  }
  return field ? `${what} lost: ${many(lost, 'man', 'men')} of yours ${lost === 1 ? 'is' : 'are'} down, and ${foe} ${felled ? `lost ${felled}` : 'lost nobody'}. The field is theirs.`
    : `${what} lost: ${many(lost, 'man', 'men')} of yours ${lost === 1 ? 'is' : 'are'} down, and ${foe} ${felled ? `lost ${felled}` : 'lost nobody'}. The town is theirs.`;
}
