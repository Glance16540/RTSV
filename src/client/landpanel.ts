// The map's side panel, drawn: the nation in a compact bar at the top (the rest of it folded under "Your nation"),
// then the land selected, leading with what matters (its name and holder, its people and stores, what threatens it,
// the army there), then what can be done there in groups, and last the lie of the land folded under "The land".
// Nothing here decides anything: overworld.ts keeps the logic and the clicks (every button keeps its `data-act`).
import { levyLine } from '../sim/levynext'; // who a levy would take (levynext.ts)
import { landTalesHtml } from './talepanel';
import { lastGain } from '../sim/seasongain';
import { ruinWarning } from '../sim/ruin';
import { creedOf } from '../sim/creed';
import { PLACES, WORLD_EVENTS } from '../sim/story';
import { WORKS, canOpen, countryOf, countryYield } from '../sim/country';
import { nationHtml, townHtml } from './townpanel';
import { marketLine } from './caravandraw';
import { emptyingText, emptyingTowns } from '../sim/larderwatch';
import { canSendHome, menOf, noMenText } from '../sim/armytown';
import { bandButtons, threatHtml } from './threatpanel';
import { intrigueButtons, intrigueHtml } from './intriguepanel';
import { orderHtml } from './orderpanel';
import { freeTownButtons, risenFor } from './freetown';
import { AGES, CIVS, styleOf } from '../sim/data';
import {
  EVENTS, WEATHER, eventsAt, weatherAt, Army, FAITH, familyOf, faithOf, virtueOf, placeAt, worldNow, hireOff, virtueDrift, BARRIERS, BIOMES, biomeOf, CAMPAIGN_EDGE, COMPANIES, Campaign, LOCALS,
  ALLIANCE_COST, DOMINION_TURNS, canAlly, canGift, giftCost, truceCost, MAX_FAVOR, MAX_VETERAN, SITES, AGE_COST, AGE_EDGE, ageCost, ageOf, atTruce, armyAt, armyStrength,
  canAdvance, canBuild, canRaise, canSummonHero, defence, dominionNeed, heroCost, landOf, income, slots, territoryIncome, companyCost, siteCost, traitOf, BEATS, WORLD_SHAPES, worldOf, lanesOf, onSea, heroFor,
} from '../sim/campaign';
import { comesOfAge, houseOf, ofAge, rulerName } from '../sim/dynasty';
import { called, courtOf, leaderReach } from '../sim/court';
import { visitButton } from './visit';
import { peopleName } from '../sim/naming';
import { convoyHtml } from './convoypanel';
import { priceOf, priceText } from '../sim/prices';
import { decreePanel } from './decrees';
import { raisePanel, studyPanel } from './townworks';
import { siteLook } from '../sim/faithhouse';
import { inTime } from '../sim/inyears';
import { nextAgeText } from '../sim/nextage';
import { emptyWords } from '../sim/founding';
import { settleReach } from '../sim/migration';

const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---- Folds that stay as the player left them ----

/** The browser's storage key: it keeps the game's old name, as every saved key does. */
const FOLDS_KEY = 'rtsv-panel-folds';
type Fold = 'nation' | 'land';
let folds: Partial<Record<Fold, boolean>> | null = null;
const readFolds = (): Partial<Record<Fold, boolean>> => {
  if (folds) return folds;
  try { folds = JSON.parse(localStorage.getItem(FOLDS_KEY) ?? '{}') ?? {}; } catch { folds = {}; }
  return folds!;
};
let wired = false;
/** Remember a fold opened or closed, whichever panel it is in. Listened for once, on the whole page. */
function wire(): void {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  document.addEventListener('toggle', (e) => {
    const el = e.target as HTMLElement;
    const key = el?.dataset?.fold as Fold | undefined;
    if (!key) return;
    readFolds()[key] = (el as HTMLDetailsElement).open;
    try { localStorage.setItem(FOLDS_KEY, JSON.stringify(folds)); } catch { /* storage unavailable */ }
  }, true);
}
/** A fold, closed unless the player left it open. */
const fold = (key: Fold, title: string, body: string): string =>
  body ? `<details class="lp-fold" data-fold="${key}"${readFolds()[key] ? ' open' : ''}><summary>${title}</summary>${body}</details>` : '';

