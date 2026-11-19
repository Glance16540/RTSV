// A Market's caravan on the field (the board's Market row: "in a battle or a visit the Traders' markets still earn by
// rule, with nothing on the road; caravans run only on the campaign map"). In a campaign battle or visit at a town of
// the player's whose caravan is on the road this season (caravans.ts), the caravan is on the field too:
//   - FIELD_CARAVAN.setOff seconds in, a trade cart leaves the Market and walks to the field's edge, on the side its
//     partner town lies on the map; there it goes off the field for FIELD_CARAVAN.away seconds, and comes back the same
//     way with the gold the map's caravan brings (caravans.ts caravanWorth, less what a band took from it on the road);
//   - home at the Market, the gold is the town's;
//   - an enemy can catch it: a cart lost on the way out loses the trade, one lost on the way home loses the gold, and
//     where the enemy who caught it is near, the gold is theirs.
// For a Traders' town it stands in for the Traders' rule, which earned by itself every few seconds with nothing on the road.
//
// The map's figures stay what they were: the battle hands back how it went (`caravanOut`) and the campaign settles the
// season's caravan by it (`caravanFromField`): one home on the field has brought its gold into the town's stores (read
// back from the battle) and is not counted again when the season turns; one caught is robbed of all it carried; one still
// away when the battle ends comes home with the season, as before.
import { UNITS } from './data';
import type { Campaign } from './campaign';
import type { Game, Unit } from './game';
import { caravansOf } from './caravans';

declare module './data' {
  interface UnitDef {
    /** A trade cart (fieldcaravan.ts): carries a Market's caravan across the field; no soldier, and nobody orders it but its road. */
    cart?: boolean;
  }
}

/** The caravan a town's side brings into a battle: its map caravan's id, the partner's name and bearing, and the gold it brings. */
export interface FieldCaravan { id: number; to: string; angle: number; gold: number }
/** How it stands in the battle. */
export interface FieldCaravanState extends FieldCaravan { state: 'waiting' | 'out' | 'away' | 'back' | 'home' | 'caught'; t: number; cart?: number; edge?: { x: number; y: number }; /** Where its cart was last seen. */ at?: { x: number; y: number }; /** Who carried off its gold. */ takenBy?: number }

declare module './game' {
  interface Player {
    /** This side's Market caravan on the field (fieldcaravan.ts). */
    caravan?: FieldCaravanState;
  }
  interface PlayerSetup {
    /** The town's Market caravan, on the road this season (fieldcaravan.ts). */
    caravan?: FieldCaravan;
  }
}

export const FIELD_CARAVAN = {
  /** Seconds into the battle before the cart sets out, and seconds it is off the field trading. */
  setOff: 20, away: 90,
  /** Tiles from the field's side its road leaves by, and how near the Market or the edge counts as there. */
  margin: 2, reach: 3,
  /** How near an enemy must be to a cart caught on its way home to carry off its gold. */
  thief: 4,
};

// The trade cart: a mule team with its load, slow and lightly built, carrying nothing to fight with.
if (!UNITS.tradecart) {
  UNITS.tradecart = {
    ...UNITS.villager, id: 'tradecart', name: 'Trade caravan', icon: '🐪', desc: 'A Market\'s caravan on its road to the town it trades with. Catch it on its way home and its gold is yours.',
    cost: {}, time: 0, hp: 160, atk: 0, armor: 1, range: 0.5, speed: 1.9, pop: 0, cls: 'support', radius: 0.5, bonus: {}, cart: true,
  };
}

/** The caravan a town of a people brings onto the field: its map caravan on the road this season, if it has one. */
export function caravanAtField(c: Campaign, tid: number): FieldCaravan | undefined {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return undefined;
  const x = caravansOf(c, t.owner).find((y) => y.to === tid && y.cargo.gold > 0);
  if (!x) return undefined;
  const p = c.territories[x.from];
  return { id: x.id, to: p?.name ?? 'the market town', angle: Math.atan2((p?.y ?? t.y) - t.y, (p?.x ?? t.x + 1) - t.x), gold: x.cargo.gold };
}

/** The battle opens: this side's caravan is waiting at its Market. */
export function caravanSet(g: Game, pid: number, fc: FieldCaravan): void {
  g.players[pid].caravan = { ...fc, state: 'waiting', t: FIELD_CARAVAN.setOff };
}

const market = (g: Game, pid: number) => g.buildings.find((b) => b.owner === pid && b.type === 'market' && b.complete && !b.dead);
const cartOf = (g: Game, s: FieldCaravanState): Unit | undefined => { const u = s.cart ? g.entities.get(s.cart) : undefined; return u && u.kind === 'unit' && !u.dead ? u : undefined; };
/** Where its road leaves the field: from the Market toward its partner's side, FIELD_CARAVAN.margin tiles in from the edge. */
function edgeOf(g: Game, from: { x: number; y: number }, angle: number): { x: number; y: number } {
  const N = g.size, m = FIELD_CARAVAN.margin, dx = Math.cos(angle), dy = Math.sin(angle);
  const tx = dx > 0 ? (N - m - from.x) / dx : dx < 0 ? (m - from.x) / dx : Infinity, ty = dy > 0 ? (N - m - from.y) / dy : dy < 0 ? (m - from.y) / dy : Infinity;
  const k = Math.max(0, Math.min(tx, ty));
  return { x: Math.max(m, Math.min(N - m, from.x + dx * k)), y: Math.max(m, Math.min(N - m, from.y + dy * k)) };
}
const near = (u: Unit, p: { x: number; y: number }, r: number): boolean => Math.hypot(u.x - p.x, u.y - p.y) <= r;

