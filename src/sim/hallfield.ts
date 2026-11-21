// Judgement at the Hall, in the town (docs/DESIGN.md, "Buildings and research that answer the systems": rule and law; the
// board's line "Inside a town it is a building only: nobody is judged there in real time").
//
// When the player is in a town of theirs with a Hall of Judgement standing on its record (a visit, or a battle for it),
// the cases the map already has waiting on the leader's judgement there come before them at the Hall (hallcases.ts makes
// them): a thief taken and held for judgement, a plotter laid bare, a noble's petition. Each is shown on the Hall's own
// panel with the answers the map would give, and the player may rule on it while in the town (`ruleAt`). As the sitting
// ends the rulings go back to the map (`hallOut`), which gives them by its own rules, so that each does exactly what it
// would have done there. A case not ruled on waits on the map as before.
// The field knows only what it is handed: the words, and the answers. No case involves a child.
// Plain data: nothing here imports the campaign.
import type { Game } from './game';

/** One case before the Hall: what it is, in words, and the answers the map would give. */
export interface HallCase { id: string; kind: 'thief' | 'killer' | 'plotter' | 'petition'; who: string; text: string; answers: { id: string; label: string; bar?: string }[] }

declare module './game' {
  interface PlayerSetup { /** Cases waiting on the leader's judgement in this town, for its Hall (hallfield.ts). */ hall?: HallCase[] }
  interface Player { /** The cases before the Hall, and what the player has ruled (hallfield.ts). */ hall?: { cases: HallCase[]; ruled: Record<string, string> } }
}

const text = (v: unknown, n = 160): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, n) : '');

/** The cases handed in, made safe. */
export function cleanCases(x: unknown): HallCase[] {
  if (!Array.isArray(x)) return [];
  const out: HallCase[] = [];
  for (const c of x.slice(0, 12) as Partial<HallCase>[]) {
    const id = text(c?.id, 40), kind = c?.kind === 'thief' || c?.kind === 'killer' || c?.kind === 'plotter' || c?.kind === 'petition' ? c.kind : undefined;
    const answers = (Array.isArray(c?.answers) ? c.answers : []).slice(0, 8).map((a) => ({ id: text(a?.id, 40), label: text(a?.label, 80), ...(text(a?.bar, 80) ? { bar: text(a?.bar, 80) } : {}) })).filter((a) => a.id && a.label);
    if (id && kind && answers.length) out.push({ id, kind, who: text(c.who, 60), text: text(c.text), answers });
  }
  return out;
}

/** As the sitting begins: the town's cases are before its Hall, if it stands. */
export function seatHall(g: Game, owner: number, cases: unknown): number {
  const list = cleanCases(cases), p = g.players[owner];
  if (!p || !list.length) return 0;
  p.hall = { cases: list, ruled: {} };
  g.msg(owner, `⚖️ ${list.length === 1 ? 'A case waits' : `${list.length} cases wait`} on your judgement at the Hall of Judgement.`);
  return list.length;
}

/** Is a Hall of Judgement of this side standing finished in the town? */
export const hallStands = (g: Game, owner: number): boolean => g.buildings.some((b) => b.owner === owner && !b.dead && b.complete && b.type === 'hall');

/** The cases waiting before this side's Hall, not yet ruled on; none while no Hall stands finished. */
export const casesBefore = (g: Game, owner: number): HallCase[] => {
  const h = g.players[owner]?.hall;
  return h && hallStands(g, owner) ? h.cases.filter((c) => h.ruled[c.id] === undefined) : [];
};

/** The player rules on a case at the Hall. Returns whether the ruling was taken: a case before it, an answer it offers. */
export function ruleAt(g: Game, owner: number, caseId: string, answer: string): boolean {
  const h = g.players[owner]?.hall, c = h?.cases.find((x) => x.id === caseId), a = c?.answers.find((x) => x.id === answer);
  if (!h || !c || !a || a.bar || h.ruled[caseId] !== undefined || !hallStands(g, owner)) return false;
  h.ruled[caseId] = answer;
  g.msg(owner, `${c.who ? `${c.who}: ` : ''}${a.label}. It is done as you leave the town.`);
  return true;
}

/** As the sitting ends: the rulings given at the Hall, for the map to give. */
export const hallOut = (g: Game, owner: number): { id: string; answer: string }[] =>
  Object.entries(g.players[owner]?.hall?.ruled ?? {}).map(([id, answer]) => ({ id, answer }));
