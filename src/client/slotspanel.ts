// The campaign menu's page of worlds (src/sim/slots.ts): every world kept, by its people and house, with the turn
// and the day it was last played; go back to any of them, begin a new one without losing the rest, or delete one
// (asked twice). It opens beside the main menu like its other pages.
import { CIVS } from '../sim/data';
import { MAX_SLOTS, SlotInfo, activeSlot, beginNew, deleteSlot, freeSlot, listSlots, setActive } from '../sim/slots';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const day = (ms: number): string => (ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'before worlds were kept apart');

export interface SlotsHooks {
  /** Open a page beside the menu (Title.show). */
  show(name: string): void;
  /** Leave for the campaign map with this query. */
  go(query: string): void;
  /** What a new world is begun with (people, rivals), as the menu's choices stand. */
  newQuery(): string;
}

/** A world's row. */
function row(w: SlotInfo, playing: boolean): string {
  const civ = CIVS[w.civ];
  const state = w.stale ? '' : w.over ? (w.won ? ' · <b class="good">won</b>' : ' · <b class="bad">lost</b>') : '';
  return `<div class="slot${playing ? ' playing' : ''}" data-slot="${w.slot}">
    <div class="slot-who">${civ ? civ.icon + ' ' : ''}<b>${esc(w.people)}</b>${w.house ? ` <small>the House of ${esc(w.house)}</small>` : ''}</div>
    <div class="slot-when">${w.stale ? 'It cannot be played; it can be deleted.' : `Turn ${w.turn}${state} · last played ${esc(day(w.played))}`}${playing ? ' · <i>the last one played</i>' : ''}</div>
    <div class="slot-do">${w.stale ? '' : '<button data-do="play">Play</button>'}<button data-do="delete" class="slot-del">Delete</button></div>
  </div>`;
}

/** The page's HTML as things stand. */
export function slotsHtml(store: Storage): string {
  const worlds = listSlots(store), playing = activeSlot(store), free = freeSlot(store);
  return `<h2>Campaigns</h2><p class="slots-lead">Every world you play is kept, each with its own history. Go back to any of them, or begin another: up to ${MAX_SLOTS}.</p>` +
    (worlds.length ? worlds.map((w) => row(w, w.slot === playing)).join('') : '<p>No world is kept yet.</p>') +
    `<div class="slots-new"><button data-do="new" ${free === null ? 'disabled title="Every place is taken: delete a world first."' : ''}>🌍 Begin a new world</button><small>${free === null ? 'Every place is taken: delete a world to begin another.' : 'It is made with the people and rivals chosen under Skirmish.'}</small></div>`;
}

let page: HTMLElement | null = null;
/** The Campaign button: with no world kept it begins one at once, as it always did; otherwise it opens the page of worlds. */
export function openCampaigns(hooks: SlotsHooks, store: Storage = localStorage): void {
  if (!listSlots(store).length) { beginNew(store); hooks.go(`?campaign=1&${hooks.newQuery()}`); return; }
  if (!page) {
    page = document.createElement('div');
    page.dataset.for = 'campaigns';
    page.className = 'slots hidden';
    document.querySelector('#t-panel .t-scroll')!.append(page);
    page.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-do]');
      if (!b || b.disabled) return;
      const n = Number(b.closest<HTMLElement>('[data-slot]')?.dataset.slot);
      if (b.dataset.do === 'play') { setActive(store, n); hooks.go('?campaign=1'); }
      else if (b.dataset.do === 'new') { if (beginNew(store) !== null) hooks.go(`?campaign=1&${hooks.newQuery()}`); }
      else if (b.dataset.do === 'delete') {
        // Asked twice: the first click asks, the second deletes.
        if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Delete it for good?'; b.classList.add('sure'); return; }
        deleteSlot(store, n);
        page!.innerHTML = slotsHtml(store);
      }
    });
  }
  page.innerHTML = slotsHtml(store);
  hooks.show('campaigns');
}
/** What the Campaign button says of the worlds kept. */
export function campaignsNote(store: Storage = localStorage): string {
  const n = listSlots(store).filter((w) => !w.stale).length;
  return n ? `${n === 1 ? 'Your world is kept' : `${n} worlds are kept`}: go back to one, or begin another.` : '';
}
