// What the campaign screen says of a town's people and stores (src/sim/township.ts), and of the nation's added up.
import type { Campaign } from '../sim/campaign';
import { Stores, folkOf, headcount, living, nationNotables, nationPeople, nationStores } from '../sim/township';
import { creedOf } from '../sim/creed';
import { faithAt } from '../sim/townfaith';
import { resentOf, revoltChance } from '../sim/conquered';
import { awayFrom } from '../sim/armytown';
import { surplusOf, treasury } from '../sim/stores';
import { workText } from '../sim/workwords';
import { drillText } from '../sim/townmuster';
import { awayText } from '../sim/warhouse';
import { wantText } from '../sim/suitors';
import { unrestText } from '../sim/unrest';
import { standingHtml, townFaces } from './portrait';
import { mourned, townGrief } from '../sim/notableweight';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const storesHtml = (s: Stores): string => `🍖 ${s.food} · 🪵 ${s.wood} · 🪙 ${s.gold} · 🪨 ${s.stone}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Where this town stands in faith, how it takes being held if it was taken by force, and how many of its men are away with the armies. */
function stateHtml(c: Campaign, tid: number, mine: boolean): string {
  const t = c.territories[tid], v = faithAt(c, tid), creed = creedOf(v), away = awayFrom(c, tid), y = t.yoke;
  const faith = t.owner >= 0 ? `<div class="town-faith" title="This town's own standing between piety and decadence. Your people's standing is your towns' taken together.">${creed.icon} ${creed.name} <small>(${v > 0 ? 'piety ' + v : v < 0 ? 'decadence ' + -v : 'in the middle'})</small></div>` : '';
  const from = y ? (y.from < 0 ? 'the local tribes' : y.from === 0 ? 'you' : 'the ' + esc(c.factions[y.from]?.name ?? 'others')) : '';
  const yoke = y && !y.settled && t.owner >= 0 ? `<div class="town-yoke ${y.resent >= 50 ? 'bad' : 'hint'}" title="A town taken by force resents it. That eases every season, sooner with a Church, Farmland or your leader there, and under a pious people; a Tavern or a season of plague, famine, fire or raiders sets it back. Without an army in it a resentful town may rise.">😠 Taken from ${from} ${c.turn - y.since} ${c.turn - y.since === 1 ? 'season' : 'seasons'} ago: resentment ${Math.round(y.resent)}${mine ? ` · ${Math.round(revoltChance(c, tid) * 100)}% chance it rises this season` : ''}</div>` : '';
  const gone = away && mine ? `<div class="town-away hint" title="Men of this town with your armies. Those who fall are this town's dead; the rest come back when the army is sent home.">⚔️ ${plural(away, 'man', 'men')} of this town ${away === 1 ? 'is' : 'are'} away with the armies${awayText(c, tid) ? `: ${esc(awayText(c, tid))}` : ''}</div>` : '';
  const kept = mine ? `<div class="town-orders hint" title="A town left to itself carries on with the last orders you gave it in a battle or a visit. Its people work and eat every season, and a governor answers its wants out of the town's own stores: Farmland when food is short, a house when couples have no roof, a Fortress when it has been raided.">📜 ${esc(workText(c, tid))}${drillText(c, tid) ? ' ' + esc(drillText(c, tid)) : ''}</div>` : '';
  const want = mine && wantText(c, tid) ? `<div class="town-want hint">💍 ${esc(wantText(c, tid))}</div>` : '';
  const stir = mine && unrestText(c, tid) ? `<div class="town-stir hint" title="Unrest begins in a town by its own state. An army there, or your leader, keeps order when it comes to a head; otherwise the town rises.">🔥 ${esc(unrestText(c, tid))}</div>` : '';
  return faith + yoke + stir + gone + want + kept;
}

/** A town's people by kind; for a town of the player's, its stores and those it knows by name as well. */
export function townHtml(c: Campaign, tid: number, mine: boolean): string {
  const f = folkOf(c, tid);
  // The header shows the town's standing (its holder's morals) and the marks its people share; each notable's own
  // row shows how they are, in the town's present mood.
  const owner = c.territories[tid].owner, faces = townFaces(c, tid);
  const standing = owner >= 0 ? standingHtml(c.factions[owner]?.civ ?? '', faithAt(c, tid)) : '';
  const people = `<div class="town-folk" title="The people of this town. They are who turns out when it is fought over, and whoever is lost then is gone.">👥 <b>${headcount(f)}</b> <small>${plural(f.men, 'man', 'men')} · ${plural(f.women, 'woman', 'women')} · ${f.elders} old · ${plural(f.children, 'child', 'children')}</small>${standing}${faces.marks}</div>`;
  const state = stateHtml(c, tid, mine);
  if (!mine) return people + state;
  const names = living(f).map((n) => `<div class="town-notable likeness-row">${faces.notable(n)}<span>${n.kind === 'veteran' ? '⚔️' : '🏠'} <b>${esc(n.name)}</b>${n.family ? ' ' + esc(n.family) : ''}, who ${esc(n.deed)}</span></div>`).join('');
  const gone = f.notables.filter((n) => n.lost).slice(-2).map((n) => `<div class="town-notable gone">✝ ${esc(n.name)}, who ${esc(n.deed)}: ${esc(n.lost!.how)}, turn ${n.lost!.turn}</div>`).join('');
  const grief = townGrief(f.notables, c.turn), dead = mourned(f.notables, c.turn);
  const mourning = grief > 0 ? `<div class="town-notable gone" title="A town grieves its known people for some seasons after they are lost.">🕯 The town mourns ${dead.slice(0, 2).map((n) => esc(n.name)).join(' and ')}${dead.length > 2 ? ' and others' : ''}</div>` : '';
  return `${people}${state}${mourning}<div class="town-stores" title="${surplusOf(c, tid) >= 0 ? `${surplusOf(c, tid)} of this is above the town's working stock and yours to spend on the map. ` : `This town is ${-surplusOf(c, tid)} short of its working stock. `}What this town has in store. A battle fought here is fought out of it, and what is left afterwards is kept.">In store: ${storesHtml(f.stores)}</div>${names}${gone}`;
}

/** The nation: its people and its stores, town by town added up. */
export function nationHtml(c: Campaign): string {
  const p = nationPeople(c, 0), known = nationNotables(c, 0).length, purse = treasury(c, 0);
  const short = purse.short ? ` · <b class="bad">${purse.short} short of your towns' working stock: income goes to make it good first</b>` : '';
  return `<div class="hint town-nation" title="Your towns added together. What they hold above their working stock is yours to spend on the map: a hundred of goods is one supply. What a town gathers or spends when you fight or visit there is your gain or loss.">👥 <b>${p.all}</b> people <small>(${plural(p.men, 'man', 'men')}, ${plural(p.women, 'woman', 'women')}, ${p.elders} old, ${plural(p.children, 'child', 'children')}${known ? `; ${known} known by name` : ''})</small> · in store ${storesHtml(nationStores(c, 0))}${short}</div>`;
}