// ---- The nation ----

/** The nation's bar: the turn, what there is to spend, the peoples, and how near anyone is to winning; the rest folded. */
export function nationBar(c: Campaign): string {
  wire();
  const me = c.factions[0];
  const creed = creedOf(virtueOf(c, 0));
  const peoples = '<div class="ow-factions">' + c.factions.map((f) => `<span style="color:${css(f.color)}${f.alive ? '' : ';text-decoration:line-through'}">■ ${f.id === 0 ? peopleName(c, 0) + ' (you)' : f.name} ${c.territories.filter((x) => x.owner === f.id).length}${ageOf(c, f.id) ? ` <small>${AGES[ageOf(c, f.id)].name}</small>` : ''}${f.alive && creedOf(virtueOf(c, f.id)).id !== 'temperate' ? ` <small title="${creedOf(virtueOf(c, f.id)).name}. ${FAITH[creedOf(virtueOf(c, f.id)).id].desc}">${creedOf(virtueOf(c, f.id)).icon}</small>` : ''}${f.isAI ? ` <small>${rulerName(c, f.id)}${c.ally === f.id ? ' 🤝' : atTruce(c, 0, f.id) ? ' 🕊️' : ''}</small>` : ''}</span>`).join('') + '</div>';
  const under = c.dominion.f >= 0 && landOf(c, c.dominion.f) < dominionNeed(c); // under the share this season: the count is falling, not gone (dominion.ts)
  const hold = c.dominion.f >= 0 ? ` <b class="${c.dominion.f === 0 ? 'good' : 'bad'}" title="Held for ${c.dominion.turns} of the ${DOMINION_TURNS} turns that decide it. A season under that share takes two turns off the count.">👑 ${c.dominion.f === 0 ? (under ? 'You held' : 'You hold') : c.factions[c.dominion.f].name + (under ? ' held' : ' hold')} most of the land: ${c.dominion.turns}/${DOMINION_TURNS}${under ? ' and falling' : ''}</b>` : '';
  const top = `<div class="lp-bar"><b>Turn ${c.turn}</b><span title="What your towns hold in store above their working stock, counted in supplies (a hundred of goods each). What a season adds is the lands' yield (${income(c, 0)}) less what the towns eat, what spoils, the upkeep and what the governors build out of the stores.">To spend <b>${me.supplies}</b> <small>supplies (${gainWords(c)})</small></span>${hold}</div>` + peoples +
    (ruinWarning(c) ? `<div class="hint bad lp-ruin">🏚️ ${ruinWarning(c)}</div>` : '') +
    (c.request && c.ally >= 0 ? `<div class="hint">📣 ${c.factions[c.ally].name} ask you to take land from ${c.factions[c.request.foe].name} before turn ${c.request.until}.</div>` : '');
  const world = worldNow(c) ? WORLD_EVENTS[worldNow(c) as keyof typeof WORLD_EVENTS] : null;
  const rest = nationHtml(c) +
    `<div class="hint">${CIVS[me.civ].icon} ${CAMPAIGN_EDGE[me.civ]}</div>` +
    `<div class="hint">${creed.icon} Your people are <b>${creed.name}</b> <small>(${virtueOf(c, 0) > 0 ? 'piety ' + virtueOf(c, 0) : virtueOf(c, 0) < 0 ? 'decadence ' + -virtueOf(c, 0) : 'in the middle'}${virtueDrift(c, 0) ? `, ${virtueDrift(c, 0) > 0 ? 'growing more pious' : 'growing more decadent'} by ${Math.abs(virtueDrift(c, 0))} a turn` : ''})</small>. ${FAITH[creed.id].desc} Your towns begin each battle as they stand here.</div>` +
    (world ? `<div class="hint">${world.icon} <b>${world.name}.</b> ${world.desc} <small>(${c.world!.until - c.turn + 1} turns left)</small></div>` : '') +
    `<div class="hint">🌍 ${WORLD_SHAPES[worldOf(c.seed).shape]}; ${worldOf(c.seed).temper}.</div>` +
    `<div class="hint">👑 Win by taking every land, or by holding ${dominionNeed(c)} of the lands with people on them for ${DOMINION_TURNS} turns <small>(you hold ${landOf(c, 0)}; a season under that takes two turns off the count)</small>.` +
    (c.dominion.f >= 0 ? ` <b class="${c.dominion.f === 0 ? 'good' : 'bad'}">${c.dominion.f === 0 ? 'You have' : c.factions[c.dominion.f].name + ' have'} held it for ${c.dominion.turns}.</b>` : '') + '</div>';
  // The title of the fold says what is in it at a glance: the creed, and a world event if there is one.
  return top + fold('nation', `Your nation <small>${creed.icon} ${creed.name}${world ? ` · ${world.icon} ${world.name}` : ''}</small>`, rest);
}

