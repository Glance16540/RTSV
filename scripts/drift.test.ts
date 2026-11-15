// How towns drift over many seasons (drift.ts, decrees.ts): campaigns played turn by turn by the computer (the
// player stands still; battles are settled from the map), once with nobody giving decrees and once with every
// people, the player's too, giving the decrees a sensible ruler would.
//
//   DRIFT=1 SEEDS=1-8 TURNS=20 OUT=drift.jsonl npx vitest run scripts/drift.test.ts
//
// One line of JSON per campaign and mode. Skipped unless DRIFT is set.
import { it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { answerDemand, continueAI, endTurn, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { decreesAt, sensibleDecrees } from '../src/sim/decrees';
import { driftOf, townStanding } from '../src/sim/drift';
import { folkOf } from '../src/sim/township';

const [lo, hi] = (process.env.SEEDS ?? '1-2').split('-').map(Number);
const TURNS = +(process.env.TURNS ?? 20);
const MODES = (process.env.MODES ?? 'none,sensible').split(',');

function towns(c: Campaign) {
  const out: { owner: number; lean: number; standing: number; strain: number; care: number; grief: number; gold: number; decrees: number }[] = [];
  for (const t of c.territories) {
    if (t.horde) continue;
    const f = folkOf(c, t.id);
    out.push({ owner: t.owner, lean: f.lean ?? 0, standing: townStanding(c, t.id), strain: f.drift?.strain ?? 0, care: f.drift?.care ?? 0, grief: f.grief ?? 0, gold: f.stores.gold, decrees: decreesAt(c, t.id).length });
  }
  return out;
}

it.skipIf(!process.env.DRIFT)('towns drifting over many seasons', () => {
  for (let seed = lo; seed <= hi; seed++) {
    for (const mode of MODES) {
      const c = newCampaign(seed, 2, 1, ['hearth', 'forge', 'greece', 'egypt'][seed % 4]);
      c.decreesOff = mode === 'none';
      const track: unknown[] = [];
      let given = 0;
      for (let turn = 0; turn < TURNS && c.factions[0].alive; turn++) {
        if (mode === 'sensible') given += sensibleDecrees(c, 0, (tid) => driftOf(c, tid));
        endTurn(c);
        for (let i = 0; i < 80 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
        if (c.pending) resolvePending(c, 'auto');
        track.push({ turn: c.turn, towns: towns(c), virtue: c.factions.map((f) => f.virtue ?? 0) });
      }
      appendFileSync(process.env.OUT ?? 'drift.jsonl', JSON.stringify({ seed, mode, given, track }) + '\n');
    }
  }
}, 36_000_000);
