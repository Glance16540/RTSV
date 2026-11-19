// Who goes to arms, seen and chosen (src/sim/pickman.ts), and who a levy on the map would take (src/sim/levynext.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, canRaise, newCampaign, raise } from '../src/sim/campaign';
import { Building, Game, Unit } from '../src/sim/game';
import { enlistLine, enlistOf, queueLines, queueWho, sendMan, slotFor } from '../src/sim/pickman';
import { levyLine, nextLevy } from '../src/sim/levynext';
import { folkOf } from '../src/sim/township';
import type { WarHouse } from '../src/sim/warhouse';
import { run, setups, spot } from './helpers';

/** A town with a finished barracks and rich enough to train, its men out at the edge of it. */
function town(): { g: Game; b: Building; men: Unit[] } {
  const g = new Game(5, setups);
  const at = spot(g, 'barracks', 0);
  const b = g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
  g.players[0].res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  const men = [0, 1, 2].map((i) => g.spawnUnit('villager', 0, b.x + 8 + i, b.y + 8, 'm'));
  return { g, b, men };
}
const called = (g: Game, b: Building): Unit => g.entities.get(b.queue[0].who!) as Unit;

describe('pickman', () => {
  it('a soldier ordered shows who is going, on his panel and under the queue', () => {
    const { g, b } = town();
    expect(g.cmdTrain(0, b.id, 'clubman')).toBe(true);
    const v = called(g, b);
    expect(enlistOf(g, v)).toMatchObject({ b, inside: false });
    expect(enlistLine(g, v)).toMatch(/^On his way to the .* to be trained as an? /);
    expect(queueWho(g, b.queue[0])).toEqual({ state: 'coming', who: v });
    expect(queueLines(g, b)[0]).toContain(`${v.name} is on the way`);
    for (let i = 0; i < 60 && !b.queue[0]?.in; i++) run(g, 1);
    expect(b.queue[0].in).toBe(true);
    expect(enlistLine(g, v)).toMatch(/^Inside the /);
    expect(queueLines(g, b)[0]).toContain('is inside, being trained');
  });

  it('the player sends a man of their choosing in place of the one on his way, who goes back to what he was doing', () => {
    const { g, b, men } = town();
    g.cmdTrain(0, b.id, 'clubman');
    const first = called(g, b), mine = men.find((m) => m !== first && m.order?.t !== 'enlist')!;
    expect(slotFor(g, mine)?.b).toBe(b);
    expect(g.cmdSendMan(0, mine.id)).toBe(true);
    expect(b.queue[0].who).toBe(mine.id);
    expect(mine.order).toEqual({ t: 'enlist', id: b.id });
    expect(first.order?.t).not.toBe('enlist');
    expect(enlistOf(g, first)).toBeNull();
    expect(slotFor(g, mine)).toBeNull(); // already called
    expect(sendMan(g, 1, first.id)).toBe(false); // not theirs to send
  });

  it('a place with nobody to fill it says it waits, and a man sent fills it before any place whose man is on the way', () => {
    const { g, b, men } = town();
    g.cmdTrain(0, b.id, 'clubman'); g.cmdTrain(0, b.id, 'clubman');
    b.queue[1].who = 0; // its man has died, and nobody was free
    for (const u of g.units) if (u.owner === 0 && u.type === 'villager' && u.gender === 'm' && u.id !== b.queue[0].who) u.order = { t: 'enlist', id: -1 } as never; // nobody else free
    expect(queueWho(g, b.queue[1])).toEqual({ state: 'waiting' });
    expect(queueLines(g, b)[1]).toContain('waiting for a man');
    for (const u of g.units) if (u.order?.t === 'enlist' && (u.order as { id: number }).id === -1) u.order = null;
    const free = men.find((m) => m.id !== b.queue[0].who)!;
    expect(slotFor(g, free)?.at).toBe(1); // the waiting place first
    expect(g.cmdSendMan(0, free.id)).toBe(true);
    expect(b.queue[1].who).toBe(free.id);
  });

  it('a soldier\'s place takes a man: a woman, a child or one inside cannot be sent to it', () => {
    const { g, b } = town();
    g.cmdTrain(0, b.id, 'clubman');
    const woman = g.spawnUnit('villager', 0, b.x + 6, b.y + 6, 'f');
    expect(slotFor(g, woman)).toBeNull();
    expect(enlistLine(g, woman)).toBe('');
    const child = g.spawnUnit('villager', 0, b.x + 6, b.y + 7, 'm');
    child.growT = 30;
    expect(slotFor(g, child)).toBeNull();
    const man = g.spawnUnit('villager', 0, b.x + 6, b.y + 8, 'm');
    man.inside = b.id;
    expect(slotFor(g, man)).toBeNull();
    // A place whose man is already inside being trained is not swapped.
    const v = called(g, b);
    b.queue[0].in = true; v.inside = b.id; v.order = null;
    man.inside = 0;
    expect(slotFor(g, man)).toBeNull();
  });

  it('on the map: a levy names the men it would take, and raising it takes those men', () => {
    let done = false;
    for (let seed = 1; seed < 30 && !done; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      const t = c.territories.find((x) => x.capital === 0)!;
      if (!t.buildings.includes('barracks')) t.buildings.push('barracks');
      c.factions[0].supplies = 9999;
      const would = nextLevy(c, t.id);
      if (!would.length || !canRaise(c, 0, t.id, 'infantry')) continue;
      expect(levyLine(c, t.id)).toMatch(/^Would go: /);
      const men = folkOf(c, t.id).men;
      expect(nextLevy(c, t.id)).toEqual(would); // asking changes nothing
      expect(folkOf(c, t.id).men).toBe(men);
      const army = armyAt(c, t.id);
      if (!raise(c, 0, t.id, 'infantry')) continue;
      const a = armyAt(c, t.id) ?? army!;
      const away = ((folkOf(c, t.id) as { houses?: WarHouse[] }).houses ?? []).flatMap((h) => h.away.filter((s) => s.army === a.id && s.since === c.turn).map((s) => ({ name: s.name, family: h.family })));
      for (const m of would) expect(away).toContainEqual({ name: m.name, family: m.family });
      done = true;
    }
    expect(done).toBe(true);
  });
});
