// The slow-map mark is stamped (src/client/detail.ts): a mark made while the battle was still drawn under the
// campaign map ('1') is forgotten once on load; a mark made since (SLOW_STAMP) keeps the plainer map.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SLOW_MS, SLOW_STAMP, slowMark, staleMark } from '../src/client/detail';

/** A fresh copy of detail.ts in a page with this storage, a strong machine and nothing typed in the address. */
async function page(stored: Record<string, string>) {
  const store = new Map(Object.entries(stored));
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('navigator', { hardwareConcurrency: 12, deviceMemory: 8 });
  vi.resetModules();
  const d = await import('../src/client/detail');
  return { d, store };
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('the slow-map mark', () => {
  it('only a mark made since the battle sleeps counts as slow; the old one is stale', () => {
    expect(slowMark(SLOW_STAMP)).toBe(true);
    expect(slowMark('1')).toBe(false);
    expect(slowMark('0')).toBe(false);
    expect(slowMark(null)).toBe(false);
    expect(staleMark('1')).toBe(true);
    expect(staleMark(SLOW_STAMP)).toBe(false);
  });

  it('an old mark is forgotten on load, so a strong machine has the full map again', async () => {
    const { d, store } = await page({ 'rtsv-map-slow': '1' });
    expect(d.lowDetail()).toBe(false);
    expect(store.get('rtsv-map-slow')).toBe('0');
  });

  it('a mark made since stands, and a slow full map now makes one', async () => {
    const kept = await page({ 'rtsv-map-slow': SLOW_STAMP });
    expect(kept.d.lowDetail()).toBe(true);
    expect(kept.store.get('rtsv-map-slow')).toBe(SLOW_STAMP);
    const fresh = await page({});
    expect(fresh.d.lowDetail()).toBe(false);
    fresh.d.reportMapTime(SLOW_MS + 1, false);
    expect(fresh.store.get('rtsv-map-slow')).toBe(SLOW_STAMP);
  });
});
