// A band coming for one of the player's towns, met face to face (src/sim/bandmeet.ts; the window is encounter.ts).
// "The Red Hands march on Ironcrag. Go out to meet them?" Fight in person, leave it to the army, or let them come.
import type { Campaign } from '../sim/campaign';
import { resolvePending } from '../sim/campaign';
import { armyStrength } from '../sim/campaignbase';
import { BANDS } from '../sim/threats';
import { bandLineup } from '../sim/encounter';
import { askedOf, bandComing, goOut, struckToTell, toldStrikes } from '../sim/bandmeet';
import { strengthOf } from '../sim/strengthwords';
import { EncounterChoice, openEncounter } from './encounter';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);

export interface MeetHooks {
  /** Enter the pending battle in person. */ fight: () => void;
  /** The campaign changed: save, draw, and ask whatever is next. */ changed: () => void;
  /** The map's plain question, for where the figures cannot be drawn. */ dialog: (title: string, text: string, buttons: [string, () => void][]) => void;
}

/** If a band is coming for a town of the player's and an army can meet it, put it to them, once. Returns whether something was asked. */
export function meetComing(c: Campaign, hooks: MeetHooks): boolean {
  const coming = bandComing(c);
  if (!coming) return false;
  const { band: b, mark, marching, army } = coming, kind = BANDS[b.kind], town = c.territories[mark].name, name = cap(b.name);
  askedOf(c, b.id);
  const held = b.held.reduce((n, h) => n + h.men.length + h.women.length, 0);
  const title = marching ? `${name} march on ${town}` : `${name} have ${town} for their mark`;
  const plain = `${marching ? `They are at ${esc(c.territories[b.at].name)} and coming on.` : `They are camped at ${esc(c.territories[b.at].name)}, within reach of it.`} ` +
    `Your army at ${esc(c.territories[army.at].name)}, with ${strengthOf(armyStrength(army, c))}, can go out to meet them, who have ${strengthOf(b.strength)}. ` +
    (held ? `They hold ${held} ${held === 1 ? 'person' : 'people'}, who go free if the band is broken. ` : '') +
    'Fight them yourself, leave it to the army, or let them come and trust to the town\'s own defence.';
  const out = (then: () => void) => () => { if (goOut(c, coming)) then(); else hooks.changed(); };
  const choices: [string, () => void][] = [
    ['Go out and fight them', out(hooks.fight)],
    ['Send the army', out(() => { resolvePending(c, 'auto'); hooks.changed(); })],
    ['Let them come', hooks.changed],
  ];
  const text = `<span class="enc-who">${kind.icon} <b>${esc(name)}</b>, ${esc(kind.name.toLowerCase())}.</span>${plain}`;
  if (openEncounter({ title: esc(title), text, figures: bandLineup(c, b), choices: choices as EncounterChoice[] })) document.getElementById('ow-dialog')?.classList.add('hidden');
  else hooks.dialog(esc(title), plain, choices);
  return true;
}

/** If a band got into a town of the player's this season, tell them face to face what it came to, once. Returns whether something was shown. */
export function tellStrikes(c: Campaign, hooks: MeetHooks): boolean {
  const struck = struckToTell(c);
  if (!struck) return false;
  toldStrikes(c);
  const plain = struck.lines.map(esc).join(' ');
  const choices: [string, () => void][] = [['So be it', hooks.changed]];
  const b = struck.band;
  if (b && openEncounter({ title: esc(struck.title), text: `<span class="enc-who">${BANDS[b.kind].icon} <b>${esc(cap(b.name))}</b>, ${esc(BANDS[b.kind].name.toLowerCase())}, with ${strengthOf(b.strength)}.</span>${plain}`, figures: bandLineup(c, b), choices: choices as EncounterChoice[] })) document.getElementById('ow-dialog')?.classList.add('hidden');
  else hooks.dialog(esc(struck.title), plain, choices);
  return true;
}
