// The thread through the missions, told (src/sim/missionstory.ts): its line before a mission, shown over the brief,
// and its line after, shown when the mission is won, with the next mission of the thread offered.
import { chapterOf, nextInThread, threadTag } from '../sim/missionstory';
import { missionById } from '../sim/scenario';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** Put the thread's line before the brief, on the briefing screen. */
export function storyBrief(lead: HTMLElement, mission: string, brief: string): void {
  const at = chapterOf(mission);
  lead.innerHTML = at ? `<span class="ms-tag">${esc(threadTag(mission))}</span><span class="ms-before">${esc(at.chapter.before)}</span>${esc(brief)}` : esc(brief);
}

/** For the end screen of a mission: the thread's line after it, and the next mission, if it was won. */
export function storyEnd(mission: string | undefined, win: boolean): string {
  const at = mission ? chapterOf(mission) : undefined;
  if (!at || !win) return '';
  const next = nextInThread(mission!), m = next ? missionById(next) : undefined;
  return `<div class="ms-after"><p>${esc(at.chapter.after)}</p>${m ? `<a class="ms-next" href="?mission=${m.id}">Next in ${esc(at.thread.name)}: ${esc(m.name)}</a>` : `<p class="ms-end">So ends ${esc(at.thread.name)}.</p>`}</div>`;
}

/** The thread's tag for a mission in the list of missions, or ''. */
export const storyTag = (mission: string): string => (threadTag(mission) ? `<em class="ms-tag">${esc(threadTag(mission))}</em>` : '');