/** A second of the caravans on the field. */
export function caravanSecond(g: Game): void {
  for (const p of g.players) {
    const s = p.caravan;
    if (!s || s.state === 'home' || s.state === 'caught') continue;
    s.t -= 1;
    const cart = cartOf(g, s), m = market(g, p.id);
    if (cart) s.at = { x: cart.x, y: cart.y };
    if (s.state === 'waiting') {
      if (s.t > 0 || !m) continue;
      const u = g.spawnUnit('tradecart', p.id, m.x, m.y + m.size / 2 + 0.8);
      s.cart = u.id; s.edge = edgeOf(g, m, s.angle); s.state = 'out';
      g.cmdMove(p.id, [u.id], s.edge.x, s.edge.y);
      g.msg(p.id, `🐪 The caravan sets out from the Market for ${s.to}.`);
    } else if (s.state === 'out' || s.state === 'back') {
      if (!cart) { caught(g, s, p.id); continue; }
      const goal = s.state === 'out' ? s.edge! : m ? { x: m.x, y: m.y } : null;
      if (!goal) continue;
      if (near(cart, goal, FIELD_CARAVAN.reach + (s.state === 'back' && m ? m.size / 2 : 0)) || (!cart.order && !cart.moving)) {
        if (s.state === 'out') { g.cmdDelete(p.id, [cart.id]); s.cart = undefined; s.state = 'away'; s.t = FIELD_CARAVAN.away; }
        else { g.cmdDelete(p.id, [cart.id]); s.cart = undefined; s.state = 'home'; p.res.gold += s.gold; p.stats.gathered += s.gold; g.msg(p.id, `🐪 The caravan is home from ${s.to} with ${s.gold} gold.`); }
      }
    } else if (s.state === 'away' && s.t <= 0) {
      const u = g.spawnUnit('tradecart', p.id, s.edge!.x, s.edge!.y);
      s.cart = u.id; s.state = 'back';
      if (m) g.cmdMove(p.id, [u.id], m.x, m.y + m.size / 2 + 0.8);
      g.msg(p.id, `🐪 The caravan is on its way home from ${s.to}.`);
    }
  }
}

/** The cart is lost: the trade on its way out, the gold on its way home, and that to the enemy who caught it if one is near. */
function caught(g: Game, s: FieldCaravanState, pid: number): void {
  const was = s.state, at = s.at ?? s.edge;
  s.state = 'caught'; s.cart = undefined;
  if (was === 'back' && at) {
    const foe = g.units.filter((u) => !u.dead && u.owner !== pid && u.owner !== g.wild && g.hostile(u.owner, pid) && Math.hypot(u.x - at.x, u.y - at.y) <= FIELD_CARAVAN.thief)
      .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y) || a.id - b.id)[0];
    if (foe) { s.takenBy = foe.owner; g.players[foe.owner].res.gold += s.gold; g.msg(foe.owner, `🐪 Your soldiers caught a caravan on its way home, with ${s.gold} gold.`); }
  }
  g.msg(pid, was === 'back' ? `🐪 The caravan was caught on its way home: its ${s.gold} gold is lost.` : '🐪 The caravan was caught on its way out: there is no trade this season.');
}

/** What the battle hands back of a side's caravan, for the campaign to settle the season's caravan by. */
export const caravanOut = (g: Game, pid: number): { id: number; state: FieldCaravanState['state']; gold: number } | undefined => {
  const s = g.players[pid]?.caravan;
  return s ? { id: s.id, state: s.state, gold: s.gold } : undefined;
};

/**
 * The battle is over: the season's caravan of this town is as the field left it. Home on the field, its gold is in the
 * town's stores already (read back from the battle), so it is not counted again; caught, it carries nothing home. Still
 * on the road or away, it comes home with the season as before. Returns what was done.
 */
export function caravanFromField(c: Campaign, tid: number, out: unknown): 'home' | 'caught' | '' {
  const o = out as { id?: number; state?: string } | undefined;
  if (!o || typeof o.id !== 'number') return '';
  const x = (c.caravans ?? []).find((y) => y.id === o.id && y.to === tid);
  if (!x) return '';
  if (o.state === 'home') { c.caravans = (c.caravans ?? []).filter((y) => y !== x); return 'home'; }
  if (o.state === 'caught') { x.cargo.gold = 0; if (x.owner === 0) c.log.push(`🐪 Your caravan to ${c.territories[x.from]?.name ?? 'the market'} was caught on the field at ${c.territories[tid].name}, and brings nothing home.`); return 'caught'; }
  return '';
}
