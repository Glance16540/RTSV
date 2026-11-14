// Teaching the campaign: what a new player is told to do first, and the page that explains the rest.
// Everything here is worked out from the campaign's own rules and numbers, so it cannot drift from them.

import { VISIT_SECONDS } from './visit';
import { creedOf } from './creed';
import {
  ALLIANCE_COST, BEATS, COMPANIES, Campaign, DOMINION_SHARE, DOMINION_TURNS, FAITH, HERO_RANK_STRENGTH, MAX_ARMY, SEA_LANDING, SITES, TRUCE_COST, TRUCE_TURNS,
  ageOf, dominionNeed, landOf,
} from './campaign';
import { HALL_GRACE } from './beaten';
import { CHAMPION_KILLS } from './champion';
import { RANK_NAMES } from './hero';
import { POWER_RANKS } from './powers';
import { TALE_EVERY, TALE_FROM } from './story';

/** How things stood when the guide first saw this campaign: its steps are measured from here. */
export interface PrimerBase { seed: number; turn: number; lands: number; buildings: number; companies: number; age: number }
export interface PrimerStep { id: string; title: string; how: string; done: boolean }

const buildingsOf = (c: Campaign): number => c.territories.reduce((n, t) => n + (t.owner === 0 ? t.buildings.length : 0), 0);
const companiesOf = (c: Campaign): number => c.armies.reduce((n, a) => n + (a.owner === 0 ? Object.values(a.units).reduce((s, x) => s + x, 0) : 0), 0);

export function primerBase(c: Campaign): PrimerBase {
  return { seed: c.seed, turn: c.turn, lands: landOf(c, 0), buildings: buildingsOf(c), companies: companiesOf(c), age: ageOf(c, 0) };
}

/**
 * The first orders of a campaign, in the order a new player should meet them. A step is done when the
 * campaign shows it has been: a company more than there was, a land more, a later turn. `seen` holds the
 * steps already done or passed over, which stay done even if the campaign later loses what earned them.
 */
export function primerSteps(c: Campaign, base: PrimerBase, seen: readonly string[] = []): PrimerStep[] {
  const cheapest = Object.values(COMPANIES).reduce((a, b) => (b.cost < a.cost ? b : a));
  const steps: [string, string, string, boolean][] = [
    ['raise', 'Raise a company',
      `Click your capital, the land marked ★, and raise a company there. Each kind needs its own building: a ${SITES[cheapest.needs].name} for ${cheapest.name.toLowerCase()}. It joins the army standing on that land.`,
      companiesOf(c) > base.companies],
    ['build', 'Build on your land',
      `A land holds only a few buildings, so choose. ${SITES.farm.name} brings supplies every turn; a ${SITES.barracks.name}, ${SITES.range.name} or ${SITES.stable.name} lets that land raise troops.`,
      buildingsOf(c) > base.buildings],
    ['take', 'Take a neighbouring land',
      'Click the land your army stands on, then a land joined to it by a dotted road. Begin with one held by few local warriors. You may fight the battle yourself or let it be settled on the map.',
      landOf(c, 0) > base.lands],
    ['turn', 'End the turn',
      'Supplies come in from your lands, your armies may march again, and your rivals take their turns.',
      c.turn > base.turn],
    ['rival', 'Speak to a rival',
      `Click a land a rival holds. A truce keeps them off you for ${TRUCE_TURNS} turns; a gift earns goodwill, and goodwill makes them readier to agree.`,
      c.truces.length > 0 || c.ally >= 0 || c.factions.some((f) => f.id !== 0 && (f.favor ?? 0) > 0)],
    ['age', 'Advance an age',
      'From any land of yours. Every army you have grows stronger, and your battles begin in the new age with its weapons.',
      ageOf(c, 0) > base.age],
    ['win', 'Win the world',
      `Take every land, or hold ${dominionNeed(c)} of the ${c.territories.length} for ${DOMINION_TURNS} turns running. Your rivals can win the same way.`,
      c.phase === 'over'],
  ];
  return steps.map(([id, title, how, done]) => ({ id, title, how, done: done || seen.includes(id) }));
}

export interface PrimerSection { title: string; lines: string[] }

/**
 * The page that explains the campaign, section by section. With a campaign in hand the winning numbers
 * are that world's own; without one (on the main menu) they are given as a share of the map.
 */
