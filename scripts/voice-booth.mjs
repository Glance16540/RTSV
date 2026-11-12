// Writes docs/voice-booth.html: one self-contained page to send to whoever is voicing a leader.
// They pick a leader, record each line with their microphone, and download a zip of recordings
// named exactly as the game expects. Run with `npm run voice-booth` after changing the lines.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHARACTER_LIMITS, EVENT_NOTES, LEADERS, LEADER_EVENTS, lineKey, personaLines } from '../src/sim/leaders.ts';
import { CIVS, CIV_COLOR } from '../src/sim/data.ts';
import { TEMPER_AXES, TEMPER_QUESTIONS, TEMPER_WORDS } from '../src/sim/temper.ts';

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
// Paintings of the ancient world that drift behind the page, from the same museum collection.
const BACKDROPS = JSON.parse(readFileSync('scripts/backdrops.json', 'utf8')).map((b) => ({ jpg: b.jpg, title: b.title.split(',')[0], artist: b.artist }));
const STOCK = Object.fromEntries(Object.entries(stock).map(([sex, list]) => [sex, list.map((p) => ({ jpg: p.jpg, title: p.title + (p.date ? ', ' + p.date : '') }))]));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hearth &amp; Empire — Take the Throne</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap">
<style>
  /* A summons to a throne: ink-dark hall, gold leaf, parchment type; once a nation is chosen its colour takes the banners. */
  :root { --bg: #0d0f14; --hall: #141722; --panel: #1a1d29; --panel2: #212536; --edge: #343a50; --fg: #f1e7d0; --dim: #a9a595; --gold: #e3b655; --gold2: #f6dc94; --good: #86cf8f; --warn: #ef7d63; --nation: #b8862f;
    --display: 'Cinzel', 'Trajan Pro', Georgia, 'Times New Roman', serif; --quote: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; --ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color-scheme: dark; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 16px; }
  body { margin: 0; color: var(--fg); font: 16px/1.55 var(--ui); background: var(--bg); }
  main { max-width: 980px; margin: 0 auto; padding: 0 max(16px, env(safe-area-inset-right)) 140px max(16px, env(safe-area-inset-left)); }
  h1, h2, h3 { font-family: var(--display); font-weight: 700; letter-spacing: 0.02em; margin: 0; text-wrap: balance; }
  p { margin: 0 0 12px; } .dim { color: var(--dim); } small { color: var(--dim); }
  [hidden] { display: none !important; }
  .err { color: var(--warn); }

  /* the world behind the page: paintings that drift and give way to one another, under sparks from a fire */
  .world { position: fixed; inset: 0; z-index: -2; overflow: hidden; background: var(--bg); }
  .world i { position: absolute; inset: -6%; background-size: cover; background-position: center 30%; opacity: 0; transition: opacity 2.6s ease-in-out; will-change: transform, opacity; }
  .world i.on { opacity: 1; }
  .world i.a { animation: pan-a 22s linear infinite alternate; } .world i.b { animation: pan-b 22s linear infinite alternate; }
  @keyframes pan-a { from { transform: scale(1.02) translate(-1.5%, 1%); } to { transform: scale(1.16) translate(2%, -2%); } }
  @keyframes pan-b { from { transform: scale(1.16) translate(2%, 1.5%); } to { transform: scale(1.03) translate(-2%, -1%); } }
  .world::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #0d0f14eb 0%, #0d0f14a6 40%, #0d0f1438 68%, #0d0f1470 100%), linear-gradient(180deg, #0d0f1426 0%, #0d0f1400 30%, #0d0f14b8 80%, #0d0f14f2 100%); transition: background-color 1.2s; }
  body.inbooth .world::after { background-color: #0d0f14c4; }
  #sparks { position: fixed; inset: 0; z-index: -1; width: 100%; height: 100%; pointer-events: none; }
  .plate { position: fixed; right: max(14px, env(safe-area-inset-right)); top: 12px; z-index: 1; font: 500 11px var(--ui); letter-spacing: 0.08em; text-transform: uppercase; color: #f1e7d0aa; text-shadow: 0 1px 3px #000; text-align: right; transition: opacity 1s; }
  body.inbooth .plate { opacity: 0; }

  /* hero */
  .hero { position: relative; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 24px; align-items: center; padding: 56px 0 36px; min-height: min(78vh, 640px); }
  .hero h1, .hero .lede, .eyebrow { text-shadow: 0 2px 18px #000c; }
  .eyebrow { font: 600 12px var(--ui); letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); margin-bottom: 14px; }
  .hero h1 { font-size: clamp(38px, 6.4vw, 72px); line-height: 1.04; color: var(--gold2); animation: arrive 1.1s cubic-bezier(.2,.8,.2,1) both; }
  .hero .lede { animation: arrive 1.1s 0.25s cubic-bezier(.2,.8,.2,1) both; } .hero .cta { animation: arrive 1.1s 0.5s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes arrive { from { opacity: 0; transform: translateY(18px); } }
  .hero .lede { font: 500 clamp(20px, 2.4vw, 25px)/1.35 var(--quote); color: var(--fg); margin: 18px 0 24px; max-width: 30ch; }
  .cta { display: inline-block; font: 700 15px var(--display); letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; color: #1a1305; background: linear-gradient(180deg, var(--gold2), var(--gold)); padding: 13px 22px; border-radius: 4px; box-shadow: 0 6px 24px #e3b65533, inset 0 -2px 0 #0003; }
  .cta:hover { filter: brightness(1.08); transform: translateY(-1px); }
  .court { position: relative; height: 340px; }
  .court i { position: absolute; border-radius: 50%; background-size: cover; background-position: center; border: 3px solid var(--gold); box-shadow: 0 10px 30px #000a, 0 0 0 6px #0d0f14, 0 0 0 7px #e3b65555; animation: drift 9s ease-in-out infinite alternate; }
  .court i:nth-child(1) { width: 150px; height: 150px; left: 32%; top: 26%; z-index: 3; }
  .court i:nth-child(2) { width: 104px; height: 104px; left: 4%; top: 8%; animation-delay: -2s; }
  .court i:nth-child(3) { width: 112px; height: 112px; right: 2%; top: 4%; animation-delay: -4s; }
  .court i:nth-child(4) { width: 96px; height: 96px; left: 0; bottom: 6%; animation-delay: -1s; }
  .court i:nth-child(5) { width: 108px; height: 108px; right: 4%; bottom: 2%; animation-delay: -5s; }
  .court i:nth-child(6) { width: 78px; height: 78px; left: 36%; top: 0; animation-delay: -3s; }
  .court i:nth-child(7) { width: 82px; height: 82px; left: 40%; bottom: 0; animation-delay: -6s; }
  .court .empty { background: repeating-linear-gradient(45deg, #1a1d29, #1a1d29 6px, #212536 6px, #212536 12px); border-style: dashed; display: grid; place-items: center; font: 700 54px var(--display); font-style: normal; color: var(--gold); }
  @keyframes drift { from { transform: translateY(-6px); } to { transform: translateY(8px); } }

  /* the three steps */
  .path { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 8px 0 22px; }
  .path div { position: relative; background: linear-gradient(180deg, #212536e6, #1a1d29e6); backdrop-filter: blur(6px); border: 1px solid var(--edge); border-top: 3px solid var(--gold); border-radius: 6px; padding: 18px 18px 16px 74px; min-width: 0; }
  .path .num { position: absolute; left: 16px; top: 12px; font: 700 44px/1 var(--display); color: var(--gold); opacity: 0.9; }
  .path b { display: block; font: 700 17px var(--display); letter-spacing: 0.04em; margin-bottom: 4px; }
  .path span { color: var(--dim); font-size: 14px; }
  .fine { display: flex; flex-wrap: wrap; gap: 10px 28px; align-items: center; justify-content: space-between; color: var(--dim); font-size: 14px; border: 1px solid var(--edge); border-radius: 6px; padding: 12px 16px; background: #0a0c1099; }
  .fine label { color: var(--fg); }

  /* choosing */
  .sect { display: flex; align-items: baseline; gap: 14px; margin: 44px 0 16px; }
  .sect h2 { font-size: clamp(24px, 3.4vw, 34px); color: var(--gold); }
  .sect::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, var(--gold), transparent); opacity: 0.5; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .nation { --c: var(--gold); background: #1a1d29f2; border: 1px solid var(--edge); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
  .nation:hover { transform: translateY(-3px); border-color: var(--c); box-shadow: 0 14px 34px #0009; }
  .nation header { position: relative; padding: 18px 16px 14px; background: linear-gradient(135deg, var(--c), color-mix(in srgb, var(--c) 45%, #0d0f14)); }
  .nation header::after { content: ''; position: absolute; left: 0; right: 0; bottom: -9px; height: 10px; background: linear-gradient(135deg, var(--panel) 25%, transparent 25%) 0 0 / 20px 10px, linear-gradient(225deg, var(--panel) 25%, transparent 25%) 0 0 / 20px 10px; transform: scaleY(-1); }
  .nation h3 { font-size: 22px; letter-spacing: 0.12em; text-transform: uppercase; color: #fff8e6; text-shadow: 0 2px 6px #0008; }
  .nation .says { font: italic 500 17px/1.35 var(--quote); color: var(--fg); padding: 14px 16px 6px; flex: 1; }
  .nation .says::before { content: '“'; color: var(--c); font-size: 30px; line-height: 0; vertical-align: -8px; margin-right: 2px; }
  .nation .who { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 14px; }
  button { font: inherit; color: var(--fg); background: var(--panel2); border: 1px solid var(--edge); border-radius: 6px; padding: 9px 14px; cursor: pointer; transition: border-color 0.15s, background 0.15s, transform 0.15s; }
  button:hover:not(:disabled) { border-color: var(--gold); } button:disabled { opacity: 0.45; cursor: default; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible { outline: 2px solid var(--gold2); outline-offset: 2px; }
  .pick { position: relative; text-align: left; display: flex; gap: 12px; align-items: center; width: 100%; padding: 8px 12px 8px 8px; background: #0d0f1488; }
  .pick:hover:not(:disabled) { background: var(--panel2); transform: translateX(3px); }
  .pick b { display: block; font-weight: 600; } .pick small { display: block; }
  .pick .go { position: absolute; right: 12px; top: 50%; translate: 0 -50%; background: var(--panel2); padding: 4px 0 4px 10px; color: var(--gold); font: 700 12px var(--display); letter-spacing: 0.1em; text-transform: uppercase; opacity: 0; transition: opacity 0.15s; }
  .pick:hover .go, .pick:focus-visible .go { opacity: 1; }
  .seal { flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font: 700 24px var(--display); color: #fff4d6; text-shadow: 0 1px 2px #0009; border: 2px solid var(--gold); box-shadow: inset 0 0 10px #0007; background-size: cover; background-position: center; }

  /* the booth */
  .back { margin: 20px 0 0; }
  .head { position: relative; display: flex; gap: 22px; align-items: center; margin: 14px 0 0; padding: 28px 24px; border-radius: 10px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--nation) 60%, #000);
    background: radial-gradient(600px 240px at 0% 0%, color-mix(in srgb, var(--nation) 75%, transparent), transparent 70%), linear-gradient(135deg, color-mix(in srgb, var(--nation) 40%, #0d0f14), #12141c 70%); box-shadow: 0 18px 50px #0008; }
  .head .eyebrow { margin: 0 0 6px; color: var(--gold2); }
  .head h2 { font-size: clamp(26px, 4.4vw, 44px); line-height: 1.08; color: #fff8e6; text-shadow: 0 2px 10px #0009; overflow-wrap: anywhere; }
  .head p { margin: 6px 0 0; font: 500 20px var(--quote); color: var(--fg); }
  .seal.big { width: 116px; height: 116px; font-size: 62px; border-width: 4px; box-shadow: 0 10px 30px #000a, 0 0 0 6px #0d0f1499, 0 0 0 7px #e3b65566, inset 0 0 18px #0008; }
  .steps { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; padding: 10px 0; background: linear-gradient(180deg, var(--bg) 70%, transparent); }
  .steps a { color: var(--fg); text-decoration: none; border: 1px solid var(--edge); border-radius: 999px; padding: 7px 14px; font: 600 14px var(--ui); display: inline-flex; gap: 8px; align-items: center; background: var(--panel); }
  .steps a:hover { border-color: var(--gold); } .steps a.done { border-color: var(--good); }
  .tick { width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--dim); display: inline-grid; place-items: center; font-size: 11px; line-height: 1; }
  .done .tick { background: var(--good); border-color: var(--good); color: #10200f; } .done .tick::after { content: '✓'; }
  .part .tick { border-color: var(--gold); background: #6a4e16; }
  .step { display: flex; align-items: center; gap: 16px; margin: 40px 0 14px; scroll-margin-top: 70px; }
  .step .num { flex: none; width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; font: 700 26px var(--display); color: #1a1305; background: linear-gradient(180deg, var(--gold2), var(--gold)); box-shadow: 0 0 0 5px #e3b65522; }
  .step h2 { font-size: clamp(22px, 3vw, 30px); color: var(--fg); } .step small { display: block; font: 400 14px var(--ui); letter-spacing: 0; margin-top: 2px; }
  .card { background: linear-gradient(180deg, var(--panel2), var(--panel)); border: 1px solid var(--edge); border-radius: 8px; padding: 18px 20px; margin-bottom: 12px; }
  .card > b:first-child { font: 700 17px var(--display); letter-spacing: 0.04em; color: var(--gold2); display: block; margin-bottom: 4px; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 14px 0; }
  .fields input { width: 100%; font: 600 19px var(--quote); } .fields label { display: block; font: 600 11px var(--ui); letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); margin-bottom: 4px; }
  input[type=text], textarea { font: inherit; color: var(--fg); background: #0a0c10; border: 1px solid var(--edge); border-radius: 6px; padding: 10px 12px; width: min(100%, 340px); }
  input[type=file] { color: var(--dim); max-width: 100%; }
  .stock { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0 14px; }
  .stock button { padding: 0; width: 72px; height: 72px; border-radius: 50%; border: 2px solid var(--edge); background-size: cover; background-position: center; }
  .stock button:hover { transform: scale(1.12); border-color: var(--gold); z-index: 1; }
  .stock button.on { border-color: var(--gold2); box-shadow: 0 0 0 3px var(--gold), 0 8px 20px #000a; transform: scale(1.08); }
  .q { margin: 20px 0 0; border: 0; padding: 0; min-width: 0; } .q b { display: block; margin-bottom: 8px; font: 600 21px/1.3 var(--quote); }
  .q label { display: flex; gap: 10px; align-items: baseline; padding: 10px 14px; border: 1px solid var(--edge); border-radius: 6px; margin-bottom: 6px; cursor: pointer; background: #0d0f1488; transition: border-color 0.15s, background 0.15s, transform 0.15s; }
  .q label:hover { border-color: var(--gold); transform: translateX(3px); }
  .q label:has(input:checked) { border-color: var(--gold); background: linear-gradient(90deg, #6a4e1655, #6a4e1611); box-shadow: inset 3px 0 0 var(--gold); }
  .q input { accent-color: var(--gold); }
  .traits { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 20px; padding: 16px; border-radius: 8px; background: #0a0c10; border: 1px solid var(--gold); }
  .trait { font-size: 14px; } .trait b { color: var(--gold2); display: block; font: 700 17px var(--display); letter-spacing: 0.03em; }
  .meter { position: relative; height: 6px; border-radius: 3px; background: var(--panel2); margin: 8px 0 4px; }
  .meter i { position: absolute; top: -5px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 3px #e3b65533; transition: left 0.4s cubic-bezier(.2,.9,.3,1.2); }
  .ends { display: flex; justify-content: space-between; font-size: 11px; color: var(--dim); }
  .note { background: #0a0c1099; border: 1px solid var(--edge); border-left: 4px solid var(--gold); border-radius: 6px; padding: 12px 16px; margin: 12px 0; }
  .note.stop { border: 1px solid var(--gold); background: linear-gradient(135deg, #6a4e1640, #0a0c1099); padding: 18px 20px; }
  .note.stop b { font: 700 18px var(--display); color: var(--gold2); }
  .when { font: 600 11px var(--ui); color: var(--dim); text-transform: uppercase; letter-spacing: 0.12em; }
  textarea.line { display: block; width: 100%; resize: vertical; min-height: 70px; font: italic 500 23px/1.35 var(--quote); margin: 6px 0 0; }
  textarea.line.own { border-color: var(--gold); }
  .card.done { border-color: var(--good); box-shadow: inset 4px 0 0 var(--good); }
  .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .rec { border-radius: 999px; padding: 9px 18px; font-weight: 600; border-color: #7a3328; background: #3a1712; }
  .rec:hover:not(:disabled) { border-color: var(--warn); background: #55201a; }
  .rec.on { background: #b3311f; border-color: #ffb3a3; animation: pulse 1.1s ease-out infinite; }
  @keyframes pulse { from { box-shadow: 0 0 0 0 #ef7d63aa; } to { box-shadow: 0 0 0 16px #ef7d6300; } }
  .play { border-radius: 999px; }
  .state { font-size: 14px; color: var(--dim); } .state.ok { color: var(--good); }
  .link { background: none; border: none; padding: 0; color: var(--gold); text-decoration: underline; font-size: 14px; }
  .primary { font: 700 14px var(--display); letter-spacing: 0.08em; text-transform: uppercase; color: #1a1305; background: linear-gradient(180deg, var(--gold2), var(--gold)); border: 0; padding: 12px 20px; box-shadow: 0 6px 20px #e3b65533; }
  .primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  .primary:disabled { background: var(--panel2); color: var(--dim); box-shadow: none; }
  .bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 8; background: #0a0c10f2; border-top: 1px solid var(--gold); padding: 12px max(16px, env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
  .bar .in { max-width: 980px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }

  /* crowned */
  .crowned { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 20px; background: radial-gradient(circle at 50% 40%, #3a2a14f7, #05060af7 70%); animation: fade 0.4s; }
  .crowned .in { text-align: center; max-width: 520px; animation: rise 0.6s cubic-bezier(.2,.9,.3,1.1); }
  .crowned .seal { width: 150px; height: 150px; font-size: 80px; margin: 0 auto 22px; border-width: 5px; box-shadow: 0 0 0 8px #0d0f14, 0 0 0 10px var(--gold), 0 0 80px #e3b65577; }
  .crowned h2 { font-size: clamp(28px, 6vw, 46px); line-height: 1.15; color: var(--gold2); }
  .crowned p { font: 500 21px/1.4 var(--quote); margin: 14px 0 22px; }
  @keyframes fade { from { opacity: 0; } } @keyframes rise { from { opacity: 0; transform: translateY(24px) scale(0.96); } }

  @media (max-width: 760px) {
    .hero { grid-template-columns: 1fr; padding-top: 32px; } .court { height: 250px; order: -1; }
    .court i:nth-child(1) { width: 120px; height: 120px; left: 34%; } .court i:nth-child(6), .court i:nth-child(7) { display: none; }
    .path { grid-template-columns: 1fr; } .head { flex-direction: column; text-align: center; padding: 22px 16px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } html { scroll-behavior: auto; } }
</style>
</head>
<body>
<div class="world" id="world" aria-hidden="true"><i class="a"></i><i class="b"></i></div>
<canvas id="sparks" aria-hidden="true"></canvas>
<div class="plate" id="plate" aria-hidden="true"></div>
<main>
  <section id="choose">
    <div class="hero">
      <div>
        <div class="eyebrow">Hearth &amp; Empire · a 3D strategy game of rival nations</div>
        <h1>A throne stands empty.</h1>
        <p class="lede">Thirteen nations need a ruler. Give one your name, your judgement and your voice, then meet yourself in the campaign.</p>
        <a class="cta" href="#nations">Choose your nation</a>
      </div>
      <div class="court" id="court" aria-hidden="true"></div>
    </div>
    <div class="path">
      <div><span class="num">I</span><b>Who they are</b><span>A name, a title and a portrait. Two minutes.</span></div>
      <div><span class="num">II</span><b>How they rule</b><span>Eight questions decide how the computer plays your nation. Two minutes.</span></div>
      <div><span class="num">III</span><b>Their voice</b><span>Rewrite their lines and record them. Fifteen minutes, now or later.</span></div>
    </div>
    <p class="dim">Stop after any step, press <b>Download</b>, and send that one file back to whoever invited you. Nothing is uploaded anywhere: your work stays in this browser tab until you download it, and is lost if you close the tab first.</p>
    <div class="fine">
      <span><b style="color:var(--fg)">Already started?</b> Open the file you downloaded last time and carry on, for example to add your voice.</span>
      <span class="row"><label for="resume">Continue from a saved file:</label><input type="file" id="resume" accept=".zip,application/zip"></span>
    </div>
    <p id="resumeerr" class="err" hidden style="margin:8px 0 0"></p>
    <div class="sect" id="nations"><h2>Choose your nation</h2></div>
    <div class="grid" id="leaders"></div>
  </section>

  <section id="booth" hidden>
    <p class="back"><button id="back">← Choose a different leader</button></p>
    <div class="head"><span class="seal big" id="seal"></span><div><div class="eyebrow" id="realm"></div><h2 id="who"></h2><p id="title"></p></div></div>
    <nav class="steps" id="steps" aria-label="Your progress">
      <a href="#step1" id="s1"><span class="tick"></span>1. Who they are</a>
      <a href="#step2" id="s2"><span class="tick"></span>2. How they rule</a>
      <a href="#step3" id="s3"><span class="tick"></span>3. Words and voice</a>
    </nav>
    <div class="step" id="step1"><span class="num">I</span><h2>Who they are</h2></div>
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
      <p class="dim" style="font-size:12px;margin:8px 0 0">Portraits and the paintings behind this page are public-domain works from The Metropolitan Museum of Art, Open Access.</p>
    </div>
    <div class="step" id="step2"><span class="num">II</span><h2>How they rule</h2></div>
    <div class="card">
      <b>How do they rule?</b>
      <p class="dim">Answer as your leader would. When you are not the one playing this nation, the computer plays it the way you answer: how readily it goes to war, whether its towns turn to the church or the tavern, whether it walls itself in or rides out, and how it bargains. Skip any question, or all of them, to leave the nation as it was written.</p>
      <div id="questions"></div>
      <div class="traits" id="traits" hidden></div>
      <p style="margin:10px 0 0"><button class="link" id="noanswers" hidden>Clear my answers</button></p>
    </div>
    <div class="note stop">
      <b>You can stop here.</b> Steps 1 and 2 are enough for your leader to appear in the campaign as you made them, with their lines shown as text. Download and send the file now, and come back to add your voice whenever you like: open this page again and choose <i>Continue from a saved file</i>.
      <p style="margin:10px 0 0"><button id="save2" class="primary" disabled>Download what I have so far</button></p>
    </div>
    <div class="step" id="step3"><span class="num">III</span><h2>Their words and voice<small>Optional. Do it now, later, or not at all.</small></h2></div>
    <div class="note"><b>How they were written</b> (play them your own way if you prefer): <span id="direction"></span></div>
    <p><label for="actor">Your name, for the credits <small>(optional)</small></label><br><input type="text" id="actor" maxlength="60" autocomplete="name"></p>
    <p class="dim">Tips: a quiet room, the microphone a hand's width from your mouth, and leave half a second of silence before you speak. Each line should run two to six seconds. Record as many or as few as you like; unrecorded lines stay as text in the game. Each box says when the leader speaks the line: keep your own version to that moment, and to one or two sentences.</p>
    <p id="micerr" class="err" hidden></p>
    <div id="lines"></div>
  </section>
</main>

<div class="crowned" id="crowned" hidden role="dialog" aria-labelledby="crownedh"><div class="in">
  <span class="seal" id="crownseal"></span>
  <h2 id="crownedh"></h2>
  <p id="crownedp"></p>
  <button class="primary" id="crownedok">Carry on</button>
</div></div>

<div class="bar" id="bar" hidden><div class="in">
  <span id="count" class="state"></span>
  <button id="save" class="primary" disabled>Download my recordings</button>
</div></div>

<script>
const LEADERS = ${JSON.stringify(leaders)};
const STOCK = ${JSON.stringify(STOCK)};
const BACKDROPS = ${JSON.stringify(BACKDROPS)};
const QUESTIONS = ${JSON.stringify(TEMPER_QUESTIONS)};
const AXES = ${JSON.stringify(TEMPER_AXES)};
const WORDS = ${JSON.stringify(TEMPER_WORDS)};
const $ = (id) => document.getElementById(id);
let leader = null;
let stream = null;
let active = null; // { rec, key } while a line is being recorded
const takes = new Map(); // line key -> { wav: Uint8Array, url }

// ---- choosing a leader ----
// ---- the world behind the page ----
{
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = [...$('world').children];
  let n = Math.floor(Math.random() * BACKDROPS.length), top = 0;
  const show = () => {
    const b = BACKDROPS[n % BACKDROPS.length], l = layers[top];
    l.style.backgroundImage = 'url(' + b.jpg + ')';
    l.classList.add('on');
    layers[1 - top].classList.remove('on');
    $('plate').textContent = b.title + (b.artist ? ' · ' + b.artist : '');
    top = 1 - top; n++;
  };
  show();
  if (!still) setInterval(() => { if (!document.hidden) show(); }, 11000);

  // Sparks rising, as from a hearth below the page.
  const cv = $('sparks'), g = cv.getContext('2d');
  let W = 0, H = 0, sparks = [];
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  const born = (anywhere) => ({ x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10, r: 0.6 + Math.random() * 1.8, vy: 0.25 + Math.random() * 0.7, sway: Math.random() * 6.28, life: 0.4 + Math.random() * 0.6 });
  size(); addEventListener('resize', size);
  if (!still) {
    sparks = Array.from({ length: Math.min(70, Math.round(innerWidth / 18)) }, () => born(true));
    const tick = () => {
      if (!document.hidden) {
        g.clearRect(0, 0, W, H);
        for (const s of sparks) {
          s.y -= s.vy; s.sway += 0.02; s.x += Math.sin(s.sway) * 0.35;
          const a = Math.max(0, Math.min(1, s.y / H)) * s.life * (0.6 + 0.4 * Math.sin(s.sway * 3));
          g.beginPath(); g.fillStyle = 'rgba(246,200,110,' + a.toFixed(3) + ')'; g.shadowColor = 'rgba(255,170,60,0.9)'; g.shadowBlur = 8;
          g.arc(s.x, s.y, s.r, 0, 6.28); g.fill();
          if (s.y < -10) Object.assign(s, born(false));
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
}
// A court of faces around the empty seat.
{
  const faces = [STOCK.man[0], STOCK.woman[3], STOCK.man[8], STOCK.woman[9], STOCK.man[13], STOCK.woman[5]];
  const court = $('court');
  const seat = document.createElement('i');
  seat.className = 'empty';
  seat.textContent = '?';
  court.appendChild(seat);
  for (const f of faces) { const i = document.createElement('i'); i.style.backgroundImage = 'url(' + f.jpg + ')'; court.appendChild(i); }
}
// One banner for each nation, with whoever may lead it.
const nations = [];
for (const l of LEADERS) { let n = nations.find((x) => x.civ === l.civ); if (!n) nations.push(n = { civ: l.civ, name: l.nation, color: l.color, who: [] }); n.who.push(l); }
for (const n of nations) {
  const card = document.createElement('article');
  card.className = 'nation';
  card.style.setProperty('--c', n.color);
  card.innerHTML = '<header><h3></h3></header><p class="says"></p><div class="who"></div>';
  card.querySelector('h3').textContent = n.name;
  card.querySelector('.says').textContent = n.who[0].lines[0].text;
  for (const l of n.who) {
    const b = document.createElement('button');
    b.className = 'pick';
    b.innerHTML = '<span class="seal"></span><span><b></b><small></small></span><span class="go">Rule</span>';
    b.querySelector('.seal').textContent = monogram(l.name);
    b.querySelector('.seal').style.backgroundColor = l.color;
    b.querySelector('b').textContent = l.name;
    b.querySelector('small').textContent = (l.female ? 'A woman' : 'A man') + ' · ' + l.title;
    b.addEventListener('click', () => open(l));
    card.querySelector('.who').appendChild(b);
  }
  $('leaders').appendChild(card);
}
$('crownedok').addEventListener('click', () => { $('crowned').hidden = true; });
$('back').addEventListener('click', () => {
  if ((takes.size || character() || picture) && !window.confirmLeave) { $('back').textContent = 'Your work on this leader will be lost. Click again to go back.'; window.confirmLeave = true; return; }
  window.confirmLeave = false;
  $('back').textContent = '← Choose a different leader';
  for (const t of takes.values()) URL.revokeObjectURL(t.url);
  takes.clear();
  $('booth').hidden = true; $('bar').hidden = true; $('choose').hidden = false;
  document.body.classList.remove('inbooth');
  window.scrollTo(0, 0);
});

function open(l) {
  leader = l;
  document.body.classList.add('inbooth');
  document.documentElement.style.setProperty('--nation', l.color);
  $('realm').textContent = 'Ruler of the ' + l.nation;
  $('cname').value = l.name;
  $('ctitle').value = l.title;
  setPicture(null);
  answers = {};
  const qb = $('questions');
  qb.innerHTML = '';
  QUESTIONS.forEach((q, n) => {
    const d = document.createElement('fieldset');
    d.className = 'q';
    d.style.border = '0'; d.style.padding = '0';
    d.innerHTML = '<legend style="padding:0"><b></b></legend>';
    d.querySelector('b').textContent = (n + 1) + '. ' + q.ask;
    q.answers.forEach((a, i) => {
      const l = document.createElement('label');
      l.innerHTML = '<input type="radio"><span></span>';
      const r = l.querySelector('input');
      r.name = 'q-' + q.id; r.id = 'q-' + q.id + '-' + i;
      l.querySelector('span').textContent = a.say;
      r.addEventListener('change', () => { answers[q.id] = i; temperShow(); refresh(); });
      d.appendChild(l);
    });
    qb.appendChild(d);
  });
  temperShow();
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
  $('title').textContent = said($('ctitle').value) || leader.title;
  if (!$('booth').hidden) refresh();
}
$('cname').addEventListener('input', heading);
$('ctitle').addEventListener('input', heading);
// How they answered the questions about their rule, and the temperament that makes.
let answers = {};
function temper() {
  const sum = {}, n = {};
  let any = false;
  for (const q of QUESTIONS) {
    const a = q.answers[answers[q.id]];
    if (!a) continue;
    any = true;
    for (const k of AXES) if (a.move[k] !== undefined) { sum[k] = (sum[k] || 0) + a.move[k]; n[k] = (n[k] || 0) + 1; }
  }
  if (!any) return null;
  const out = {};
  for (const k of AXES) out[k] = n[k] ? Math.round(Math.max(-1, Math.min(1, sum[k] / n[k])) * 100) / 100 : 0;
  return out;
}
function temperShow() {
  const t = temper(), box = $('traits');
  box.hidden = !t; $('noanswers').hidden = !t;
  if (!t) return;
  box.innerHTML = '';
  for (const k of AXES) {
    const d = document.createElement('div');
    d.className = 'trait';
    d.innerHTML = '<b></b><div class="meter"><i></i></div><div class="ends"><span></span><span></span></div>';
    d.querySelector('b').textContent = WORDS[k][t[k] > 0.33 ? 2 : t[k] < -0.33 ? 0 : 1];
    d.querySelector('i').style.left = ((t[k] + 1) * 50) + '%';
    const ends = d.querySelectorAll('.ends span');
    ends[0].textContent = WORDS[k][0]; ends[1].textContent = WORDS[k][2];
    box.appendChild(d);
  }
}
$('noanswers').addEventListener('click', () => {
  answers = {};
  for (const r of document.querySelectorAll('#questions input')) r.checked = false;
  temperShow(); refresh();
});
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
  const t = temper();
  if (t) { c.temper = t; c.answers = { ...answers }; }
  return Object.keys(c).length ? c : null;
}
function refresh() {
  const c = character(), own = c && c.lines ? Object.values(c.lines).flat().filter(Boolean).length : 0;
  const who = !!(picture || (c && (c.name || c.title))), rule = Object.keys(answers).length;
  const mark = (id, done, part) => { $(id).classList.toggle('done', !!done); $(id).classList.toggle('part', !done && !!part); };
  mark('s1', who); mark('s2', rule === QUESTIONS.length, rule); mark('s3', takes.size === leader.lines.length, takes.size || own);
  $('count').textContent = [who ? 'Character made' : 'Character as written', rule ? rule + ' of ' + QUESTIONS.length + ' questions answered' : 'no questions answered',
    takes.size + ' of ' + leader.lines.length + ' lines recorded' + (own ? ', ' + own + ' in your own words' : '')].join(' · ');
  $('save').disabled = $('save2').disabled = (takes.size === 0 && !c && !picture) || !!active;
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

$('save2').addEventListener('click', () => $('save').click());
$('save').addEventListener('click', () => {
  const who = $('actor').value.trim();
  const files = [...takes].map(([key, t]) => ({ name: key + '.wav', data: t.wav }));
  const made = character();
  const shown = (made && made.name) || leader.name;
  const readme = 'Recordings for ' + shown + ' (' + leader.nation + ') in Hearth & Empire.\\n' + (who ? 'Voiced by ' + who + '.\\n' : '') +
    (made ? 'A character of their own making, based on ' + leader.name + '.\\n' : '') +
    'In this file: ' + [made && (made.name || made.title) ? 'name and title' : '', picture ? 'portrait' : '', made && made.temper ? 'how they rule' : '', made && made.lines ? 'rewritten lines' : '',
      takes.size ? takes.size + ' of ' + leader.lines.length + ' lines recorded' : 'no recordings yet'].filter(Boolean).join(', ') + '.\\n\\nTo use them: copy every file in this folder into public/assets/voice/ in the game and restart it.\\n';
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
  $('count').textContent = 'Downloaded. Send that file back to whoever invited you. Keep a copy if you want to add more later.';
  const cs = $('crownseal');
  cs.textContent = picture ? '' : monogram(shown);
  cs.style.backgroundColor = leader.color;
  cs.style.backgroundImage = picture ? 'url(' + picture.url + ')' : '';
  $('crownedh').textContent = 'Long may you reign, ' + shown + '.';
  $('crownedp').textContent = 'Your file is in your downloads. Send it back to whoever invited you' + (takes.size < leader.lines.length ? ', and keep a copy: you can open it here again to add ' + (takes.size ? 'more of ' : '') + 'your voice.' : '.');
  $('crowned').hidden = false;
  $('crownedok').focus();
});
// ---- carrying on from a file saved earlier ----
// Reads the plain zip this page writes. A zip that another program has compressed cannot be read here.
function unzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), files = {};
  let o = 0;
  while (o + 30 <= u8.length && v.getUint32(o, true) === 0x04034b50) {
    const method = v.getUint16(o + 8, true), size = v.getUint32(o + 18, true), nlen = v.getUint16(o + 26, true), xlen = v.getUint16(o + 28, true);
    if (method !== 0) throw new Error('compressed');
    const name = dec.decode(u8.subarray(o + 30, o + 30 + nlen)), start = o + 30 + nlen + xlen;
    files[name.split('/').pop()] = u8.slice(start, start + size);
    o = start + size;
  }
  return files;
}
$('resume').addEventListener('change', async () => {
  const f = $('resume').files[0], err = $('resumeerr');
  err.hidden = true;
  if (!f) return;
  try {
    const files = unzip(await f.arrayBuffer()), text = (n) => (files[n] ? new TextDecoder().decode(files[n]).trim() : '');
    const pn = Object.keys(files).find((n) => /^persona_[a-z]+\\.txt$/.test(n));
    if (!pn) throw new Error('not ours');
    const civ = pn.slice(8, -4), l = LEADERS.find((x) => x.civ === civ && x.persona === (text(pn) === 'alt' ? 'alt' : 'main')) || LEADERS.find((x) => x.civ === civ);
    if (!l) throw new Error('not ours');
    open(l);
    let c = {};
    try { c = JSON.parse(text('character_' + civ + '.json') || '{}') || {}; } catch (e) { c = {}; }
    if (typeof c.name === 'string') $('cname').value = c.name.slice(0, ${CHARACTER_LIMITS.name});
    if (typeof c.title === 'string') $('ctitle').value = c.title.slice(0, ${CHARACTER_LIMITS.title});
    $('actor').value = text('credit_' + civ + '.txt').slice(0, 60);
    for (const ln of l.lines) {
      const own = c.lines && Array.isArray(c.lines[ln.ev]) ? c.lines[ln.ev][ln.i] : null;
      if (typeof own === 'string' && own) { const ta = $('card-' + ln.key).querySelector('.line'); ta.value = own.slice(0, ${CHARACTER_LIMITS.line}); ta.dispatchEvent(new Event('input')); }
    }
    for (const q of QUESTIONS) {
      const i = c.answers ? c.answers[q.id] : undefined, r = Number.isInteger(i) ? $('q-' + q.id + '-' + i) : null;
      if (r) { r.checked = true; answers[q.id] = i; }
    }
    temperShow();
    const pic = Object.keys(files).find((n) => /^portrait_[a-z]+\\.(png|jpe?g|webp)$/.test(n));
    if (pic) { const ext = pic.split('.').pop(); setPicture({ data: files[pic], ext, url: URL.createObjectURL(new Blob([files[pic]], { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg' })) }); }
    for (const ln of l.lines) {
      const wav = files[ln.key + '.wav'];
      if (!wav) continue;
      const card = $('card-' + ln.key), state = card.querySelector('.state');
      takes.set(ln.key, { wav, text: said(card.querySelector('.line').value), url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })) });
      card.classList.add('done');
      card.querySelector('.play').disabled = false;
      card.querySelector('.rec').textContent = '● Record again';
      state.textContent = '✓ Recorded, ' + ((wav.length - 44) / 2 / RATE).toFixed(1) + ' s';
      state.className = 'state ok';
    }
    heading();
    refresh();
  } catch (e) {
    err.textContent = e.message === 'compressed' ? 'That zip was repacked by another program and cannot be read here. Use the file exactly as this page saved it.' : 'That is not a file this page saved. Choose the voice-….zip you downloaded before.';
    err.hidden = false;
  }
  $('resume').value = '';
});
window.addEventListener('beforeunload', (e) => { if (takes.size || (leader && !$('booth').hidden && (character() || picture))) { e.preventDefault(); e.returnValue = ''; } });
</script>
</body>
</html>
`;
writeFileSync('docs/voice-booth.html', page);
console.log(`voice booth: ${leaders.length} leaders to choose from, ${leaders.reduce((n, l) => n + l.lines.length, 0)} lines`);
