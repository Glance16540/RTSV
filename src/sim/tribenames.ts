/**
 * A tribe's people have names of their own (docs/PLAYTEST.md, 2.4). Everyone on a battlefield was named from one
 * list, so the end card of a battle with a local tribe read "Dunn, Wend, Marn, Marn, Marn": the player's own
 * towns' names, three times over. A side marked as a tribe (`PlayerSetup.tribe`; campaign.ts marks the locals)
 * draws from these lists instead, and no two of its people in one battle share a name while there is a name left
 * unused: the lot falls where it would have, and steps on to the next name free.
 */
export const TRIBE_NAMES_M = ['Arn', 'Bodo', 'Cael', 'Drust', 'Eben', 'Farl', 'Gorm', 'Hask', 'Ilar', 'Jorn', 'Kolb', 'Lug', 'Morn', 'Nar', 'Odd', 'Penn', 'Ruk', 'Skarn', 'Thol', 'Ulf', 'Varn', 'Wulk', 'Yorn', 'Zeb', 'Bran', 'Cuth', 'Dag', 'Erl', 'Fen', 'Garn', 'Hrod', 'Ket', 'Lorn', 'Mael', 'Nudd', 'Orm', 'Rask', 'Sig', 'Tor', 'Usk'];
export const TRIBE_NAMES_F = ['Aud', 'Birn', 'Cwen', 'Dalla', 'Ebba', 'Frid', 'Gerd', 'Hala', 'Inga', 'Jorid', 'Katla', 'Luta', 'Maeb', 'Nessa', 'Oda', 'Runa', 'Saba', 'Tova', 'Ula', 'Vigdis', 'Wilda', 'Yrsa', 'Asa', 'Bera', 'Dis', 'Edda', 'Fenna', 'Gyda', 'Hedda', 'Idun', 'Liv', 'Mista', 'Nanna', 'Osk', 'Reva', 'Signy', 'Thyra', 'Unn', 'Vala', 'Ylva'];

/** The name the lot falls on (`roll`, 0 up to 1), or the next one after it that nobody in `taken` has; if all are taken, the one it fell on. */
export function freeName(names: readonly string[], roll: number, taken: ReadonlySet<string>): string {
  const at = Math.min(names.length - 1, Math.floor(roll * names.length));
  for (let k = 0; k < names.length; k++) { const n = names[(at + k) % names.length]; if (!taken.has(n)) return n; }
  return names[at];
}
/** A tribesman's or tribeswoman's name: one of the tribe's own, and nobody else's of those already on its side. */
export const tribeName = (gender: string, roll: number, taken: ReadonlySet<string>): string => freeName(gender === 'm' ? TRIBE_NAMES_M : TRIBE_NAMES_F, roll, taken);
