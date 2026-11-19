// Lessons for what befalls a battle from outside the player's own plans (docs/systems-board, "Teaching": plague, a
// storm, marauders, a rival's Wonder and the leader's powers were taught nowhere in a battle).
//
// Each is told once, the first time it happens, by the slip under the battle guide (lessons.ts tells them with the
// rest), and reads its numbers from the rules:
//   - plague: one of the player's people falls sick;
//   - a storm: the weather comes in heavy enough to matter (rain, snow or blowing dust, each told for what it does);
//   - marauders: a marauder comes within sight of the player's people or buildings;
//   - a rival's Wonder: a people at war with the player finishes one;
//   - the leader's powers: the player's leader has risen far enough to choose a power.
// Unlike the town's lessons these are told in a field battle too, where they can happen there.
import { BUILDINGS, CALAMITY, UNITS, WONDER_TIME } from './data';
import { CALLS, CALL_LASTS, CALL_RANK, CALL_REST } from './powers';
import { RANK_NAMES } from './hero';
import { WELL } from './well';
import type { Lesson } from './lessons';
import type { Game } from './game';

/** How near, in tiles, a marauder must come to the player's own for the lesson. */
export const MARAUDER_NEAR = 10;

const pct = (k: number): number => Math.round(Math.abs(1 - k) * 100);

/** Every lesson here, most pressing first. `foul` picks the storm's words (rain, snow or dust). */
export function hazardLessons(foul: '' | 'rain' | 'snow' | 'dust' = 'rain', call = CALLS.warlord.name): Lesson[] {
  const h = CALAMITY.harvest, priest = UNITS.priest?.name ?? 'Priest', well = BUILDINGS.well?.name ?? 'Well';
  const storm = foul === 'snow'
    ? `Snow is down. Off the roads everyone moves slower, so keep an army on them where you can, and the farms yield ${pct(h.snow ?? 1)}% less until it passes.`
    : foul === 'dust'
      ? `A dust storm is blowing. Nobody sees as far, so an enemy can come close before you know it; bows and guns reach a tile less, and the farms yield ${pct(h.dust ?? 1)}% less. Keep soldiers near what you must hold.`
      : `Rain is falling. Bows and guns reach a tile less, so let them come to you rather than trade shots at long range. Fires burn out fast in the wet, and the farms yield ${pct(h.rain ?? 1)}% more.`;
  return [
    { id: 'wonder', title: 'A rival has raised a Wonder',
      text: `If it stands for ${Math.round(WONDER_TIME / 60)} minutes they win, whatever else happens: the time left is shown at the top of the screen. Send everything you have against it. Siege engines and fire bring it down fastest, and soldiers can hack at it too.` },
    { id: 'plague', title: 'Plague among your people',
      text: `The sick lose health for a while and pass it to anyone of yours standing close. Keep the sick apart from the rest. A ${priest} cures it (only a Devout or Righteous town can call one), and a ${well} makes it pass only half as easily (${Math.round(WELL.pass * 100)}%). A town that keeps the faith suffers less of it.` },
    { id: 'marauders', title: 'Marauders',
      text: `They belong to no people. They come out of a camp in the wilds, carry off women, and grow in number for every one they hold. Guard your workers in the fields, and find their camp: burn it and everyone held there goes free.` },
    { id: 'storm', title: 'Foul weather', text: storm },
    { id: 'power', title: 'Your leader has a power to choose',
      text: `Your leader has risen in rank through the fighting and may learn one of two powers. Select them: the choice is among their commands, and it changes how they fight. Once they are ${RANK_NAMES[CALL_RANK]} they can also raise a call (${call}) over everyone of yours nearby, lasting ${CALL_LASTS} seconds, and again after ${CALL_REST}.` },
  ];
}

/** The lessons here whose moment has come for this player, most pressing first. */
export function hazardsDue(g: Game, pid: number): string[] {
  const p = g.players[pid];
  if (!p || p.defeated) return [];
  const due: string[] = [];
  if (g.players.some((q) => q.id !== pid && !q.neutral && !q.defeated && g.hostile(q.id, pid) && g.wonderLeft(q.id) >= 0)) due.push('wonder');
  if (g.units.some((u) => u.owner === pid && !u.dead && u.plagueT > 0)) due.push('plague');
  if (maraudersNear(g, pid)) due.push('marauders');
  if (g.foul) due.push('storm');
  if (g.powerDue(pid) >= 0) due.push('power');
  return due;
}

/** Is a marauder within reach of the player's own people or buildings? */
function maraudersNear(g: Game, pid: number): boolean {
  const them = g.units.filter((u) => u.def.marauder && !u.dead);
  if (!them.length) return false;
  const near = (x: number, y: number): boolean => them.some((m) => Math.hypot(m.x - x, m.y - y) <= MARAUDER_NEAR);
  return g.units.some((u) => u.owner === pid && !u.dead && near(u.x, u.y)) || g.buildings.some((b) => b.owner === pid && !b.dead && near(b.x, b.y));
}
