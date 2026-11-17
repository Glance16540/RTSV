/**
 * The map's side of a soldier home inside one sitting (furlough.ts has the whole account, and the field's side).
 *
 *   - `furloughOf`: what the map hands the field as a battle for a town or a visit to it begins: the town's own
 *     men on the roll of the army standing there, each by the name his house's record has for him and at the age
 *     the roll keeps, and how many soldiers of each kind make a company.
 *   - `homeOnLeave`: when the sitting ends, each man who is home is taken off the army's roll and off his house's
 *     record of the away, and the army is a company of his kind the fewer. The door he came to on the field
 *     (leavehome.ts) is written on his house's record (`WarHouse.home`) and told in the chronicle. He is not added to the town's count
 *     here: the town is counted off the field as the player leaves it, and he was standing in it as a villager.
 *     It must run before the army's soldiers are counted back, so that his company is not taken for a loss.
 */
import type { Army, Campaign } from './campaign';
import { COMPANIES, armyAt, armySize } from './campaignbase';
import { GROWN_SEASON, LAST_SEASON } from './ageing';
import { musterOf } from './armytown';
import type { AwayMan, Door, Furlough, HomeMan } from './furlough';
import { companyOf } from './townmuster';
import { awayMen, cameToDoor, wentHome } from './warhouse';

const DOORS: Door[] = ['husband', 'son', 'own', 'none'];
/** How the chronicle tells the door he came to. */
const DOOR_WORDS: Record<Door, string> = { husband: 'under his own roof again', son: 'a son of his house again', own: 'under a roof of his own', none: 'with no roof of his own' };
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"]/g, '').slice(0, 40) : '');
/** How many soldiers of each kind make a company on the field. */
const perUnit = (): Record<string, number> => { const out: Record<string, number> = {}; for (const d of Object.values(COMPANIES)) for (const [u, n] of Object.entries(d.units)) out[u] = n; return out; };

/** The town's own men with the army of its people standing in it, for the field; nothing if there is no such army or none of them is of this town. */
export function furloughOf(c: Campaign, tid: number): Furlough | undefined {
  const t = c.territories[tid], a = armyAt(c, tid);
  if (!t || !a || a.owner !== t.owner) return undefined;
  const ages = [...(musterOf(c, a.id)?.men[tid] ?? [])].sort((x, y) => y - x); // the eldest first: he has been longest from his hearth
  if (!ages.length) return undefined;
  const named = awayMen(c, tid).filter((m) => m.army === a.id);
  const men: AwayMan[] = ages.map((seasons, i) => ({ name: named[i]?.name ?? `A man of ${t.name}`, ...(named[i]?.family ? { family: named[i].family } : {}), seasons }));
  return { men, per: perUnit() };
}

/** What came back from the field made safe: a list of men home, each of a kind that is a company. */
export function cleanHome(x: unknown): HomeMan[] {
  const out: HomeMan[] = [];
  if (!Array.isArray(x)) return out;
  for (const m of x) {
    if (!m || typeof m !== 'object') continue;
    const as = text((m as HomeMan).as), name = text((m as HomeMan).name), family = text((m as HomeMan).family), seasons = Math.round(Number((m as HomeMan).seasons));
    if (!as || !companyOf(as) || !name || !Number.isFinite(seasons)) continue;
    const door = DOORS.find((d) => d === (m as HomeMan).door);
    out.push({ as, name, ...(family ? { family } : {}), seasons: Math.max(GROWN_SEASON, Math.min(LAST_SEASON, seasons)), ...(door ? { door } : {}) });
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * The men home on leave as the sitting ended are home on the map: off the roll of the army standing in the town,
 * off their houses' records of the away, and the army a company the fewer for each. Never its last company with
 * the leader in it, and no more men than the roll has of this town. Returns how many are home.
 */
export function homeOnLeave(c: Campaign, tid: number, home: unknown): number {
  const t = c.territories[tid], a: Army | undefined = armyAt(c, tid), men = cleanHome(home);
  if (!t || !a || a.owner !== t.owner || !men.length) return 0;
  const m = musterOf(c, a.id), roll = m?.men[tid];
  let n = 0;
  for (const man of men) {
    if (!m || !roll?.length) break;
    const kind = companyOf(man.as)!;
    if (!(a.units[kind] > 0) || (a.hero && armySize(a) <= 1)) continue;
    // The man on the roll nearest his age is he.
    let at = 0;
    for (let i = 1; i < roll.length; i++) if (Math.abs(roll[i] - man.seasons) < Math.abs(roll[at] - man.seasons)) at = i;
    roll.splice(at, 1);
    if (--a.units[kind] <= 0) delete a.units[kind];
    const who = wentHome(c, tid, a.id, man.name, man.family);
    // The door he came to on the field is written on his house's record, so the map says what the field showed.
    const family = man.family || (who.startsWith(`${man.name} `) ? who.slice(man.name.length + 1) : '');
    if (man.door && family) cameToDoor(c, tid, man.name, family, man.door);
    c.log.push(`${man.name}${man.family ? ` ${man.family}` : ''} of ${t.name} left the army there and is home${man.door ? `, ${DOOR_WORDS[man.door]}` : ''}: it is a company of ${COMPANIES[kind].name.toLowerCase()} the fewer.`);
    n++;
  }
  if (m) { if (roll && !roll.length) delete m.men[tid]; m.size = armySize(a); }
  if (!armySize(a)) { c.armies.splice(c.armies.indexOf(a), 1); if (c.musters) delete c.musters[a.id]; }
  return n;
}
