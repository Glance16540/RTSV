// What the campaign screen says of a town's people and stores (src/sim/township.ts), and of the nation's added up.
import type { Campaign } from '../sim/campaign';
import { Stores, folkOf, headcount, living, nationNotables, nationPeople, nationStores } from '../sim/township';
import { virtueOf } from '../sim/campaign';
import { standingHtml, townFaces } from './portrait';
import { mourned, townGrief } from '../sim/notableweight';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const storesHtml = (s: Stores): string => `🍖 ${s.food} · 🪵 ${s.wood} · 🪙 ${s.gold} · 🪨 ${s.stone}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A town's people by kind; for a town of the player's, its stores and those it knows by name as well. */
export function townHtml(c: Campaign, tid: number, mine: boolean): string {
  const f = folkOf(c, tid);
  // The header shows the town's standing (its holder's morals) and the marks its people share; each notable's own
  // row shows how they are, in the town's present mood.
  const owner = c.territories[tid].owner, faces = townFaces(c, tid);
  const standing = owner >= 0 ? standingHtml(c.factions[owner]?.civ ?? '', virtueOf(c, owner)) : '';
  const people = `<div class="town-folk" title="The people of this town. They are who turns out when it is fought over, and whoever is lost then is gone.">👥 <b>${headcount(f)}</b> <small>${plural(f.men, 'man', 'men')} · ${plural(f.women, 'woman', 'women')} · ${f.elders} old · ${plural(f.children, 'child', 'children')}</small>${standing}${faces.marks}</div>`;
  if (!mine) return people;
  const names = living(f).map((n) => `<div class="town-notable likeness-row">${faces.notable(n)}${n.kind === 'veteran' ? '⚔️' : '🏠'} <b>${esc(n.name)}</b>${n.family ? ' ' + esc(n.family) : ''}, who ${esc(n.deed)}</div>`).join('');
  const gone = f.notables.filter((n) => n.lost).slice(-2).map((n) => `<div class="town-notable gone">✝ ${esc(n.name)}, who ${esc(n.deed)}: ${esc(n.lost!.how)}, turn ${n.lost!.turn}</div>`).join('');
  const grief = townGrief(f.notables, c.turn), dead = mourned(f.notables, c.turn);
  const mourning = grief > 0 ? `<div class="town-notable gone" title="A town grieves its known people for some seasons after they are lost.">🕯 The town mourns ${dead.slice(0, 2).map((n) => esc(n.name)).join(' and ')}${dead.length > 2 ? ' and others' : ''}</div>` : '';
  return `${people}${mourning}<div class="town-stores" title="What this town has in store. A battle fought here is fought out of it, and what is left afterwards is kept.">In store: ${storesHtml(f.stores)}</div>${names}${gone}`;
}

/** The nation: its people and its stores, town by town added up. */
export function nationHtml(c: Campaign): string {
  const p = nationPeople(c, 0), known = nationNotables(c, 0).length;
  return `<div class="hint town-nation" title="Your towns added together. The map still spends supplies; the towns' stores are what their battles are fought out of.">👥 <b>${p.all}</b> people <small>(${plural(p.men, 'man', 'men')}, ${plural(p.women, 'woman', 'women')}, ${p.elders} old, ${plural(p.children, 'child', 'children')}${known ? `; ${known} known by name` : ''})</small> · in store ${storesHtml(nationStores(c, 0))}</div>`;
}
