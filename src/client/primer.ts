// Teaching the campaign on the campaign screen: a slip of first orders over the map, and the page behind it.
// It stands apart from the campaign screen's own code and is told of a change through the save hook.

import { Campaign } from '../sim/campaign';
import { PrimerBase, primerBase, primerPage, primerSteps } from '../sim/primer';

const KEY = 'rtsv-primer';
interface Kept { base: PrimerBase; seen: string[]; off: boolean }

/** The campaign's page as HTML, for the sheet here and for How to play on the main menu. */
export function primerHtml(c?: Campaign): string {
  return '<div class="primer-page">' + primerPage(c).map((s) =>
    `<section><h3>${s.title}</h3>${s.lines.map((l) => `<p>${l}</p>`).join('')}</section>`).join('') + '</div>';
}

export class CampaignPrimer {
  private slip = document.createElement('div');
  private kept: Kept;
  private sig = '';

  constructor(private c: Campaign) {
    let kept: Kept | null = null;
    try { kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Kept | null; } catch { /* storage unavailable */ }
    // A new world starts the orders again; whether they are wanted at all is remembered across worlds.
    this.kept = kept && kept.base?.seed === c.seed ? kept : { base: primerBase(c), seen: [], off: kept?.off ?? false };
    this.slip.id = 'primer';
    // Under the campaign's own dialogs, so that a battle or a tale put to the player is never covered.
    document.getElementById('ow-dialog')!.before(this.slip);
    this.slip.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-primer]')?.dataset.primer;
      if (act === 'off' || act === 'on') this.kept.off = act === 'off';
      else if (act === 'skip') { const now = this.now(); if (now) this.kept.seen.push(now.id); }
      else if (act === 'page') this.page();
      else return;
      this.update();
    });
    this.update();
  }

  private now() {
    return primerSteps(this.c, this.kept.base, this.kept.seen).find((s) => !s.done);
  }

  /** The campaign has changed: mark what has been done and show the next order. */
  update(): void {
    const steps = primerSteps(this.c, this.kept.base, this.kept.seen);
    this.kept.seen = steps.filter((s) => s.done).map((s) => s.id);
    try { localStorage.setItem(KEY, JSON.stringify(this.kept)); } catch { /* storage unavailable */ }
    const i = steps.findIndex((s) => !s.done);
    const sig = `${this.kept.off}|${i}|${steps[i]?.how}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.slip.classList.toggle('folded', this.kept.off || i < 0);
    if (this.kept.off || i < 0) {
      // Put away, it leaves a tab to bring it back by, and the page is still a click off.
      this.slip.innerHTML = (i >= 0 ? '<button data-primer="on" title="Show the first orders again">First orders</button>' : '') + '<button data-primer="page">How the campaign works</button>';
      return;
    }
    this.slip.innerHTML = `<h4>First orders ${i + 1}/${steps.length}<button data-primer="off" title="Put these away">✕</button></h4>` +
      (i > 0 ? `<div class="done">✓ ${steps[i - 1].title}</div>` : '') +
      `<div class="now"><b>${steps[i].title}</b><p>${steps[i].how}</p></div>` +
      `<div class="primer-foot"><button data-primer="page">How the campaign works</button>${i < steps.length - 1 ? '<button data-primer="skip" title="Pass over this one">Next ›</button>' : ''}</div>`;
  }

  /** The whole of it on one sheet, over the map. */
  private page(): void {
    const screen = document.createElement('div');
    screen.className = 'screen primer-screen';
    screen.innerHTML = `<div class="sheet"><h1>The campaign</h1><p class="lead">What there is to do in a world, and how it is won.</p>${primerHtml(this.c)}<button>Close</button></div>`;
    const close = (): void => { screen.remove(); window.removeEventListener('keydown', key); };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    screen.addEventListener('click', (e) => { if (e.target === screen || (e.target as HTMLElement).closest('.sheet > button')) close(); });
    window.addEventListener('keydown', key);
    document.getElementById('overworld')!.append(screen);
  }
}
