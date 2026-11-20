// A game, and a campaign, play out the same whatever was played before them in the same process.
// The Unity port compares its fingerprint and health report with this side's character for character
// (docs/PORTING.md), so nothing may be carried from one game or one campaign into the next: no module-level
// cache, counter or order of keys that a later game can see.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { answerDemand, continueAI, endTurn, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';

/** A plain hash of a whole state: two 32-bit runs over every character, so one changed number anywhere shows. */
const hash = (s: string): string => {
  let a = 0x811c9dc5, b = 0x1b873593;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b + c, 0x85ebca6b) ^ (b >>> 13); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
};
/** A battle with both sides played by the computer, hashed every minute and at the end. */
const battle = (seed: number, a: string, b: string, minutes: number): string[] => {
  const g = new Game(seed, [{ name: a, color: 1, isAI: true, civ: a }, { name: b, color: 2, isAI: true, civ: b }]);
  g.marauders = true;
  const ais = [0, 1].map((p) => { const c = new AIController(g, p); c.setLevel(1); return c; });
  const out: string[] = [];
  for (let s = 0; s < minutes * 60 && g.winner < 0; s++) {
    for (let q = 0; q < 20; q++) { g.step(); g.events.length = 0; }
    ais.forEach((c) => c.update());
    if ((s + 1) % 60 === 0) out.push(hash(g.serialize()));
  }
  out.push(`tick ${g.tick} winner ${g.winner} ${hash(g.serialize())}`);
  return out;
};
/** A campaign with every people played by the computer, hashed every ten seasons and at the end. */
const campaign = (seed: number, civ: string, seasons: number): string[] => {
  const c = newCampaign(seed, 2, 1, civ);
  const out: string[] = [];
  for (let s = 0; s < seasons && c.phase !== 'over'; s++) {
    for (let i = 0; i < 40 && c.phase === 'player'; i++) { playForPlayer(c); if (c.pending) resolvePending(c, 'auto'); else break; }
    endTurn(c);
    for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
    if (c.pending) resolvePending(c, 'auto');
    if ((s + 1) % 10 === 0) out.push(hash(JSON.stringify(c)));
  }
  out.push(`turn ${c.turn} ${hash(JSON.stringify(c))}`);
  return out;
};

describe('nothing is carried from one game into the next', () => {
  it('a battle is the same played first, after other battles, and again', () => {
    const first = battle(3041, 'dawn', 'hearth', 4);
    battle(77, 'wild', 'persia', 3); battle(78, 'greece', 'steppe', 3);
    campaign(5, 'forge', 12);
    const again = battle(3041, 'dawn', 'hearth', 4);
    expect(again).toEqual(first);
    expect(battle(3041, 'dawn', 'hearth', 4)).toEqual(first);
  }, 600000);
  it('a campaign is the same played first, after other campaigns and battles, and again', () => {
    const first = campaign(11, 'hearth', 40);
    campaign(12, 'wild', 30); campaign(13, 'dawn', 30);
    battle(79, 'japan', 'egypt', 2);
    const again = campaign(11, 'hearth', 40);
    expect(again).toEqual(first);
    expect(campaign(11, 'hearth', 40)).toEqual(first);
  }, 600000);
});
