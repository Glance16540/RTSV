// The saves the frame-cost measure plays (scripts/framecost.mjs): the player's capital as a siege and as a visit, new
// (the first season) and grown (after some seasons of the computer playing every side), written as campaign saves.
//
//   FRAMECOST=1 OUT=dir npx vitest run scripts/framecost-saves.test.ts   (SEASONS=30: how long "grown" is)
//
// Skipped unless FRAMECOST is set. It measures nothing: `npm run framecost` makes these and then plays them.
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Campaign, continueAI, endTurn, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import { TOWN_SCALE, folkOf, headcount } from '../src/sim/township';
import { beginVisit } from '../src/sim/visit';

const OUT = process.env.OUT ?? 'framecost', SEASONS = +(process.env.SEASONS ?? 30);

/** Seasons of the map with every people played by the computer, the player's battles settled on the map. */
function grow(c: Campaign, seasons: number): void {
  for (let t = 0; t < seasons && c.phase !== 'over'; t++) {
    endTurn(c);
    for (let k = 0; k < 60 && c.phase !== 'player' && c.phase !== 'over'; k++) { if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
    if (c.pending) resolvePending(c, 'auto');
    c.demand = null; delete c.tale;
  }
  c.phase = 'player';
}

/** A rival's army of four companies of infantry and two of archers marches on the capital: a siege. */
function siege(c: Campaign, tid: number): boolean {
  const home = c.territories[tid], at = home.adj.find((n) => c.territories[n].owner !== 0) ?? home.adj[0];
  c.territories[at].owner = 1;
  c.armies.push({ id: 9999, owner: 1, at, units: { infantry: 4, archers: 2 }, hero: true, vet: 0, moved: false });
  c.pending = null;
  if (moveArmy(c, 9999, tid) !== 'battle' || !c.pending) return false;
  c.pending.mode = 'siege';
  return true;
}

it.skipIf(!process.env.FRAMECOST)('writes the frame-cost saves', () => {
  mkdirSync(OUT, { recursive: true });
  for (const age of ['new', 'grown'] as const) for (const kind of ['siege', 'visit'] as const) {
    const c = newCampaign(6, 1, 1, 'hearth');
    if (age === 'grown') grow(c, SEASONS);
    const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
    const ok = kind === 'siege' ? siege(c, t.id) : beginVisit(c, t.id);
    const f = folkOf(c, t.id);
    writeFileSync(`${OUT}/${age}-${kind}.json`, JSON.stringify(c));
    console.log(`TOWN_SCALE ${TOWN_SCALE}, ${age} ${kind}${ok ? '' : ' (could not be set up)'}: ${t.name}, ${headcount(f)} people (${f.men + f.women + f.elders} grown), ${t.town?.b.length ?? 0} buildings on record${t.town?.coarse ? ' (coarse)' : ''}`);
  }
}, 600_000);