export function primerPage(c?: Campaign): PrimerSection[] {
  const pct = (x: number): string => `${Math.round(x * 100)}%`;
  const sites = Object.values(SITES).map((s) => `<b>${s.name}</b> (${s.cost}): ${s.desc}`);
  const companies = Object.entries(COMPANIES).map(([k, d]) => `<b>${d.name}</b> (${d.cost}, from a ${SITES[d.needs].name}) beat ${BEATS[k]}`);
  const creed = (id: string): string => `<b>${creedOf(id === 'zealous' ? 80 : id === 'devout' ? 40 : id === 'worldly' ? -40 : -80).name}.</b> ${FAITH[id].desc}`;
  return [
    { title: 'A turn', lines: [
      'You hold lands, and each land pays <b>supplies</b> at the start of every turn. Supplies pay for everything: companies of soldiers, buildings, a new age, a truce.',
      'In your turn you may spend, and march each army once, in any order. Then <b>End turn</b>: your rivals move, and you are paid again.',
    ] },
    { title: 'Lands', lines: [
      'Click any land to read it: who holds it, what it pays, how well it is defended, what country it is and what stands on it. A land has room for only a few buildings.',
      ...sites,
      `You may enter any town of your own from its panel and play up to ${Math.round(VISIT_SECONDS / 60)} minutes of the season there in person, with no enemy in it: build, train and set people to work. What you build stays. Each town can be visited once a season, and as many towns as you like. The age is not advanced there.`,
      'Some lands have a gift of their own (good soil, hills, a coast), and a few are places of note with a name and a legend: whoever holds one has the good of it.',
    ] },
    { title: 'Armies and battles', lines: [
      `An army is up to ${MAX_ARMY} companies standing on one land. ${companies.join('; ')}.`,
      'To march, click the land your army is on and then a neighbour joined to it by a dotted road. Mountains, rivers and open water close some borders; the land\'s panel says which.',
      `Open water is crossed only from a land with a ${SITES.harbour.name}, and troops landing from the sea fight at ${pct(SEA_LANDING)} strength.`,
      'March into land that is not yours and there is a battle. Fight it yourself, in the field or as a siege of the town, or let it be settled on the map by strength.',
      `A siege is won by bringing down their Town Center and keeping them from beginning another for ${HALL_GRACE} seconds; it is lost the same way. What you build and fell in a siege stays on that land.`,
      `Your leader marches with one army and fights in its battles. Deeds in battle raise their rank, and each rank adds ${HERO_RANK_STRENGTH} to that army's strength on the map. At ${POWER_RANKS.map((r) => RANK_NAMES[r]).join(', ').replace(/, ([^,]*)$/, ' and $1')} they come into one of two powers, chosen when you make them.`,
      `If they fall, choose an heir to lead, or hire a stranger in your capital. In the battle itself, a foot or mounted soldier with ${CHAMPION_KILLS} kills has made a name and can be raised to lead where they stand; they then lead on the map too.`,
    ] },
    { title: 'Rivals', lines: [
      `Click a rival's land to deal with them. A <b>truce</b> (${TRUCE_COST}) lasts ${TRUCE_TURNS} turns; at truce you may offer an <b>alliance</b> (${ALLIANCE_COST}), and an ally's armies beside a battle of yours fight in it. Both are paid only if accepted.`,
      'A <b>gift</b> earns goodwill, which makes them readier to agree. They may demand tribute of you in turn. Break a truce and every rival remembers it.',
    ] },
    { title: 'Creed', lines: [
      `Your people stand somewhere between pious and decadent. A ${SITES.church.name} moves them one way every turn and a ${SITES.tavern.name} the other, and your towns begin each battle as your people are.`,
      creed('zealous'), creed('devout'), creed('worldly'), creed('decadent'),
      `From turn ${TALE_FROM}, every ${TALE_EVERY} turns a matter is brought before you with a pious answer and a worldly one, each at a price. Some are told only to whoever holds a place of note, and some follow from what you answered before.`,
    ] },
    { title: 'Winning', lines: [
      c
        ? `Take every land, or hold ${dominionNeed(c)} of this world's ${c.territories.length} lands for ${DOMINION_TURNS} turns running.`
        : `Take every land, or hold ${pct(DOMINION_SHARE)} of them for ${DOMINION_TURNS} turns running.`,
      'A rival who does the same has won. The chronicle keeps what happened along the way, and its last page tells how it ended.',
    ] },
  ];
}
