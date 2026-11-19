// The one who leads a claimant's rising, on the field (docs/DESIGN.md, "Claimants to the throne"; claimantrising.ts).
//
// A town risen for a claimant was only a line on the map: the lord who proclaimed a child, the band that holds its
// mother, or the grown claimant were names in the log, the chronicle and the land's panel. When the player fights
// there, the rising's leader is on the field by name:
//   - who: a grown claimant by their own name; a rising raised in a child's name, by whoever proclaimed it (the lord
//     by his title, or the chief of the band). The child is never a figure, never named here, never shown;
//   - in a battle there, one of the town's soldiers who came to it from no house of the town (one of those the land
//     turns out, not a townsman in arms: battlefolk.ts counts those back as the town's people) is that leader by name,
//     the rising's captain, a woman if the leader is one;
//   - where only townsmen in arms stand for it, the leader comes to the field with them, one more soldier before the
//     hall's door (with no span of a townsman's life, so never counted with the town), armed as the best of them are;
//   - where there is no hall at all, they stand nowhere and are told of nowhere (hallguests.ts shows them by name at the
//     hall of a town whose side has them but nobody to be them: a visit, should one ever be made to a risen town).
// The map hands the town's side the leader (`bonus.captain`, campaign.ts battleConfig); here it is set on the field.
// Nothing about the claim is changed by what befalls them: the claim and the rising are the map's.
import type { Campaign } from './campaign';
import type { Game, Unit } from './game';
import { claimantAt } from './claimantrising';

/** The leader of a rising, as the field takes them. */
export interface Captain { name: string; female: boolean }

declare module './game' {
  interface Player { /** The leader of the claimant's rising this side's town stands in, while no soldier on the field is them (claimantcaptain.ts). */ captain?: Captain }
  interface Unit { /** This soldier is the rising's leader, by name (claimantcaptain.ts). */ captain?: boolean }
}

const text = (v: unknown, n = 60): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');

/** Who leads the rising this land stands in, if it has risen for a claimant: never the child. */
export function captainOf(c: Campaign, tid: number): Captain | undefined {
  const cl = claimantAt(c, tid);
  if (!cl || cl.ended || !cl.towns?.includes(tid)) return undefined;
  if (cl.name) return { name: cl.name, female: !!cl.female };
  const by = cl.regent ?? '';
  if (!by) return undefined;
  if (cl.parent === 'band') return { name: `The chief of ${by}`, female: false };
  return { name: by, female: /^(lady|the lady)\b/i.test(by) };
}

/** What the map hands the town's side of a battle or a visit there: the leader, or nothing. */
export const captainBonus = (c: Campaign, tid: number): { captain?: Captain } => { const k = captainOf(c, tid); return k ? { captain: k } : {}; };

/**
 * As the field is laid out: one of this side's soldiers who is no townsman (the land's turn-out, the army's) becomes the
 * leader by name; failing one, the leader comes to the field before the hall's door; failing a hall, they are kept on the
 * side (`Player.captain`, hallguests.ts). Returns the soldier.
 */
export function setCaptain(g: Game, owner: number, captain: unknown): Unit | undefined {
  const k = captain as Partial<Captain> | undefined, name = text(k?.name);
  const p = g.players[owner];
  if (!p || !name) return undefined;
  const female = !!k?.female;
  const ranks = g.units.filter((u) => u.owner === owner && !u.dead && g.isMilitary(u) && !u.hero && !(u.lifespan > 0));
  let u = ranks.sort((a, b) => b.def.hp - a.def.hp || a.id - b.id)[0];
  if (!u) {
    // Only townsmen in arms stand for the town: the leader comes to the field with them, before the hall's door,
    // armed as the best of them are. Failing a hall, they stand at no hall and are told of at none.
    const hall = g.buildings.find((b) => b.owner === owner && !b.dead && b.type === 'towncenter');
    if (!hall) { p.captain = { name, female }; return undefined; }
    const best = g.units.filter((x) => x.owner === owner && !x.dead && g.isMilitary(x) && !x.hero).sort((a, b) => b.def.hp - a.def.hp)[0];
    u = g.spawnUnit(best?.type ?? g.trainedAs(owner, 'clubman'), owner, hall.x, hall.y + hall.size / 2 + 1);
  }
  u.name = name; u.family = ''; u.captain = true;
  if (female) u.gender = 'f'; // a soldier with no span of a townswoman's life is not counted with the town (battlefolk.ts)
  delete p.captain;
  return u;
}
