// Writes docs/VOICE_SCRIPT.md: every leader line, with the filename to record it under.
// Run with `npm run voice-script` after changing src/sim/leaders.ts.
import { writeFileSync } from 'node:fs';
import { EVENT_NOTES, LEADERS, LEADER_EVENTS, lineKey } from '../src/sim/leaders.ts';

let out = `# Voice script

Every line a leader can say, and the filename to record it under. Save each recording in
\`public/assets/voice/\` as mp3, ogg, wav or m4a (for example \`steppe_attack_2.mp3\`) and
restart \`npm run dev\`: the game plays it whenever that line appears. Lines without a recording
are shown as text only, so recordings can be added a few at a time.

Lines run two to six seconds. A portrait named \`leader_<people>.png\` in
\`public/assets/icons/\` replaces the placeholder face.

This file is generated from \`src/sim/leaders.ts\`; edit the lines there and run
\`npm run voice-script\`.
`;
let total = 0;
for (const l of Object.values(LEADERS)) {
  out += `\n## ${l.name} — ${l.title}\n\n**Direction:** ${l.voice}\n\n| File | When | Line |\n| --- | --- | --- |\n`;
  for (const ev of LEADER_EVENTS) {
    l.lines[ev].forEach((text, i) => { out += `| \`${lineKey(l.civ, ev, i)}\` | ${EVENT_NOTES[ev]} | ${text} |\n`; total++; });
  }
}
out += `\n${total} lines in all.\n`;
writeFileSync('docs/VOICE_SCRIPT.md', out);
console.log(`voice script: ${total} lines for ${Object.keys(LEADERS).length} leaders`);