// ---- The land ----

/** The land selected: what matters first, the lie of the land folded at the end. */
export function landHtml(c: Campaign, sel: number, canMarch: boolean): string {
  wire();
  const t = c.territories[sel], a = armyAt(c, sel);
  const empty = emptyWords(c, t.id); // wilderness or an empty land: nobody to rule, nothing to march on (founding.ts)
  const owner = empty ? { name: `${empty.icon} ${empty.name}`, color: LOCALS.color } : t.owner < 0 ? (risenFor(c, t.id) ? { name: `👑 ${risenFor(c, t.id)}`, color: LOCALS.color } : LOCALS) : c.factions[t.owner];
  const troops = (army: Army) => Object.entries(army.units).map(([k, n]) => `${COMPANIES[k].icon} ${n} ${COMPANIES[k].name.toLowerCase()}`).join(' · ') + (army.hero ? ` · ♛ ${heroFor(c, army.owner).name}` : '') + (army.vet ? ` · veterans ${'★'.repeat(army.vet)}${'☆'.repeat(MAX_VETERAN - army.vet)}` : '');
  const events = eventsAt(c, t.id), weather = weatherAt(c, t.id), place = placeAt(c, t.id);
  // What is going on in the land, as signs beside its name: the whole of each is under "The land".
  const signs = [...(weather ? [`<span title="${WEATHER[weather as 'rain'].name}">${WEATHER[weather as 'rain'].icon}</span>`] : []), ...events.map((e) => `<span title="${EVENTS[e.kind].name}">${EVENTS[e.kind].icon}</span>`)].join('');
  const head = `<h3>${t.name}${t.capital >= 0 ? ' ★' : ''}${signs ? ` <small class="lp-signs">${signs}</small>` : ''}</h3>
      <div style="color:${css(owner.color)}">${owner.name}</div>
      ${empty ? '' : `<div>Income ${territoryIncome(t, t.owner >= 0 ? c.factions[t.owner].civ : '') + countryYield(c, t.id) + (t.owner >= 0 && t.buildings.includes('tavern') ? faithOf(c, t.owner).tavern : 0)} · <span title="What an army marching on this town would meet. Against a band the town musters differently: see below.">Defence against an army ${defence(c, t.id)}</span></div>`}${empty ? `<div class="hint">${empty.desc}${settleReach(c, 0, t.id) ? ` ${settleReach(c, 0, t.id)}` : ''}</div>` : ''}`;
  const people = `${t.horde && t.owner < 0 ? '' : townHtml(c, t.id, t.owner === 0)}
      <div>${t.buildings.map((b) => { const l = siteLook(b, SITES[b], c.factions[t.owner]?.civ); return `${l.icon} ${l.name}`; }).join(' · ') || 'No buildings'} <small>(${t.buildings.length}/${slots(t)})</small></div>`;
  const emptying = t.owner === 0 ? emptyingTowns(c, 0).filter((x) => x.at === t.id).map((x) => `<div class="bad">🌾 ${emptyingText(x)}</div>`).join('') : ''; // its granary emptying soon (larderwatch.ts)
  const danger = `${emptying}${intrigueHtml(c, t.id)}${orderHtml(c, t.id)}${threatHtml(c, t.id)}
      ${t.horde && t.owner < 0 ? `<div class="bad">🏴 <b>Marauders hold this land.</b> ${EVENTS.horde.desc}</div>` : ''}
      ${t.trait === 'coast' && t.owner === 0 && c.territories.some((x) => x.owner > 0 && x.buildings.includes('harbour') && !atTruce(c, 0, x.owner)) ? `<div class="bad">⚓ Within reach of ${[...new Set(c.territories.filter((x) => x.owner > 0 && x.buildings.includes('harbour') && !atTruce(c, 0, x.owner)).map((x) => c.factions[x.owner].name))].join(' and ')} by sea.</div>` : ''}`;
  const fought = landTalesHtml(c, t.id); // the battles fought here (talepanel.ts)
  const army = `${a ? `<div class="ow-army"><b>Army, strength ${armyStrength(a, c)}</b>${a.moved && a.owner === 0 ? ' <small>has moved</small>' : ''}<br>${troops(a)}</div>` : t.owner < 0 && !empty ? `<div>${t.militia} bands of local warriors</div>` : ''}
      <div class="hint">${canMarch ? 'Click a neighbouring territory to march there.' : t.owner === 0 || empty ? '' : 'Select one of your armies to march on this land.'}</div>`;
  const land = `<div class="hint">${BIOMES[biomeOf(c, t.id)].icon} ${BIOMES[biomeOf(c, t.id)].name}: ${BIOMES[biomeOf(c, t.id)].desc} <i>${countryOf(c, t.id).rule}</i></div>
      ${lanesOf(c, t.id).map((n) => `<div class="hint">⛵ Sea crossing to ${c.territories[n].name}${t.buildings.includes('harbour') ? '' : t.owner === 0 ? ': build a Harbour here to make it' : ': made from a Harbour'}.</div>`).join('')}
      ${(c.barriers ?? []).filter((w) => w.a === t.id || w.b === t.id).map((w) => `<div class="hint">${BARRIERS[w.kind].icon} No march to ${c.territories[w.a === t.id ? w.b : w.a].name}: ${BARRIERS[w.kind].by} lie${w.kind === 'mountains' ? '' : 's'} between${w.kind !== 'water' ? `. ${cap(WORKS[w.kind].name)} would open it (${WORKS[w.kind].cost} supplies, built from either side)` : ''}.</div>`).join('')}
      ${(c.works ?? []).filter((w) => w.a === t.id || w.b === t.id).map((w) => `<div class="hint">${WORKS[w.kind as 'river'].icon} ${cap(WORKS[w.kind as 'river'].name)} leads to ${c.territories[w.a === t.id ? w.b : w.a].name}.</div>`).join('')}
      ${t.trait ? `<div class="good">${traitOf(t.trait)!.icon} ${traitOf(t.trait)!.name}: ${traitOf(t.trait)!.desc}</div>` : ''}
      ${place ? `<div class="hint">${PLACES[place.kind].icon} <b>${cap(place.name)}.</b> ${place.legend} <i>${PLACES[place.kind].desc}</i></div>` : ''}
      ${weather ? `<div class="bad">${WEATHER[weather as 'rain'].icon} ${WEATHER[weather as 'rain'].name}: ${WEATHER[weather as 'rain'].desc}</div>` : ''}
      ${events.map((e) => `<div class="hint">${EVENTS[e.kind].icon} <b>${EVENTS[e.kind].name}</b>${e.until > c.turn ? ` <small>(${e.until - c.turn + 1} turns left)</small>` : e.kind === 'unrest' || e.kind === 'hoard' ? ' <small>(comes to a head next turn)</small>' : ''}: ${EVENTS[e.kind].desc}</div>`).join('')}
      ${t.town?.b.length && !t.town.coarse ? `<div class="hint">🏘️ A town of ${t.town.b.length} building${t.town.b.length > 1 ? 's' : ''} stands on this ground from the last battle${t.town.b.some((b) => b[3] !== undefined && b[4] === undefined) ? `, ${t.town.b.filter((b) => b[3] !== undefined && b[4] === undefined).length} of them damaged and being mended, a tenth each turn` : ''}${t.town.b.some((b) => b[4] !== undefined) ? `, ${t.town.b.filter((b) => b[4] !== undefined).length} left unfinished` : ''}${t.owner >= 0 && !styleOf(c.factions[t.owner].civ).raid && !t.town.b.some((b) => b[0] === 'towncenter') ? '. Its Town Center was razed and has not been raised again' : ''}. Whoever holds the land fights from it as it stands.</div>` : t.owner === 0 && t.buildings.some((b) => b !== 'fortress') ? '<div class="hint">🏘️ What is built here stands in the town when this land is fought over, and what you build in a siege you win stays.</div>' : ''}
      ${t.owner === 0 ? marketLine(c, t.id) : ''}
      ${t.ground && t.ground.gone.length + t.ground.left.length ? '<div class="hint">🪓 This ground has been worked: wood felled, berries picked or stone dug. None of it comes back.</div>' : ''}`;
  const landTitle = `The land <small>${BIOMES[biomeOf(c, t.id)].icon} ${BIOMES[biomeOf(c, t.id)].name}${t.trait ? ` · ${traitOf(t.trait)!.icon} ${traitOf(t.trait)!.name}` : ''}${place ? ` · ${PLACES[place.kind].icon}` : ''}</small>`;
  return `${head}<div class="lp-section">${people}</div>${danger.trim() ? `<div class="lp-section">${danger}</div>` : ''}<div class="lp-section">${army}${fought}</div>${fold('land', landTitle, land)}`;
}

