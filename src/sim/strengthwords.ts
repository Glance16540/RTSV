// Strengths as a player reads them (docs/PLAYTEST.md, finding 12): whole numbers, with a word for how much that is,
// never "a strength of 0.9". The rules keep their fractions; only the telling rounds them. Plain data, no DOM.

/** A strength as a whole number; under a half is "a little". */
export const whole = (x: number): string => (x > 0 && x < 0.5 ? 'a little' : String(Math.round(x)));

/** What a band's or a force's strength amounts to, in a word. */
export function strengthWord(x: number): string {
  return x < 2 ? 'weak' : x < 5 ? 'middling' : x < 9 ? 'strong' : 'very strong';
}

/** "a strength of 6 (strong)". */
export const strengthOf = (x: number): string => `a strength of ${whole(x)} (${strengthWord(x)})`;

/** A total told after its parts: "about" when the rounded parts would not add up to it. */
export function inAll(parts: number[], total: number): string {
  const sum = parts.reduce((n, p) => n + (p > 0 && p < 0.5 ? 0 : Math.round(p)), 0);
  return `${sum === Math.round(total) ? '' : 'about '}${whole(total)} in all`;
}
