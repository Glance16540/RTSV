// Famine: what happens to a town that has run out of food.
//
// Nobody in this game eats day by day, so an empty store by itself means only that the town spends food as fast
// as it comes in. What is counted here is a store that stays bare: under FAMINE.bare for a whole stretch, which
// can only happen when next to nothing is coming in at all (fields blighted or never sown, the game hunted out,
// everyone at other work). One load carried home breaks the stretch.
//
//   after FAMINE.hungry seconds  the people go hungry: a warning, nothing more.
//   after FAMINE.starving        famine. One of the town is lost every FAMINE.toll seconds: the old first, then
//                                the children, then soldiers (who do not starve but walk away), then grown
//                                villagers, though never the last FAMINE.spare of those, so that a town can
//                                always work its way out. Leaders, ships and people inside buildings are let be.
//   after FAMINE.plague          sickness follows hunger: plague breaks out around the Town Center, as long and
//                                as hard as the people's creed makes it (never among the Righteous).
//
// It is over the moment the store is no longer bare. Only a people with a Town Center standing can be in famine:
// a war band that has not settled lives off the land, and the two armies of a field battle have no town at all.
import type { Building, Game, Player, Unit } from './game';

export const FAMINE = {
  /** A store under this much food is bare. */
  bare: 10,
  /** Seconds of a bare store before the people go hungry, and before they starve. */
  hungry: 60, starving: 120,
  /** In a famine, seconds between one loss and the next. */
  toll: 30,
  /** Grown villagers a famine never takes. */
  spare: 4,
  /** Seconds of a bare store before plague breaks out, how near the Town Center it strikes, and how long it lasts. */
  plague: 240, reach: 6, sick: 12,
};

export type Want = '' | 'hungry' | 'famine';

/** How a people stands for food. */
export function want(p: Player): Want {
  const h = p.hunger ?? 0;
  return h >= FAMINE.starving ? 'famine' : h >= FAMINE.hungry ? 'hungry' : '';
}

const tell = (g: Game, p: Player, text: string): void => { g.events.push({ t: 'msg', player: p.id, text }); };
const hall = (g: Game, owner: number): Building | undefined =>
  g.buildings.find((b) => !b.dead && b.owner === owner && b.type === 'towncenter' && b.complete);
const called = (u: Unit): string => u.name ? `${u.name}${u.family ? ' ' + u.family : ''}` : `A ${u.def.name.toLowerCase()}`;

/** Who a famine takes next from this people, or null if there is nobody it may take. */
export function nextLost(g: Game, owner: number): Unit | null {
  const mine = g.units.filter((u) => !u.dead && u.owner === owner && !u.inside && !u.def.naval && !u.hero && !u.def.aura);
  const folk = mine.filter((u) => u.type === 'villager');
  const oldest = (a: Unit, b: Unit): number => b.age - a.age || a.id - b.id;
  const old = folk.filter((u) => g.isElder(u)).sort(oldest);
  if (old.length) return old[0];
  const young = folk.filter((u) => u.growT > 0).sort((a, b) => b.growT - a.growT || a.id - b.id);
  if (young.length) return young[0];
  const men = mine.filter((u) => g.isMilitary(u)).sort((a, b) => a.id - b.id);
  if (men.length) return men[men.length - 1]; // the last to join is the first to go
  const grown = folk.filter((u) => u.growT <= 0).sort(oldest);
  return grown.length > FAMINE.spare ? grown[0] : null;
}

function sicken(g: Game, p: Player, at: Building): void {
  const c = g.creed(p.id);
  if (c.plague <= 0 || g.time - p.plagueAt < 180) return;
  let struck = 0;
  for (const u of g.units) {
    if (u.dead || u.owner !== p.id || u.inside || u.def.naval || Math.hypot(u.x - at.x, u.y - at.y) > FAMINE.reach) continue;
    u.plagueT = FAMINE.sick * c.plague;
    struck++;
  }
  if (!struck) return;
  p.plagueAt = g.time;
  g.events.push({ t: 'plague', x: at.x, y: at.y });
  tell(g, p, '☠️ Sickness has followed hunger: plague has broken out among your starving people!');
}

/** One second of it, for every people. Called from `calamity`. */
export function famine(g: Game): void {
  if (g.field) return;
  for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    const at = hall(g, p.id);
    if (!at || p.res.food >= FAMINE.bare) {
      if (want(p) === 'famine') tell(g, p, '🍞 There is food in the store again: the famine is over.');
      p.hunger = 0;
      continue;
    }
    const was = p.hunger ?? 0, now = (p.hunger = was + 1);
    if (was < FAMINE.hungry && now >= FAMINE.hungry)
      tell(g, p, '🍞 The stores are empty and nothing is coming in: your people are going hungry. Put villagers on food, or buy it at a Market, before they starve.');
    if (was < FAMINE.starving && now >= FAMINE.starving)
      tell(g, p, '💀 Famine! Your people are starving. The old and the young will go first, soldiers will walk away, and it will not stop until there is food in the store.');
    if (now >= FAMINE.starving && (now - FAMINE.starving) % FAMINE.toll === 0 && now > FAMINE.starving) {
      const u = nextLost(g, p.id);
      if (u) {
        const soldier = g.isMilitary(u);
        tell(g, p, soldier ? `Unfed, ${called(u).replace(/^A /, 'a ')} has walked away from your army.` : `${called(u)} has starved.`);
        p.starved = (p.starved ?? 0) + 1;
        g.perish(u);
      }
    }
    if (was < FAMINE.plague && now >= FAMINE.plague) sicken(g, p, at);
  }
}
