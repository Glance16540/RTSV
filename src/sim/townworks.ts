// Works a town has beyond the few its land has room for on the map (docs/DESIGN.md, "Buildings and research that
// answer the systems"). A land's own buildings (campaign.ts: Farmland, a Barracks, a Fortress...) are held to three
// or four. The buildings that answer a system (a Watch House, an Inn, a Granary...) are each kept by the module
// whose rules they are, on the town's record, outside that count.
//
// When a battle or a visit is laid out, the town must stand with all of them. Rather than the hubs asking each
// module by name, each module that keeps such a building puts itself on this list as it loads, and the hub asks
// the list once: `worksOf(c, tid)` gives the battle's building types that must stand in that town.
import type { Campaign } from './campaign';

/** Those who keep a building on a town's record: each says which battle buildings that town must stand with. */
export const WORKS: ((c: Campaign, tid: number) => string[])[] = [];
/** Every such building a town has, as the types a battle raises (game.ts `bonus.buildings`). */
export const worksOf = (c: Campaign, tid: number): string[] => WORKS.flatMap((f) => f(c, tid));
