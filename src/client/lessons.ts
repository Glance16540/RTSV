// A slip under the first-steps guide that teaches a thing the first time it happens in a battle (src/sim/lessons.ts).
import type { Game } from '../sim/game';
import { nextLesson } from '../sim/lessons';

const KEY = 'rtsv-lessons';
/** Seconds a lesson stays up if it is not put away by hand. */
const STAY = 45;

let told: string[] | null = null, off = false, box: HTMLElement | null = null, upAt = 0, lastCheck = -1;

function load(): string[] {
  if (told) return told;
  told = [];
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (Array.isArray(s.told)) told = s.told.filter((x: unknown) => typeof x === 'string');
    off = !!s.off;
  } catch { /* no storage: every lesson is told again */ }
  return told!;
}
const keep = (): void => { try { localStorage.setItem(KEY, JSON.stringify({ told, off })); } catch { /* storage unavailable */ } };

function close(): void {
  box?.classList.add('hidden');
  upAt = 0;
}

/** Called with the rest of the heads-up display. `quiet` is true while a mission's own objectives or a pause hold the screen. */
export function updateLessons(game: Game, pid: number, quiet: boolean): void {
  const guide = document.getElementById('guide');
  if (!guide) return;
  if (!box) {
    box = document.createElement('div');
    box.id = 'lesson';
    box.className = 'hidden';
    guide.after(box);
    box.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      if (b.dataset.lesson === 'off') { off = true; keep(); }
      close();
    });
  }
  const list = load();
  if (upAt) {
    // It sits beneath the guide, wherever the guide's foot now is.
    box.style.top = `${guide.classList.contains('hidden') ? 50 : guide.offsetTop + guide.offsetHeight + 8}px`;
    if (quiet || game.time - upAt > STAY || game.time < upAt) close();
    return;
  }
  const sec = Math.floor(game.time);
  if (off || quiet || sec === lastCheck) return;
  lastCheck = sec;
  const l = nextLesson(game, pid, list);
  if (!l) return;
  list.push(l.id);
  keep();
  upAt = game.time || 0.001;
  box.innerHTML = `<h4>${l.title}<button title="Put this away">✕</button></h4><p>${l.text}</p><button class="lesson-off" data-lesson="off">Tell me no more of these</button>`;
  box.classList.remove('hidden');
  box.style.top = `${guide.classList.contains('hidden') ? 50 : guide.offsetTop + guide.offsetHeight + 8}px`;
}
