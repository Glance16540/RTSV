// A raiding people at home (docs/PLAYTEST.md 4.1).
//
// A people who live by raiding (STYLES.raider: the steppe peoples) begin a skirmish as a war band: a man, a woman
// and a few fighters, no hall, beaten when the last of them falls (game.ts). That is right for a band in the open
// and wrong for a town. On the map such a people's town has its people and its buildings on record like any
// other; fought for in person, it was begun as a war band all the same, so its people were never on the field, it
// had no hall to bring down, and the count written back afterwards read the whole town as dead.
//
// The rule: a side that is handed a town of the map's (its people on record, or its buildings kept) is at home.
// It begins as a town, with its hall and its people, and is beaten as a town is. It is a raiding people still in
// everything else: how it fights, whom it carries off, what it may build.
export interface HomeState {
  /** This side defends (or visits) a town of the map's: it begins as a town, whatever its people's way of life. */
  atHome?: boolean;
}

/** What a side is handed at the start that says it stands in a town on record. */
export interface HomeBonus { people?: unknown; town?: readonly unknown[] }

/** Is this side at home: in a battle for a town (not one in the open), with the town's people or buildings handed to it? */
export function atHome(bonus: HomeBonus | undefined, field: boolean): boolean {
  return !field && !!(bonus?.people || bonus?.town?.length);
}

/** Does this side begin, and fall, as a war band: a raiding people with no town of the map's under it? */
export function warBand(raider: boolean, p: HomeState | undefined): boolean {
  return raider && !p?.atHome;
}
