// A story afoot in a town, on the field of a visit there (docs/DESIGN.md, "Stories inside the story": they had nothing
// inside a battle or a visit). The map side (storyvisit.ts) hands the visit the player's story in the town; here, in the
// town itself:
//   - a thief: the houses robbed are marked, each by the name of the household robbed (before the town has houses, the
//     works where their goods were kept); a soldier of the player's who
//     stands guard by a robbed house long enough (FIELD_STORY.guard; half as long where the town keeps a watch) takes the thief there;
//   - a killer: those spoken of walk the town as its villagers, by their names and trades; the player may question one,
//     and an innocent may be cleared by it (FIELD_STORY.question). The guilty one is never cleared, and nothing on the
//     field says which it is.
// What came of it is read back as the player leaves (`storyOut`) and written to the story on the map (storyvisit.ts).
// Children are no units on the field (nursery.ts): they are never named here, suspected, questioned or harmed. Nobody is
// struck or killed here: a story's dead are the map's. It reads the game and writes only these marks on it.
import type { Building, Game, Unit } from './game';

/** A grown person a story turns on, as the map keeps them (intriguebase.ts Person). */
export interface StoryPerson { name: string; family: string; gender: 'm' | 'f'; trade: string }
/** A story as it comes into the field. `culprit`: a killer's, which is not for showing; `robbed`: how often each house was. */
export interface FieldStory { id: number; kind: 'thief' | 'killer'; people: StoryPerson[]; robbed: number[]; culprit: number; cleared: number[]; watch?: boolean }
/** What came of it on the field, for the map. */
export interface FieldStoryOut { id: number; caught?: boolean; cleared: number[] }

declare module './game' {
  interface Player {
    /** A story afoot in the town, as it stands on the field (fieldstory.ts). */
    story?: FieldStory & { laid?: boolean; guarded?: Record<number, number>; caught?: boolean; asked?: number[]; out?: number[] };
  }
  interface Building {
    /** The household robbed by the thief, whose house (or goods) this is (fieldstory.ts). */
    robbed?: string;
  }
  interface Unit {
    /** Which of those a story speaks of this villager is (fieldstory.ts). */
    suspect?: number;
  }
}

export const FIELD_STORY = {
  /** Seconds a soldier must stand guard by a robbed house to take the thief there; tiles he may stand from it. */
  guard: 40, near: 3,
  /** Where the town keeps a watch it knows where to stand: so much of the time. */
  watched: 0.5,
  /** The chance that questioning an innocent clears them. */
  question: 0.5,
};

const hash = (a: number, b: number, c: number): number => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const villagers = (g: Game, owner: number, gender?: 'm' | 'f'): Unit[] => g.units.filter((u) => u.owner === owner && !u.dead && u.type === 'villager' && (!gender || u.gender === gender));
const houses = (g: Game, owner: number): Building[] => g.buildings.filter((b) => b.owner === owner && !b.dead && b.type === 'house');

/**
 * Mark the robbed households on the town: each its own house where it has one, else a house not yet marked, else, in a
 * town not yet housed, another of its works (the hall, a farm) where their goods were kept. Done again as houses rise.
 */
function markRobbed(g: Game, owner: number): void {
  const s = g.players[owner]!.story!, all = houses(g, owner);
  const works = g.buildings.filter((b) => b.owner === owner && !b.dead && b.complete && !b.def.wall && b.type !== 'house');
  const due = s.people.map((p, i) => ({ p, name: p.family || p.name, i })).filter(({ name, i }) => (s.robbed[i] ?? 0) > 0 && !g.buildings.some((b) => b.owner === owner && !b.dead && b.robbed === name));
  const mark = (b: Building | undefined, name: string): boolean => { if (b) b.robbed = name; return !!b; };
  // Their own houses first, so that no household takes another's; then the free houses, then the works.
  const left = due.filter(({ p, name }) => !mark(p.family ? all.find((x) => !x.robbed && x.family === p.family) : undefined, name));
  for (const { name } of left) mark(all.find((x) => !x.robbed && !due.some((d) => d.p.family && d.p.family === x.family)) ?? works.find((x) => !x.robbed), name);
}

