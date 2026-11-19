// The numbers of the threats of men (threats.ts), on their own. They are kept apart from the rules that use them
// so that a system those rules themselves depend on can read one (the household reads how long a captive can be
// got back for) without importing the rules and tying the two in a ring. Nothing here but numbers.

export const THREATS = {
  /** The season from which bands may appear. */
  from: 3,
  /** Held lands for each band that is meant to be about, the most at once, and the chance a missing one appears in a season. */
  lands: 5, most: 5, appear: 0.7,
  /** A new band's strength (least and most), the most one grows to, and the seasons between its growing by itself. */
  start: [2, 4], max: 10, grow: 3,
  /** The chance a band strikes in a season. 0.7 read raids on a town once in 3.0 years, on the floor of their band; 0.66 read 3.2 until bands could rob caravans and grow on them (3.0 again at 384, under in one course); 0.62 reads 3.1 in both. Lower costs a little: bands that strike less are spent less. */
  strike: 0.62,
  /** How much less a taken town's men are worth on the walls at the full weight of its old people's resentment (oldfolk.ts `oldWeight`): half. */
  grudge: 0.5,
  /** Defence against force: at or over `hold` the town holds; under `fall` people are taken; between, it is raided. */
  hold: 0.82, fall: 0.4,
  /** What those on a road can do for themselves with no army to escort them, in companies: enough to see off a small band. */
  wayfarers: 2.5,
  /** What counts toward a town's defence, in companies. */
  man: 0.45, fortress: 3, raising: 0.5, tower: 1, towers: 3, wall: 0.1, walls: 2, capital: 1, sick: 0.7,
  /** The share of a town's men who died at the walls by outcome, as it was before the dead followed the fight (raidclash.ts RAID.dead): read by nothing now, kept while the old fight is kept for the report. What pirates take over the rest; what is taken on a road. (A town's stores lost follow the fight: RAID.loot.) */
  dead: { held: 0, raided: 0.1, taken: 0.2 }, pirateLoot: 0.2, road: 0.2,
  /**
   * And no more than they can carry: so many goods for each point of the band's force, by its kind. Pirates have
   * ships to fill; slavers come for people; the marauders come for women, and take little else. (A nation's
   * supplies are its towns' stores above their working stock, stores.ts: a band that emptied a town each time
   * would beggar a nation in a few seasons.)
   */
  carry: { raiders: 30, slavers: 15, pirates: 45, highwaymen: 30, marauders: 10 } as Record<string, number>,
  /**
   * The share of a town's women, and for slavers its men, carried off when it falls; and the share of them a band
   * leaves behind whatever its appetite, so that a town is bled and not emptied. A town whose people are still held
   * by some band is not taken from again: it can be raided, and no more.
   */
  carried: 0.25, left: 0.5, last: 2,
  /** Seasons of its own eating a band leaves in a town's larder: it takes food only above that (larder.ts). */
  larder: 2,
  /** The chance raiders or pirates burn a farm. */
  burn: 0.5,
  /** How a strike sways a people: up when they hold, down when raided or taken (and by creed, on the way down). */
  sway: { held: 2, raided: -2, taken: -4 },
  /** Seasons captives can be got back for, and the years of life the whole of it costs a man and a woman. */
  holdFor: 4, yearsMan: 20, yearsWoman: 30,
  /** Supplies an army wins back by breaking a band (into the town where it stands, else its chief town), and how many reports are kept. */
  prize: 3, kept: 40,
};
