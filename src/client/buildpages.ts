// The villager's build menu in screens that fit the command card: thirteen buildings at most on each, the fourteenth
// place (key V) kept for turning to the next screen and the fifteenth (key B) for Stop, as every unit's card has it.
// A page of BUILD_PAGES too long for one screen is cut in even halves, in its own order. Plain data, no DOM.

/** Buildings on one screen of the card: two places are kept, for the page button and for Stop. */
export const PER_SCREEN = 13;

export interface BuildScreen { types: string[]; page: number; part: number; parts: number }

/** The screens of the build menu, page after page. */
export function buildScreens(pages: readonly (readonly string[])[], per = PER_SCREEN): BuildScreen[] {
  const out: BuildScreen[] = [];
  pages.forEach((list, page) => {
    const parts = Math.max(1, Math.ceil(list.length / per)), size = Math.ceil(list.length / parts);
    for (let part = 0; part < parts; part++) out.push({ types: list.slice(part * size, (part + 1) * size), page, part, parts });
  });
  return out;
}

const PAGE_NAMES = ['Settlement buildings', 'Military buildings'];
/** What a screen is called on the button that turns to it. */
export const screenName = (s: BuildScreen): string => `${PAGE_NAMES[s.page] ?? 'Buildings'}${s.parts > 1 ? ` (${s.part + 1} of ${s.parts})` : ''}`;