/** What can be done in the land selected, in groups: Raise, Build, Leader, Town, Diplomacy, and the age. Every button keeps its `data-act`. */
export function actionsHtml(c: Campaign, sel: number): string {
  const me = c.factions[0], t = c.territories[sel], a = armyAt(c, sel);
  const btn = (act: string, label: string, cost: number, ok: boolean, tip = '') => `<button data-act="${act}" title="${tip}" ${ok && c.phase === 'player' ? '' : 'disabled'}>${label} <small>${cost}</small></button>`;
  const group = (title: string, html: string, why = ''): string => (html ? `<div class="lp-group"><h4>${title}</h4>${why ? `<div class="hint lp-why">${why}</div>` : ''}${html}</div>` : '');
  let raise = '', works = '', studies = '', build = '', leader = '', town = '', talk = '', age = '';
  if (t.owner === 0) {
    for (const [k, d] of Object.entries(COMPANIES)) if (t.buildings.includes(d.needs) && (!d.civ || d.civ === me.civ)) raise += btn('raise:' + k, `${d.icon} Raise ${d.name.toLowerCase()}`, companyCost(t, k, me.civ, hireOff(c, 0, t.id)), canRaise(c, 0, t.id, k), `${noMenText(c, 0, t.id) ? noMenText(c, 0, t.id) + ' ' : ''}${levyLine(c, t.id) ? levyLine(c, t.id) + ' ' : ''}${d.civ ? `Your people's own soldiers, fighting as ${d.base}${(d.age ?? 0) > ageOf(c, 0) ? `, from the ${AGES[d.age ?? 0].name}` : ''}. ` : ''}Strength ${d.str}. Strong against ${BEATS[familyOf(k)]}. Paid in ${priceText(priceOf(familyOf(k) === 'cavalry' ? 'cavalry' : 'company', companyCost(t, k, me.civ, hireOff(c, 0, t.id))))}.`);
    if (raise && noMenText(c, 0, t.id)) raise += `<p class="lp-note">${noMenText(c, 0, t.id)}</p>`;
    if (a && a.owner === 0) { const men = menOf(c, a); raise += `<button data-act="home" title="The army is no more. Its ${men.town} ${men.town === 1 ? 'man' : 'men'} of your towns ${men.town === 1 ? 'goes' : 'go'} back onto ${men.town === 1 ? 'his town\'s record' : 'their towns\' records'}${men.none ? `; ${men.none} of no town are paid off` : ''}. Not with your leader in it." ${canSendHome(c, a.id) && c.phase === 'player' ? '' : 'disabled'}>🏠 Send the army home</button>`; }
    if (ageOf(c, 0) < AGE_COST.length) age += btn('age', `⏳ Advance to the ${AGES[ageOf(c, 0) + 1].name}`, ageCost(c, 0), canAdvance(c, 0), `All your armies grow ${Math.round(AGE_EDGE * 100)}% stronger, and your battles begin in that age with its weapons.`);
    if (ageOf(c, 0) < AGE_COST.length && nextAgeText(c, 0, ageCost(c, 0))) age += `<div class="hint">${nextAgeText(c, 0, ageCost(c, 0))}</div>`; // what saving for it opens (nextage.ts)
    const court = courtOf(c, 0);
    if (court && court.at === t.id) {
      const away = called(c, 0).length;
      leader += `<div class="hint">♛ ${heroFor(c, 0).name} is here${a ? ', at the head of this army' : ', in the town'}. No unrest rises where your leader is, and they fight only in battles fought here${a && !court.holds ? ' or where this army marches' : ''}.${court.rally ? ` The armies are called: ${away} still on the way.` : ''}</div>`;
      if (court.rally) leader += `<button data-act="endcall" ${c.phase === 'player' ? '' : 'disabled'} title="The armies stay where they have got to.">♛ End the call</button>`;
      else leader += `<button data-act="call" ${c.phase === 'player' && away ? '' : 'disabled'} title="Every army of yours marches a land nearer each turn, through your own country, until all have come or you end the call. Lands they leave have no garrison.">♛ Call the armies here</button>`;
      leader += `<button data-act="hold:${court.holds ? 0 : 1}" ${c.phase === 'player' ? '' : 'disabled'} title="${court.holds ? 'They ride with the army here when it marches.' : 'An army that marches out of this land goes without them.'}">♛ ${court.holds ? 'Ride with the army' : 'Keep to the town'}</button>`;
    } else if (court) {
      const can = leaderReach(c, 0).includes(t.id);
      leader += `<button data-act="lead" ${can && c.phase === 'player' ? '' : 'disabled'} title="${can ? 'They travel here alone, leaving any army where it is. Once a turn.' : court.moved ? 'They have travelled already this turn.' : `They are in ${c.territories[court.at]?.name ?? 'the field'}: only a neighbouring land of yours can be reached in a turn.`}">♛ Bring ${heroFor(c, 0).name} here</button>`;
    }
    if (!me.heroAlive) leader += `<button data-act="succession" ${c.phase === 'player' ? '' : 'disabled'}>♛ Choose who leads</button>`;
    if (t.capital === 0 && !me.heroAlive) leader += btn('hero', '♛ Hire a stranger to lead', heroCost(me.civ), canSummonHero(c, 0, t.id), 'Needs an army in your capital. Ends the old house.');
    if (t.capital === 0) leader += `<div class="hint">♛ ${me.heroAlive ? heroFor(c, 0).name : 'No one leads'}. ${houseOf(c, 0).heirs.length ? 'Heirs: ' + houseOf(c, 0).heirs.map((h) => `${h.name} (${ofAge(c, h) ? 'of age' : `of age ${inTime(comesOfAge(c, h))}`})`).join(', ') : 'No heirs yet'}.</div>`;
    town += visitButton(c, t.id) + convoyHtml(c, t.id) + decreePanel(c, t.id); // a visit, convoys, and drift and decrees (src/sim/drift.ts, decrees.ts)
    works = raisePanel(c, t.id); studies = studyPanel(c, t.id); // buildings raised on the town's record, and studies taught there (townworks.ts, studies.ts)
    for (const w of c.barriers ?? []) if ((w.a === t.id || w.b === t.id) && w.kind !== 'water') { const far = w.a === t.id ? w.b : w.a; build += btn('open:' + far, `${WORKS[w.kind].icon} Build ${WORKS[w.kind].name} to ${c.territories[far].name}`, WORKS[w.kind].cost, canOpen(c, 0, t.id, far), 'Opens this border for good, to you and to everyone else.'); }
    if (t.buildings.length < slots(t)) for (const [k, d] of Object.entries(SITES)) if (!t.buildings.includes(k) && (k !== 'harbour' || onSea(c, t.id))) build += btn('build:' + k, `${siteLook(k, d, me.civ).icon} Build ${siteLook(k, d, me.civ).name}`, siteCost(t, k, me.civ), canBuild(c, 0, t.id, k), `${d.desc} Paid in ${priceText(priceOf(k, siteCost(t, k, me.civ)))}.`);
  } else if (t.owner > 0 && c.factions[t.owner].alive) {
    const truce = c.truces.find((x) => x.with === t.owner);
    if (c.ally === t.owner) talk += `<div class="hint">🤝 ${c.factions[t.owner].name} are your allies. Their armies next to a battle of yours fight in it, and yours in theirs.</div>`;
    else if (truce) {
      talk += `<div class="hint">🕊️ At truce with ${c.factions[t.owner].name} until turn ${truce.until}.</div>`;
      if (c.ally < 0 && c.factions.filter((f) => f.alive).length >= 3) talk += btn('ally:' + t.owner, `🤝 Offer ${rulerName(c, t.owner)} an alliance`, ALLIANCE_COST, canAlly(c, t.owner), c.honor < 0 ? 'They know you broke your word.' : 'Paid only if they accept. Lasts until one of you breaks it or only you two remain.');
    } else talk += btn('truce:' + t.owner, `🕊️ Offer ${rulerName(c, t.owner)} a truce`, truceCost(me.civ), me.supplies >= truceCost(me.civ) && c.factions[t.owner].refused !== c.turn, c.factions[t.owner].refused === c.turn ? 'They have given their answer for this turn.' : c.honor < 0 ? 'They know you broke your word.' : 'Paid only if they accept. Lasts six turns.');
  }
  talk += freeTownButtons(c, t.id); // a free town: what it is, and treating with it (freetown.ts)
  if (t.owner > 0 && c.factions[t.owner].alive) {
    const fav = c.factions[t.owner].favor ?? 0;
    talk += btn('gift:' + t.owner, `🎁 Send ${c.factions[t.owner].name} supplies`, giftCost(me.civ), canGift(c, t.owner), c.ally === t.owner ? 'Your ally can spend them on troops.' : 'Earns goodwill: they will be readier to agree to a truce or an alliance.');
    if (fav) talk += `<div class="hint">Goodwill ${'●'.repeat(fav)}${'○'.repeat(MAX_FAVOR - fav)}</div>`;
  }
  return group('Raise troops', raise) +
    group('Raise in this town', works, 'Paid from the town\'s own stores; its governor builds it over the next seasons.') +
    group('Study', studies, 'Paid from this town\'s stores first; once learned, the whole nation knows it.') +
    group('Build on the land', build, `Paid in supplies. The land holds ${slots(t)} sites; ${t.buildings.length} stand here.`) + group('Leader', leader) + group('Town', town) + group('Diplomacy', talk) + group('The age', age) + group('Bands', bandButtons(c, t.id)) + group('A matter in the town', intrigueButtons(c, t.id));
}

/** What the last season truly added to what there is to spend (seasongain.ts), or the lands' yield before one is measured. */
function gainWords(c: Campaign): string {
  const g = lastGain(c);
  return g === undefined ? `the lands yield ${income(c, 0)} a season, before what the towns eat` : `${g >= 0 ? '+' : ''}${g} last season`;
}
