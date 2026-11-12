// Writes docs/voice-booth.html: one self-contained page to send to whoever is voicing a leader.
// They pick a leader, record each line with their microphone, and download a zip of recordings
// named exactly as the game expects. Run with `npm run voice-booth` after changing the lines.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHARACTER_LIMITS, EVENT_NOTES, LEADERS, LEADER_EVENTS, lineKey, personaLines } from '../src/sim/leaders.ts';
import { CIVS, CIV_COLOR } from '../src/sim/data.ts';

// Most nations can be led by a man or by a woman: both are offered, and the recordings say which was voiced.
const leaders = Object.values(LEADERS).flatMap((l) => [[l, false], ...(l.alt ? [[l.alt, true]] : [])].map(([who, alt]) => {
  const lines = personaLines(l.civ, alt);
  return {
    civ: l.civ, persona: alt ? 'alt' : 'main', nation: CIVS[l.civ].name, name: who.name, title: who.title, voice: who.voice, female: who.female,
    color: '#' + CIV_COLOR[l.civ].toString(16).padStart(6, '0'),
    lines: LEADER_EVENTS.flatMap((ev) => lines[ev].map((text, i) => ({ key: lineKey(l.civ, ev, i), ev, i, when: EVENT_NOTES[ev], text }))),
  };
}));

