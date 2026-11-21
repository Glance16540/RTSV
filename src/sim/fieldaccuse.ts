// Seizing one of a killer's suspects on the field (docs/CLOSING.md: "a killer's suspects can be questioned there but not
// accused or seized"). In a visit to the town, or a battle for it (battlestory.ts), the player may accuse one of those
// spoken of in a killing and have them seized: a soldier of the player's must stand by them (ACCUSE.near tiles), and one
// may be seized a time in the town. What comes of it is the map's own rule for an accusation (intrigue.ts), told at once
// on the field as the town sees it:
//   - the guilty one confesses, and is held for the leader's judgement (killerseized.ts on the map; the town's Hall hears
//     it where one stands, hallcases.ts). Nobody is struck on the field: the unit stays where it is until the map judges;
//   - an innocent is let go when three swear where they were that night: spoken of no longer, and their household and
//     the town remember it (on the map: a resentful mark and the town's standing).
// It writes `seized` on the story, read back by `storyOut` (fieldstory.ts) and settled on the map (storyvisit.ts). Children
// are no units on the field and never suspects (fieldstory.ts): no child is ever accused or seized.
import type { Game, Unit } from './game';

export const ACCUSE = {
  /** Tiles a soldier of the player's may stand from one spoken of to seize them. */
  near: 3,
};

/** A soldier of the player's near enough to seize this villager, or undefined. */
export const seizerOf = (g: Game, owner: number, u: Unit): Unit | undefined =>
  g.units.find((x) => x.owner === owner && !x.dead && !x.inside && x.type !== 'villager' && x.type !== 'ship' && Math.hypot(x.x - u.x, x.y - u.y) <= ACCUSE.near);

/** Why this villager cannot be seized now, or '' if they can. */
export function accuseBar(g: Game, owner: number, u: Unit | undefined): string {
  const s = g.players[owner]?.story;
  if (!s || s.kind !== 'killer' || !u || u.owner !== owner || u.dead || u.suspect === undefined) return 'Nobody here is spoken of.';
  if (s.cleared.includes(u.suspect) || (s.out ?? []).includes(u.suspect)) return `${u.name} is spoken of no longer.`;
  if (s.seized !== undefined) return s.seized === s.culprit ? 'The killer is seized and held for your judgement.' : 'You have seized one of them in this town already. The rest must wait until you come again.';
  if (!seizerOf(g, owner, u)) return `Bring a soldier to ${u.name} to seize ${u.gender === 'f' ? 'her' : 'him'}.`;
  return '';
}

/** The player accuses one of those spoken of, and a soldier seizes them. Returns whether it was the killer, or null if it could not be done. */
export function cmdAccuse(g: Game, owner: number, uid: number): boolean | null {
  const s = g.players[owner]?.story, u = g.units.find((x) => x.id === uid);
  if (!s || accuseBar(g, owner, u)) return null;
  const i = u!.suspect!, p = s.people[i], they = u!.gender === 'f' ? 'she' : 'he', They = u!.gender === 'f' ? 'She' : 'He';
  s.seized = i;
  if (i === s.culprit) {
    g.msg(owner, `Your soldiers seize ${u!.name} ${u!.family} the ${p.trade}, and before the night is out ${they} confesses to the killings. ${They} is held for your judgement.`);
    return true;
  }
  (s.out ??= []).push(i);
  g.msg(owner, `Your soldiers seize ${u!.name} ${u!.family} the ${p.trade} before the whole town, but three swear where ${they} was that night, and ${they} is let go. ${They} is spoken of no longer, and the ${p.family || u!.name} household will not forget it.`);
  return false;
}
