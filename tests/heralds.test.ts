// Heralds: raid news a season sooner, and a town that stands to on their word (src/sim/heralds.ts, raidnews.ts heraldSeason).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { TECHS } from '../src/sim/data';
import { HERALDS, keepsHeralds, stoodTo, warned } from '../src/sim/heralds';
import { heraldSeason, seasonNews } from '../src/sim/raidnews';
import { teacherOf } from '../src/sim/studies';
import { Band, defenceOf, softest } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(11, 2));
/** A campaign with one town of the player's alone among tribes, and a band of raiders that has it in reach. */
const world = (): { c: Campaign; at: number; b: Band } => {
  const c: Campaign = JSON.parse(base);
  c.turn = 10; c.fronts = [];
  const t = c.territories.find((x) => x.owner === 0)!;
  for (const id of t.adj) c.territories[id].owner = -1;
  c.armies = c.armies.filter((a) => a.at !== t.id);
  Object.assign(folkOf(c, t.id), { men: 4, women: 8, elders: 0, children: 2 });
  const b: Band = { id: 900, kind: 'raiders', name: 'the Test Men', at: t.adj[0], strength: 5, since: 1, held: [] };
  c.bands = [b];
  return { c, at: t.id, b };
};

describe('Heralds', () => {
  it('is a study taught at the Watch House', () => {
    expect(teacherOf('heralds')).toBe('watchhouse');
    expect(TECHS.heralds.answers).toBe('raids');
  });
  it('a people without them hears nothing before a band strikes', () => {
    const { c, at } = world();
    expect(keepsHeralds(c, 0)).toBe(false);
    expect(heraldSeason(c)).toEqual([]);
    expect(warned(c, at)).toBe(false);
    expect(stoodTo(c, at)).toBe(0);
    expect(seasonNews(c).filter((n) => n.kind === 'warned')).toHaveLength(0);
  });
  it('with them, the town a band has for its mark is told of it a season before, by band, strength and town', () => {
    const { c, at, b } = world();
    c.factions[0].studies = ['heralds'];
    const mark = softest(c, b)!;
    expect(c.territories[mark.id].owner).toBe(0); // the band does mean to come here
    const out: string[] = [];
    expect(heraldSeason(c, out)).toEqual([mark.id]);
    expect(out[0]).toContain('Heralds bring word');
    expect(out[0]).toContain('the Test Men');
    expect(out[0]).toContain(c.territories[mark.id].name);
    const news = seasonNews(c).find((n) => n.kind === 'warned')!;
    expect(news).toMatchObject({ at: mark.id, band: 900, tone: 'bad' });
    expect(warned(c, mark.id)).toBe(true);
    expect(mark.id).toBe(at);
    expect(JSON.parse(JSON.stringify(c.heralded))).toEqual({ [at]: c.turn }); // plain data
  });
  it('a town so warned stands half a company stronger the season after, and no longer than that', () => {
    const { c, at } = world();
    const bare = defenceOf(c, at).works;
    c.factions[0].studies = ['heralds'];
    expect(defenceOf(c, at).works).toBe(bare); // not warned yet
    heraldSeason(c);
    expect(defenceOf(c, at).works).toBe(bare + HERALDS.stoodTo);
    c.turn++;
    expect(defenceOf(c, at).works).toBe(bare + HERALDS.stoodTo); // the season the band may strike
    c.turn++;
    expect(defenceOf(c, at).works).toBe(bare); // the word has gone stale
    expect(stoodTo(c, at)).toBe(0);
  });
  it('a rival who keeps heralds is warned too; one who does not is not', () => {
    const { c, at, b } = world();
    const rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
    c.territories[at].owner = rival;
    expect(heraldSeason(c)).toEqual([]);
    c.factions[rival].studies = ['heralds'];
    expect(heraldSeason(c)).toEqual([at]);
    expect(stoodTo(c, at)).toBe(HERALDS.stoodTo);
    expect(seasonNews(c).filter((n) => n.kind === 'warned')).toHaveLength(0); // told to the rival, not to the player
    expect(b.strength).toBe(5); // nothing is done to the band
  });
});