// Stock portraits to choose from: public-domain works from The Metropolitan Museum of Art's Open Access
// collection, cropped small (see docs/PORTRAIT_CREDITS.md).
const stock = JSON.parse(readFileSync('scripts/portraits.json', 'utf8'));
const STOCK = Object.fromEntries(Object.entries(stock).map(([sex, list]) => [sex, list.map((p) => ({ jpg: p.jpg, title: p.title + (p.date ? ', ' + p.date : '') }))]));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hearth &amp; Empire — Voice Booth</title>
<style>
  :root { --bg: #14110d; --panel: #201a13; --edge: #4a3c28; --fg: #efe6d2; --dim: #b3a58a; --gold: #e2b85a; --good: #7fc77a; --warn: #e0705a; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { max-width: 820px; margin: 0 auto; padding: 24px max(16px, env(safe-area-inset-right)) 120px max(16px, env(safe-area-inset-left)); }
  h1 { font: 600 30px Georgia, 'Times New Roman', serif; color: var(--gold); margin: 0 0 4px; }
  h2 { font: 600 20px Georgia, serif; color: var(--gold); margin: 28px 0 8px; }
  p { margin: 0 0 12px; } .dim { color: var(--dim); } small { color: var(--dim); }
  ol { padding-left: 20px; margin: 0 0 12px; } li { margin-bottom: 4px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  button { font: inherit; color: var(--fg); background: #33291b; border: 1px solid var(--edge); border-radius: 6px; padding: 8px 12px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--gold); } button:disabled { opacity: 0.45; cursor: default; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .pick { text-align: left; display: flex; gap: 10px; align-items: center; border-left-width: 5px; }
  .seal { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font: 700 24px Georgia, serif; color: #fff4d6; text-shadow: 0 1px 2px #0009; border: 2px solid var(--gold); box-shadow: inset 0 0 10px #0007; background-size: cover; background-position: center; }
  .seal.big { width: 72px; height: 72px; font-size: 40px; }
  .head { display: flex; gap: 14px; align-items: center; } .head h2 { margin: 0; } .head p { margin: 0; } .pick b { display: block; } .pick small { display: block; }
  .card { background: var(--panel); border: 1px solid var(--edge); border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; }
  .card.done { border-color: #3f6a3c; }
  .when { font-size: 13px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .line { font: italic 20px/1.4 Georgia, serif; margin: 4px 0 10px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .rec.on { background: #7a2418; border-color: var(--warn); }
  .state { font-size: 14px; color: var(--dim); } .state.ok { color: var(--good); }
  input[type=text], textarea { font: inherit; color: var(--fg); background: #100d09; border: 1px solid var(--edge); border-radius: 6px; padding: 8px 10px; width: min(100%, 320px); }
  textarea.line { display: block; width: 100%; resize: vertical; min-height: 64px; font: italic 19px/1.4 Georgia, serif; }
  textarea.line.own { border-color: var(--gold); }
  textarea:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .fields input { width: 100%; } .fields label { display: block; font-size: 14px; color: var(--dim); }
  .stock { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
  .stock button { padding: 0; width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--edge); background-size: cover; background-position: center; }
  .stock button.on { border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold); }
  .link { background: none; border: none; padding: 0; color: var(--gold); text-decoration: underline; font-size: 14px; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; background: #0e0b08ee; border-top: 1px solid var(--edge); padding: 10px max(16px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
  .bar .in { max-width: 820px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
  .primary { background: #6a4e16; border-color: var(--gold); font-weight: 600; }
  .note { background: #2a1d12; border: 1px solid var(--edge); border-left: 4px solid var(--gold); border-radius: 6px; padding: 10px 12px; margin: 12px 0; }
  .err { color: var(--warn); }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <h1>Voice Booth</h1>
  <p class="dim">Hearth &amp; Empire, a 3D strategy game of rival nations — become the voice of one nation's leader.</p>

  <section id="choose">
    <p>You have been asked to voice a leader in the game. It takes about fifteen minutes.</p>
    <ol>
      <li>Pick your leader below. Most nations can be led by a man or by a woman; choose whichever you will voice.</li>
      <li>Make them yours: give them your own name, title and portrait, and rewrite any line into something you would rather say.</li>
      <li>Read each line aloud and record it. You can listen back and redo any line.</li>
      <li>Press <b>Download my recordings</b> and send that one file back to whoever invited you.</li>
    </ol>
    <div class="note">Nothing is uploaded anywhere. Your recordings stay in this browser tab until you download them, and are lost if you close it first.</div>
    <h2>Choose your leader</h2>
    <div class="grid" id="leaders"></div>
  </section>

  <section id="booth" hidden>
    <p><button id="back">← Choose a different leader</button></p>
    <div class="head"><span class="seal big" id="seal"></span><div><h2 id="who"></h2><p id="title" class="dim"></p></div></div>
    <div class="card">
      <b>Make this character your own</b>
      <p class="dim">The leader below is only a starting point. Rename them, change their title, give them a portrait, and rewrite any of their lines; in the campaign they will appear and speak as you made them. Leave anything as it is to keep it.</p>
      <div class="fields">
        <div><label for="cname">Their name</label><input type="text" id="cname" maxlength="${CHARACTER_LIMITS.name}"></div>
        <div><label for="ctitle">Their title</label><input type="text" id="ctitle" maxlength="${CHARACTER_LIMITS.title}"></div>
      </div>
      <span class="dim" style="font-size:14px">Their portrait <small>(optional; shown in a circle beside their words. Pick one of these for now, or use a picture of your own.)</small></span>
      <div class="stock" id="stock"></div>
      <div class="row"><label class="dim" style="font-size:14px" for="pic">Or your own picture:</label><input type="file" id="pic" accept="image/*"><button class="link" id="nopic" hidden>Remove the portrait</button></div>
      <p class="dim" style="font-size:12px;margin:8px 0 0">Portraits shown are public-domain works from The Metropolitan Museum of Art, Open Access.</p>
    </div>
    <div class="note"><b>How they were written</b> (play them your own way if you prefer): <span id="direction"></span></div>
    <p><label for="actor">Your name, for the credits <small>(optional)</small></label><br><input type="text" id="actor" maxlength="60" autocomplete="name"></p>
    <p class="dim">Tips: a quiet room, the microphone a hand's width from your mouth, and leave half a second of silence before you speak. Each line should run two to six seconds. Record as many or as few as you like; unrecorded lines stay as text in the game. Each box says when the leader speaks the line: keep your own version to that moment, and to one or two sentences.</p>
    <p id="micerr" class="err" hidden></p>
    <div id="lines"></div>
  </section>
</main>

<div class="bar" id="bar" hidden><div class="in">
  <span id="count" class="state"></span>
  <button id="save" class="primary" disabled>Download my recordings</button>
</div></div>

<script>
const LEADERS = ${JSON.stringify(leaders)};
const STOCK = ${JSON.stringify(STOCK)};
const $ = (id) => document.getElementById(id);
let leader = null;
let stream = null;
let active = null; // { rec, key } while a line is being recorded
const takes = new Map(); // line key -> { wav: Uint8Array, url }

// ---- choosing a leader ----
for (const l of LEADERS) {
  const b = document.createElement('button');
  b.className = 'pick';
  b.style.borderLeftColor = l.color;
  b.innerHTML = '<span class="seal"></span><span><b></b><small></small></span>';
  b.querySelector('.seal').textContent = monogram(l.name);
  b.querySelector('.seal').style.backgroundColor = l.color;
  b.querySelector('b').textContent = l.name;
  b.querySelector('small').textContent = l.nation + ' · ' + (l.female ? 'a woman' : 'a man') + ' · ' + l.lines.length + ' lines';
  b.addEventListener('click', () => open(l));
  $('leaders').appendChild(b);
}
$('back').addEventListener('click', () => {
  if ((takes.size || character() || picture) && !window.confirmLeave) { $('back').textContent = 'Your work on this leader will be lost. Click again to go back.'; window.confirmLeave = true; return; }
  window.confirmLeave = false;
  $('back').textContent = '← Choose a different leader';
  for (const t of takes.values()) URL.revokeObjectURL(t.url);
  takes.clear();
  $('booth').hidden = true; $('bar').hidden = true; $('choose').hidden = false;
  window.scrollTo(0, 0);
});

function open(l) {
  leader = l;
  $('cname').value = l.name;
  $('ctitle').value = l.title;
  setPicture(null);
  const sb = $('stock');
  sb.innerHTML = '';
  for (const s of STOCK[l.female ? 'woman' : 'man']) {
    const b = document.createElement('button');
    b.style.backgroundImage = 'url(' + s.jpg + ')';
    b.title = s.title;
    b.setAttribute('aria-label', 'Portrait: ' + s.title);
    b.addEventListener('click', () => {
      const bin = atob(s.jpg.split(',')[1]), data = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
      $('pic').value = '';
      setPicture({ data, ext: 'jpg', url: URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })), stock: b });
    });
    sb.appendChild(b);
  }
  heading();
  $('direction').textContent = l.voice;
  const box = $('lines');
  box.innerHTML = '';
  l.lines.forEach((ln, i) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.id = 'card-' + ln.key;
    c.innerHTML = '<div class="when"></div><textarea class="line" rows="2" maxlength="${CHARACTER_LIMITS.line}"></textarea><div class="row" style="margin-top:10px">' +
      '<button class="rec">● Record</button><button class="play" disabled>▶ Listen</button><span class="state"></span><button class="link reset" hidden>Put the original words back</button></div>';
    c.querySelector('.when').textContent = (i + 1) + ' of ' + l.lines.length + ' · ' + ln.when;
    const ta = c.querySelector('.line'), reset = c.querySelector('.reset');
    ta.value = ln.text;
    ta.setAttribute('aria-label', 'Line ' + (i + 1) + ': ' + ln.when);
    const changed = () => {
      const own = said(ta.value) !== ln.text && said(ta.value) !== '';
      ta.classList.toggle('own', own);
      reset.hidden = !own;
      const st = c.querySelector('.state');
      if (takes.has(ln.key) && takes.get(ln.key).text !== said(ta.value)) { st.textContent = 'The words changed after you recorded this. Record it again.'; st.className = 'state err'; }
      refresh();
    };
    ta.addEventListener('input', changed);
    reset.addEventListener('click', () => { ta.value = ln.text; changed(); });
    c.querySelector('.rec').addEventListener('click', () => toggle(ln.key));
    c.querySelector('.play').addEventListener('click', () => { const t = takes.get(ln.key); if (t) new Audio(t.url).play(); });
    box.appendChild(c);
  });
  $('choose').hidden = true; $('booth').hidden = false; $('bar').hidden = false;
  refresh();
  window.scrollTo(0, 0);
}

// The letter on a leader's seal: the first of their name, past any word of rank.
function monogram(name) {
  const RANKS = ['consul', 'augusta', 'khan', 'khatun', 'count', 'countess', 'lady', 'lord', 'master', 'jarl', 'pharaoh', 'king', 'queen', 'shah', 'shahbanu', 'strategos', 'archon', 'earl', 'emir', 'emira', 'sir', 'the', 'saint', 'prince', 'princess', 'duke', 'duchess', 'emperor', 'empress', 'chief', 'captain', 'general'];
  const words = name.split(/\\s+/).filter(Boolean);
  const w = words.find((x) => !RANKS.includes(x.toLowerCase())) || words[0] || '?';
  return Array.from(w)[0].toUpperCase();
}
// Their own picture for the leader, cut square and small enough to send.
let picture = null; // { data: Uint8Array, ext, url, stock?: the button it was picked from }
function setPicture(p) {
  if (picture) URL.revokeObjectURL(picture.url);
  picture = p;
  $('nopic').hidden = !p;
  if (!p) $('pic').value = '';
  for (const b of $('stock').children) b.classList.toggle('on', !!p && p.stock === b);
  if (leader) heading();
}
$('pic').addEventListener('change', async () => {
  const f = $('pic').files[0];
  if (!f) return;
  try {
    const img = await createImageBitmap(f);
    const side = Math.min(img.width, img.height), c = document.createElement('canvas');
    c.width = c.height = 256;
    // Portraits are taller than wide more often than not: keep the top, where the face is.
    c.getContext('2d').drawImage(img, (img.width - side) / 2, Math.max(0, (img.height - side) * 0.2), side, side, 0, 0, 256, 256);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    setPicture({ data: new Uint8Array(await blob.arrayBuffer()), ext: 'png', url: URL.createObjectURL(blob) });
  } catch (e) {
    setPicture(null);
    $('title').textContent = 'That file could not be read as a picture. Try a JPEG or PNG.';
  }
});
$('nopic').addEventListener('click', () => setPicture(null));
const said = (s) => s.replace(/[<>&"\`]/g, '').replace(/\\s+/g, ' ').trim();
function heading() {
  $('who').textContent = said($('cname').value) || leader.name;
  const seal = $('seal');
  seal.textContent = picture ? '' : monogram($('who').textContent);
  seal.style.backgroundColor = leader.color;
  seal.style.backgroundImage = picture ? 'url(' + picture.url + ')' : '';
  $('title').textContent = (said($('ctitle').value) || leader.title) + ' · ' + leader.nation;
  if (!$('booth').hidden) refresh();
}
$('cname').addEventListener('input', heading);
$('ctitle').addEventListener('input', heading);
// What they changed about the leader, in the form the game reads; null if they changed nothing.
function character() {
  const c = {}, lines = {};
  const name = said($('cname').value), title = said($('ctitle').value);
  if (name && name !== leader.name) c.name = name;
  if (title && title !== leader.title) c.title = title;
  for (const ln of leader.lines) {
    const t = said($('card-' + ln.key).querySelector('.line').value);
    if (t && t !== ln.text) { lines[ln.ev] = lines[ln.ev] || [null, null]; lines[ln.ev][ln.i] = t; }
  }
  if (Object.keys(lines).length) c.lines = lines;
  return Object.keys(c).length ? c : null;
}
function refresh() {
  const c = character(), own = c && c.lines ? Object.values(c.lines).flat().filter(Boolean).length : 0;
  $('count').textContent = takes.size + ' of ' + leader.lines.length + ' lines recorded' + (own ? ' · ' + own + ' in your own words' : '');
  $('save').disabled = (takes.size === 0 && !c && !picture) || !!active;
  $('save').textContent = takes.size ? 'Download my recordings' : 'Download my character';
}

// ---- recording ----
async function toggle(key) {
  if (active) { const was = active.key; active.rec.stop(); if (was === key) return; }
  $('micerr').hidden = true;
  try {
    stream = stream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    $('micerr').textContent = 'The browser would not give this page the microphone. Allow microphone access for this page and try again. If you opened this file straight from an email, save it to your computer first and open it in Chrome, Edge or Firefox.';
    $('micerr').hidden = false;
    return;
  }
  const card = $('card-' + key), btn = card.querySelector('.rec'), state = card.querySelector('.state');
  const chunks = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    active = null;
    btn.classList.remove('on');
    btn.textContent = '● Record again';
    state.textContent = 'Saving…';
    try {
      const wav = await toWav(new Blob(chunks, { type: rec.mimeType }));
      const old = takes.get(key);
      if (old) URL.revokeObjectURL(old.url);
      takes.set(key, { wav, text: said(card.querySelector('.line').value), url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })) });
      card.classList.add('done');
      card.querySelector('.play').disabled = false;
      state.textContent = '✓ Recorded, ' + ((wav.length - 44) / 2 / RATE).toFixed(1) + ' s';
      state.className = 'state ok';
    } catch (e) {
      state.textContent = 'That take could not be saved. Please try again.';
      state.className = 'state err';
    }
    refresh();
  };
  active = { rec, key };
  btn.classList.add('on');
  btn.textContent = '■ Stop';
  state.textContent = 'Recording…';
  state.className = 'state';
  rec.start();
  refresh();
  setTimeout(() => { if (active && active.rec === rec) rec.stop(); }, 20000); // nobody needs twenty seconds
}

// Every browser records in its own format, so each take is turned into a plain mono WAV the game can always play.
const RATE = 22050;
async function toWav(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const data = (await off.startRendering()).getChannelData(0);
  // Trim the silence at either end, keeping a short breath of it.
  let a = 0, b = data.length - 1;
  while (a < b && Math.abs(data[a]) < 0.012) a++;
  while (b > a && Math.abs(data[b]) < 0.012) b--;
  a = Math.max(0, a - RATE * 0.12 | 0); b = Math.min(data.length - 1, b + RATE * 0.2 | 0);
  const n = b - a + 1;
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, RATE, true); out.setUint32(28, RATE * 2, true);
  out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, data[a + i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Uint8Array(out.buffer);
}

// ---- download: a plain (uncompressed) zip, written by hand so the page needs nothing from the internet ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, 0, true);
    head.setUint32(14, crc, true); head.setUint32(18, f.data.length, true); head.setUint32(22, f.data.length, true); head.setUint16(26, name.length, true);
    parts.push(new Uint8Array(head.buffer), name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

$('save').addEventListener('click', () => {
  const who = $('actor').value.trim();
  const files = [...takes].map(([key, t]) => ({ name: key + '.wav', data: t.wav }));
  const made = character();
  const shown = (made && made.name) || leader.name;
  const readme = 'Recordings for ' + shown + ' (' + leader.nation + ') in Hearth & Empire.\\n' + (who ? 'Voiced by ' + who + '.\\n' : '') +
    (made ? 'A character of their own making, based on ' + leader.name + '.\\n' : '') +
    takes.size + ' of ' + leader.lines.length + ' lines.\\n\\nTo use them: copy every file in this folder into public/assets/voice/ in the game and restart it.\\n';
  files.push({ name: 'README.txt', data: new TextEncoder().encode(readme) });
  if (who) files.push({ name: 'credit_' + leader.civ + '.txt', data: new TextEncoder().encode(who) });
  // Tells the game which of the nation's two leaders these recordings are of.
  files.push({ name: 'persona_' + leader.civ + '.txt', data: new TextEncoder().encode(leader.persona) });
  if (picture) files.push({ name: 'portrait_' + leader.civ + '.' + picture.ext, data: picture.data });
  // The character they made of the leader: their name, title and any lines in their own words.
  if (made) files.push({ name: 'character_' + leader.civ + '.json', data: new TextEncoder().encode(JSON.stringify(made, null, 2)) });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zip(files));
  a.download = 'voice-' + leader.civ + (leader.persona === 'alt' ? '-alt' : '') + (who ? '-' + who.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '') + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  $('count').textContent = 'Downloaded. Send that file back to whoever invited you.';
});
window.addEventListener('beforeunload', (e) => { if (takes.size || (leader && !$('booth').hidden && (character() || picture))) { e.preventDefault(); e.returnValue = ''; } });
</script>
</body>
</html>
`;
writeFileSync('docs/voice-booth.html', page);
console.log(`voice booth: ${leaders.length} leaders to choose from, ${leaders.reduce((n, l) => n + l.lines.length, 0)} lines`);
