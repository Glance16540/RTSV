// How finely the campaign map is drawn: a setting, and a guess for a machine that has not been given one.
// The full map is heavy. The plainer one (smaller paint, coarser ground, simpler trees) is for a weak machine:
// it is chosen in Settings, forced by `?detail=low` or `?detail=high` in the address, or picked automatically.

export type Detail = 'auto' | 'low' | 'high';
export const DETAILS: Record<Detail, string> = { auto: 'Automatic', high: 'Full', low: 'Plainer (faster)' };
const KEY = 'rtsv-map-detail', SLOW_KEY = 'rtsv-map-slow';
/** A map that took longer than this to appear was too much for the machine. */
export const SLOW_MS = 9000;

/** What is known of the machine. Every part is optional: a browser tells only some of it. */
export interface Machine { renderer?: string; cores?: number; memory?: number; maxTexture?: number; slow?: boolean }
/** Whether a machine is one to spare: it draws in software, is small, or has already been seen to struggle. */
export function weakMachine(m: Machine): boolean {
  if (m.slow) return true;
  if (m.renderer && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(m.renderer)) return true;
  if (m.maxTexture !== undefined && m.maxTexture < 4096) return true;
  if (m.memory !== undefined && m.memory <= 2) return true;
  return m.cores !== undefined && m.cores <= 2;
}
/** Which map to draw, given what was typed into the address, what was chosen in Settings and what the machine is. */
export function chooseDetail(typed: string | null, pref: Detail, m: Machine): 'low' | 'high' {
  if (typed === 'low' || typed === 'high') return typed;
  if (pref !== 'auto') return pref;
  return weakMachine(m) ? 'low' : 'high';
}

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, v: string): void => { try { localStorage.setItem(key, v); } catch { /* storage unavailable */ } };
export const detailPref = (): Detail => { const v = read(KEY); return v === 'low' || v === 'high' ? v : 'auto'; };

let known: Machine | null = null;
/** Ask the browser what it will say of the machine. Asked once: it costs a throwaway drawing surface. */
function machine(): Machine {
  if (known) return { ...known, slow: read(SLOW_KEY) === '1' };
  const m: Machine = {};
  try {
    m.cores = navigator.hardwareConcurrency || undefined;
    m.memory = (navigator as { deviceMemory?: number }).deviceMemory;
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      m.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      m.renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* a browser that will not say is treated as able */ }
  known = m;
  return { ...m, slow: read(SLOW_KEY) === '1' };
}
/** Whether the campaign map should be the plainer one, as things stand now. */
export const lowDetail = (): boolean => typeof location !== 'undefined' && chooseDetail(new URLSearchParams(location.search).get('detail'), detailPref(), machine()) === 'low';
/** The map reports how long it took to appear. A full map that was too slow is remembered, so Automatic draws the plainer one next time. */
export function reportMapTime(ms: number, low: boolean): void {
  if (!low && ms > SLOW_MS) write(SLOW_KEY, '1');
}

/** Put the choice in Settings. It is added by script, in a block of its own, so the settings page itself is not touched. */
export function mountDetailSetting(): void {
  const settings = document.getElementById('settings');
  if (!settings || document.getElementById('pref-map')) return;
  const label = document.createElement('label');
  label.className = 'pref-map';
  label.title = 'Automatic draws the plainer map on a machine that draws in software, is small, or was slow to draw the full one. Takes effect the next time the campaign map is opened.';
  label.innerHTML = `Campaign map <select id="pref-map">${(Object.keys(DETAILS) as Detail[]).map((k) => `<option value="${k}">${DETAILS[k]}</option>`).join('')}</select>`;
  settings.append(label);
  const select = label.querySelector('select')!;
  const show = (): void => { (select.querySelector('option[value="auto"]') as HTMLOptionElement).textContent = `${DETAILS.auto} (${weakMachine(machine()) ? 'plainer' : 'full'} here)`; };
  select.value = detailPref();
  show();
  select.addEventListener('change', () => {
    write(KEY, select.value);
    if (select.value === 'auto') write(SLOW_KEY, '0'); // choosing Automatic again gives the full map another chance to prove itself
    show();
  });
}
