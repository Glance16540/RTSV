// What the campaign screen says of a town's people and stores (src/sim/township.ts), and of the nation's added up.
import type { Campaign } from '../sim/campaign';
import { Stores, folkOf, headcount, living, nationNotables, nationPeople, nationStores } from '../sim/township';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const storesHtml = (s: Stores): string => `🍖 ${s.food} · 🪵 ${s.wood} · 🪙 ${s.gold} · 🪨 ${s.stone}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A town's people by kind; for a town of the player's, its stores and those it knows by name as well. */
export function townHtml(c: Campaign, tid: number, mine: boolean): string {
  const f = folkOf(c, tid);
  const people = `<div class="town-folk" title="The people of this town. They are who turns out when it is fought over, and whoever is lost then is gone.">👥 <b>${headcount(f)}</b> <small>${plural(f.men, 'man', 'men')} · ${plural(f.women, 'woman', 'women')} · ${f.elders} old · ${plural(f.children, 'child', 'children')}</small></div>`;
  if (!mine) return people;
  const names = living(f).map((n) => `<div class="town-notable">${n.kind === 'veteran' ? '⚔️' : '🏠'} <b>${esc(n.name)}</b>${n.family ? ' ' + esc(n.family) : ''}, who ${esc(n.deed)}</div>`).join('');
  const gone = f.notables.filter((n) => n.lost).slice(-2).map((n) => `<div class="town-notable gone">✝ ${esc(n.name)}, who ${esc(n.deed)}: ${esc(n.lost!.how)}, turn ${n.lost!.turn}</div>`).join('');
  return `${people}<div class="town-stores" title="What this town has in store. A battle fought here is fought out of it, and what is left afterwards is kept.">In store: ${storesHtml(f.stores)}</div>${names}${gone}`;
}

/** The nation: its people and its stores, town by town added up. */
export function nationHtml(c: Campaign): string {
  const p = nationPeople(c, 0), known = nationNotables(c, 0).length;
  return `<div class="hint town-nation" title="Your towns added together. The map still spends supplies; the towns' stores are what their battles are fought out of.">👥 <b>${p.all}</b> people <small>(${plural(p.men, 'man', 'men')}, ${plural(p.women, 'woman', 'women')}, ${p.elders} old, ${plural(p.children, 'child', 'children')}${known ? `; ${known} known by name` : ''})</small> · in store ${storesHtml(nationStores(c, 0))}</div>`;
}
