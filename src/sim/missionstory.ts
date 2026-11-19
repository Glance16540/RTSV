// A thread through the missions (docs/systems-board, "Missions": each stood alone, with no story carried from one to
// the next).
//
// "The Riders from the East" ties three of them together by the people they share, the riders of the steppe, and one
// leader of theirs, Khatun Sarnai (the Mongols' leader in every battle, leaders.ts):
//   1. First Hearth: the Franks settle a quiet valley, and hear of the riders far to the east;
//   2. The Sea of Grass: the player rides as Sarnai's war band, and takes the Persian river;
//   3. Hold the Line: Sarnai's sons come west in waves, and the Romans of the border hold them.
// Each has a line before it, told with its brief, and a line after it, told when it is won, with the next offered.
// Words only: nothing here changes a mission's rules.

/** One mission's place in a thread. */
export interface Chapter { mission: string; before: string; after: string }
/** A thread of missions. */
export interface Thread { id: string; name: string; chapters: Chapter[] }

export const THREADS: Thread[] = [
  {
    id: 'riders', name: 'The Riders from the East',
    chapters: [
      { mission: 'hearth',
        before: 'Far beyond the hills, men say, lies a sea of grass, and a people who live on horseback. Here it is quiet. A few families of the Franks have come over the pass into an empty valley.',
        after: 'The valley held, and its barns filled. Travellers coming over the pass brought word from the east: the riders of the grass had a Khatun now, Sarnai, and were on the move.' },
      { mission: 'grass',
        before: 'Far to the east, Khatun Sarnai\'s band rides the open grass with no hall and no fields. Beyond the grass the Persians farm a river.',
        after: 'Sarnai raised her hall by the Persian river. Her sons grew up in the saddle, and when she died they rode west.' },
      { mission: 'line',
        before: 'Sarnai\'s sons have come west at last, in waves, each larger than the last. The Romans of the border have a palisade, two towers and a few soldiers.',
        after: 'The border held. The riders turned back to the grass, and the valleys of the west were left in peace for a lifetime.' },
    ],
  },
];

/** Where a mission stands in a thread: the thread, its chapter, and which of how many it is. Undefined if it is in none. */
export function chapterOf(mission: string): { thread: Thread; chapter: Chapter; n: number; of: number } | undefined {
  for (const thread of THREADS) {
    const i = thread.chapters.findIndex((c) => c.mission === mission);
    if (i >= 0) return { thread, chapter: thread.chapters[i], n: i + 1, of: thread.chapters.length };
  }
  return undefined;
}

/** The mission that comes after this one in its thread, if any. */
export function nextInThread(mission: string): string | undefined {
  const at = chapterOf(mission);
  return at && at.n < at.of ? at.thread.chapters[at.n].mission : undefined;
}

/** A short tag for the list of missions: "The Riders from the East, 1 of 3". */
export function threadTag(mission: string): string {
  const at = chapterOf(mission);
  return at ? `${at.thread.name}, ${at.n} of ${at.of}` : '';
}