/** Lay a story on the town the first time the field is looked at: the robbed houses marked, the spoken-of named. */
export function layStory(g: Game, owner: number): void {
  const s = g.players[owner]?.story;
  if (!s || s.laid) return;
  s.laid = true;
  if (s.kind === 'thief') { markRobbed(g, owner); return; }
  // The spoken of: villagers of their sex take their names, each one villager, while there are villagers to be them.
  const used = new Set<number>();
  s.people.forEach((p, i) => {
    if (s.cleared.includes(i)) return;
    const u = villagers(g, owner, p.gender).find((x) => !used.has(x.id) && x.suspect === undefined);
    if (!u) return;
    used.add(u.id);
    u.name = p.name; u.family = p.family; u.suspect = i;
  });
}

/** A second of the story on the field: a guard by a robbed house takes the thief. Called once a second (game.ts step). */
export function storyTick(g: Game): void {
  for (let owner = 0; owner < g.players.length; owner++) {
    const s = g.players[owner]?.story;
    if (!s) continue;
    layStory(g, owner);
    if (s.kind !== 'thief' || s.caught) continue;
    if (g.tick % 200 === 0) markRobbed(g, owner); // houses raised since, or a mark burnt down
    for (const b of g.buildings) {
      if (b.owner !== owner || b.dead) continue;
      if (!b.robbed) continue;
      const guard = g.units.some((u) => u.owner === owner && !u.dead && u.type !== 'villager' && Math.hypot(u.x - b.x, u.y - b.y) <= FIELD_STORY.near + b.size / 2);
      const g2 = (s.guarded ??= {});
      g2[b.id] = guard ? (g2[b.id] ?? 0) + 1 : 0;
      if (g2[b.id] >= FIELD_STORY.guard * (s.watch ? FIELD_STORY.watched : 1)) {
        s.caught = true;
        g.msg(owner, `The guard where the ${b.robbed} household was robbed has taken the thief in the night. Judge them on the map.`);
        break;
      }
    }
  }
}

/** Why this villager cannot be questioned, or '' if they can. */
export function questionBar(g: Game, owner: number, u: Unit | undefined): string {
  const s = g.players[owner]?.story;
  if (!s || s.kind !== 'killer' || !u || u.owner !== owner || u.dead || u.suspect === undefined) return 'Nobody here is spoken of.';
  if (s.cleared.includes(u.suspect) || (s.out ?? []).includes(u.suspect)) return `${u.name} is spoken of no longer.`;
  if ((s.asked ?? []).includes(u.suspect)) return `${u.name} has been questioned already.`;
  return '';
}
/** The player questions one of those spoken of. An innocent may be cleared; the guilty never is. Returns whether they were. */
export function cmdQuestion(g: Game, owner: number, uid: number): boolean {
  const s = g.players[owner]?.story, u = g.units.find((x) => x.id === uid);
  if (!s || questionBar(g, owner, u)) return false;
  const i = u!.suspect!;
  (s.asked ??= []).push(i);
  const clear = i !== s.culprit && hash(g.seed, s.id * 131 + i, g.tick) < FIELD_STORY.question;
  if (clear) (s.out ??= []).push(i);
  g.msg(owner, clear
    ? `${u!.name} ${u!.family} the ${s.people[i].trade} answers every question, and three swear where ${u!.gender === 'f' ? 'she' : 'he'} was that night. ${u!.gender === 'f' ? 'She' : 'He'} is spoken of no longer.`
    : `${u!.name} ${u!.family} the ${s.people[i].trade} answers, but nothing is settled by it.`);
  return clear;
}

/** What came of the story on the field, for the map: whether the thief was taken, and who was cleared. */
export function storyOut(g: Game, owner: number): FieldStoryOut | undefined {
  const s = g.players[owner]?.story;
  if (!s) return undefined;
  return { id: s.id, ...(s.caught ? { caught: true } : {}), cleared: [...(s.out ?? [])] };
}
