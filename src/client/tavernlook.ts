// How a tavern shows what kind of house it is, without showing anything that happens in it: its lamp and the light
// it throws by night, and what is said on its panel. The rule is `src/sim/tavernfall.ts`.
import { MAID_GOLD } from '../sim/creed';
import { TAVERN, tavernTrade } from '../sim/tavernfall';

/** The tavern's lamp by night: dark once it has shut, a plain warm lamp, a brighter amber one, or red lanterns. */
export function tavernLight(virtue: number, dayT: number): { on: boolean; lamp: number; pool: number; strength: number } {
  const t = tavernTrade(virtue, dayT);
  if (t.tier === 'decadent') return { on: true, lamp: 0xff5a3c, pool: 0xff3a2a, strength: 1.35 };
  if (t.tier === 'worldly') return { on: t.open, lamp: 0xffb45a, pool: 0xff9a40, strength: 1.15 };
  return { on: t.open, lamp: 0xffd080, pool: 0xffa850, strength: 1 };
}

/** The lines on a tavern's panel: what kind of house it is, its hours, and the gold its women are bringing in now. */
export function tavernPanel(virtue: number, dayT: number, women: number): string {
  const t = tavernTrade(virtue, dayT), k = TAVERN[t.tier];
  const now = Math.round(women * MAID_GOLD * t.gold * 60);
  return `<div class="tavernfall ${t.tier}"><b>${k.name}</b> · ${k.hours}${t.open ? '' : ' · shut for the night'}<br>` +
    `💰 ${now} gold a minute now${k.gold > 1 ? ` (each of its women brings in ${Math.round(k.gold * 100)}% of what an honest house would)` : ''}</div>`;
}
