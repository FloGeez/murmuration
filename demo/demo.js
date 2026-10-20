/* The murmuration demo: one flock for the whole page (frame: 'page'), driven by createScenes.
   The first screen is a playground (type, draw, change the glyph); the sections below show the scene engine. */
import { createMurmuration, createScenes, PLAIN_BIRD, sampleShape, fitShape, solid, hollow } from '../index.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
// motion: the durations and curves of demo.css, for the animations started from JS
const DURATION = { flash: 130, short: 250, medium: 450, long: 650 };
const EASE = { out: 'cubic-bezier(.2,.8,.2,1)', overshoot: 'cubic-bezier(.3,1.6,.5,1)', inOut: 'cubic-bezier(.65,0,.35,1)' };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// a keyboard action is never animated: transitions are cut for two frames
const instantly = (el = document.body) => { el.classList.add('instant'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('instant'))); };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

/* ——— Glyphs: an SVG path facing right, the point that sits on its place, its scale; all but the bird travel as themselves ——— */
const glyphs = [
  { name: 'Bird', view: '6 8 80 72', glyph: PLAIN_BIRD, light: ['#16202A', '#16202A', '#3A4A58'], dark: ['#E6ECF1', '#E6ECF1', '#AEBBC6'] },
  { name: 'Fish', view: '10 6 80 48', glyph: { path: 'M86 30 C76 16 54 12 36 22 L14 10 L20 30 L14 50 L36 38 C54 48 76 44 86 30 Z', anchor: [50, 30], scale: 0.16, flight: 'glyph' }, light: ['#134A6E', '#1E6391', '#2C7DB0'], dark: ['#8CCBEA', '#B5DEF2', '#62B0DA'] },
  { name: 'Leaf', view: '0 0 96 60', glyph: { path: 'M4 30 C24 8 62 4 92 30 C62 56 24 52 4 30 Z', anchor: [48, 30], scale: 0.15, flight: 'glyph' }, light: ['#2E6A36', '#5A8A2A', '#9C622A'], dark: ['#9FD08A', '#CFDB82', '#E3A970'] },
  { name: 'Dot', view: '-4 -4 28 28', glyph: { path: 'M10 0 A10 10 0 1 1 10 20 A10 10 0 1 1 10 0 Z', anchor: [10, 10], scale: 0.3, flight: 'glyph' }, light: ['#16202A', '#3A4A58'], dark: ['#E6ECF1', '#AEBBC6'] },
  // the classic way of drawing boids: a triangle, nose first
  { name: 'Triangle', view: '-2 -2 24 24', glyph: { path: 'M20 10 L0 2 L4 10 L0 18 Z', anchor: [8, 10], scale: 0.55, flight: 'glyph' }, light: ['#8E2F49', '#B5435F', '#6E2338'], dark: ['#F2A0B4', '#F7C1CE', '#E77F99'] },
  { name: 'Square', view: '-4 -4 18 18', glyph: { path: 'M0 0 H10 V10 H0 Z', anchor: [5, 5], scale: 0.6, flight: 'glyph' }, light: ['#3A3E9C', '#5559C2', '#292C70'], dark: ['#A9ADF6', '#C8CBFA', '#8B90EF'] },
];

/* ——— Shapes, drawn on the 720 × 640 frame ——— */
const ring = (g) => { solid(g); g.beginPath(); g.arc(360, 320, 260, 0, 6.2832); g.fill(); hollow(g); g.beginPath(); g.arc(360, 320, 150, 0, 6.2832); g.fill(); solid(g); };
const heart = (g) => { solid(g); g.beginPath(); g.moveTo(360, 580); g.bezierCurveTo(120, 420, 70, 250, 160, 150); g.bezierCurveTo(240, 70, 330, 110, 360, 190); g.bezierCurveTo(390, 110, 480, 70, 560, 150); g.bezierCurveTo(650, 250, 600, 420, 360, 580); g.fill(); };
const star = (g) => { solid(g); g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 120 : 290; g.lineTo(360 + Math.cos(a) * r, 330 + Math.sin(a) * r); } g.closePath(); g.fill(); hollow(g); g.beginPath(); g.arc(360, 330, 60, 0, 6.2832); g.fill(); solid(g); };
// text in Archivo, expanded where the browser can (open counters read better as dots), condensed on a tall screen
// lines: the text, one string per line; each line as large as the frame allows
const lettering = (lines, max) => (g) => {
  const set = (size) => { g.font = `${portrait() ? 600 : 800} ${size}px Archivo, system-ui, sans-serif`; if ('fontStretch' in g) g.fontStretch = portrait() ? 'condensed' : 'expanded'; };
  const ls = lines(); set(100);
  const size = Math.min(max, 560 / ls.length / 0.95, ...ls.map((l) => 100 * 680 / (g.measureText(l).width || 1)));
  set(size); g.textAlign = 'center'; g.textBaseline = 'middle';
  ls.forEach((l, i) => g.fillText(l, 360, 330 + (i - (ls.length - 1) / 2) * size * 0.95));
};
const input = $('word');
const text = () => input.value.trim();
// on a tall screen, the word goes in capitals, and on two lines when it is long
const portrait = () => innerWidth < innerHeight * 0.8;
// capitals there: no x-height to lose, letters twice as tall in the same width
const wordLines = () => { const t = text(); if (!portrait()) return [t]; const u = t.toUpperCase(); if (u.length < 8) return [u]; const h = Math.ceil(u.length / 2); return [u.slice(0, h), u.slice(h)]; };
const word = lettering(wordLines, 320);
word.key = () => wordLines().join('/');
const braces = lettering(() => ['{ }'], 460);

const shapes = [
  { name: 'Ring', action: 'ring', draw: ring, icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>' },
  { name: 'Heart', action: 'heart', draw: heart, icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>' },
  { name: 'Star', action: 'star', draw: star, icon: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/>' },
  { name: 'Draw a line', action: 'draw', icon: '<path d="M4 20c3-1 4-4 7-4s3 3 6 2 3-5 3-5"/><path d="m15 4 5 5-8 8H7v-5Z"/>' },
  { name: 'Free flight', action: 'fly', icon: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>' },
  { name: 'Scatter', action: 'scatter', icon: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>' },
];

/* ——— State ——— */
const state = { glyph: 0, count: 320, scale: 1, density: 1, action: 'fly', line: null, lines: 0, codeOpen: false, cheer: false };
let rev = 0; // bumped when the number of birds or places changes: every scene lands again
let layout = 0; // bumped when the sections change width (the code panel pushes them): their scenes land again
const theme = () => root.dataset.theme;
root.dataset.theme = store.get('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
// smaller glyphs on a small screen, so that a word still reads
const glyphNow = () => { const g = glyphs[state.glyph].glyph, k = state.scale * (innerWidth < 600 ? 0.6 : 1); return k === 1 ? g : { ...g, scale: +(g.scale * k).toFixed(3) }; };
const colorsNow = () => glyphs[state.glyph][theme()];

const m = createMurmuration($('flock'), { frame: 'page', count: state.count, glyph: glyphNow(), colors: colorsNow(), debug: new URLSearchParams(location.search).has('debug') });

/* ——— Geometry: boxes in document coordinates ——— */
const stage = $('stage');
const docBox = (el) => { const r = el.getBoundingClientRect(); return { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height }; };
const panelWidth = () => (state.codeOpen && innerWidth > 860 ? Math.min(460, innerWidth) : 0);
// the stage's shape sits between the top bar and the toolbar, left of the code panel when it is open
// (measured from the window, not from the stage: the stage is still shrinking while the panel slides in)
const stageBox = () => {
  const b = docBox(stage), side = Math.max(24, innerWidth * 0.06), top = 88, bottom = innerWidth > 860 ? 170 : 240;
  return { left: side, top: b.top + top, width: Math.max(120, innerWidth - panelWidth() - side * 2), height: Math.max(120, b.height - top - bottom) };
};
// places grow with the area of the box: enough for a long word on a phone, not too many on a wide screen
const places = (box) => Math.min(state.count, Math.round(Math.min(300, Math.sqrt(box.width * box.height) * 0.45) * state.density));
// fits the points' own bounds into the box (fitShape fits the whole 720 × 640 frame): a word uses the full width
const fitBounds = (pts, { width, height }, max = 2.4) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const s = Math.min(width / (x1 - x0 || 1), height / (y1 - y0 || 1), max), ox = (width - (x1 - x0) * s) / 2, oy = (height - (y1 - y0) * s) / 2;
  return pts.map(([x, y]) => [ox + (x - x0) * s, oy + (y - y0) * s]);
};
const orbitAbove = (box) => () => ({ x: box.left + box.width / 2, y: box.top - 8, rx: Math.min(box.width * 0.25, 220), ry: 22 });

/* ——— Drawing: a line dragged on the stage becomes a shape ——— */
const ink = $('ink'), pen = ink.getContext('2d');
let stroke = null;
const sizeInk = () => { const d = Math.min(2, devicePixelRatio || 1); ink.width = ink.clientWidth * d; ink.height = ink.clientHeight * d; pen.setTransform(d, 0, 0, d, 0, 0); };
// the line, in stage coordinates, mapped into the 720 × 640 frame and back so that the flock lands where it was drawn
const lineShape = (pts, box) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const k = Math.min(640 / Math.max(1, x1 - x0), 560 / Math.max(1, y1 - y0), 3), ox = 360 - (x0 + x1) / 2 * k, oy = 320 - (y0 + y1) / 2 * k;
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x * k + ox)} ${Math.round(y * k + oy)}`).join(' ');
  const draw = (g) => { g.lineWidth = 26 * k; g.lineCap = g.lineJoin = 'round'; g.stroke(new Path2D(path)); };
  const back = (frame) => frame.map(([x, y]) => [(x - ox) / k - box.left, (y - oy) / k - box.top]);
  return { draw, back, path, width: Math.round(26 * k) };
};
let strokeId = null;
stage.addEventListener('pointerdown', (e) => {
  // one finger draws: a second one, once the line has started, is ignored
  if (stroke || e.button !== 0 || (e.pointerType === 'touch' && state.action !== 'draw')) return;
  strokeId = e.pointerId; stroke = [[e.pageX, e.pageY]]; stage.setPointerCapture(e.pointerId); sizeInk(); ink.style.transition = 'none'; ink.style.opacity = 1; dismissHint();
});
stage.addEventListener('pointermove', (e) => {
  if (!stroke || e.pointerId !== strokeId) return;
  const [px, py] = stroke[stroke.length - 1];
  if (Math.hypot(e.pageX - px, e.pageY - py) < 4) return;
  stroke.push([e.pageX, e.pageY]);
  const r = stage.getBoundingClientRect();
  pen.strokeStyle = getComputedStyle(root).getPropertyValue('--muted'); pen.lineWidth = 2; pen.lineCap = 'round';
  pen.beginPath(); pen.moveTo(px - r.left - scrollX, py - r.top - scrollY); pen.lineTo(e.pageX - r.left - scrollX, e.pageY - r.top - scrollY); pen.stroke();
});
const endStroke = (e) => {
  if (!stroke || e.pointerId !== strokeId) return;
  const pts = stroke; stroke = null;
  ink.style.transition = 'opacity 1.2s'; ink.style.opacity = 0;
  const length = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  if (length < 40) return; // a click, not a line
  state.line = pts; state.lines++; choose('draw');
};
stage.addEventListener('pointerup', endStroke);
stage.addEventListener('pointercancel', endStroke);

/* ——— Scenes: the stage, then one per section ——— */
const sections = [...document.querySelectorAll('.scene')];
// a section is on screen when its middle is in the middle half of the viewport
const inView = (el) => { const r = el.getBoundingClientRect(), c = (r.top + r.bottom) / 2; return c > innerHeight * 0.2 && c < innerHeight * 0.8; };
const perchOf = (name) => document.querySelector(`[data-scene="${name}"] [data-perch]`);
const landed = (box, pts, options) => ({ points: pts, anchor: () => [box.left, box.top], ...options });
const shapeIn = (el, draw, options) => { const box = docBox(el); return landed(box, fitShape(sampleShape(draw, places(box)), box), options); };

// the signature moment: the code is copied, the flock draws a check mark, then goes back to its shape
const check = (g) => { g.lineWidth = 96; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(170, 350); g.lineTo(300, 480); g.lineTo(560, 180); g.stroke(); };
function stagePose() {
  const box = stageBox(), rest = { rest: 'circle', zone: orbitAbove(box), keep: 60, shy: true };
  if (state.cheer) return landed(box, fitBounds(sampleShape(check, places(box)), box, 1.4), rest);
  if (state.action === 'draw' && state.line) {
    const line = lineShape(state.line, box);
    return { points: line.back(sampleShape(line.draw, Math.min(state.count, Math.round(240 * state.density)), { key: 'line' + state.lines })), anchor: () => [box.left, box.top], ...rest };
  }
  const draw = state.action === 'word' ? word : shapes.find((s) => s.action === state.action).draw;
  return landed(box, fitBounds(sampleShape(draw, places(box)), box), rest);
}
// the wire: a slack curve across the section, the birds perched along it
const wirePath = $('wire-path');
wirePath.setAttribute('d', 'M0 34 Q50 58 100 34');
function wirePose() {
  const el = perchOf('wire'), box = docBox(el), n = Math.min(state.count - 40, Math.round(box.width / 11));
  const pts = Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n, u = 1 - t; return [t * box.width, (u * u * 0.34 + 2 * u * t * 0.58 + t * t * 0.34) * box.height]; });
  return landed(box, pts, { rest: 'circle', zone: () => ({ x: box.left + box.width / 2, y: box.top + box.height * 0.08, rx: box.width * 0.3, ry: 26 }) });
}
const scenes = createScenes(m, [
  { name: 'stage', active: () => scrollY < innerHeight * 0.45 && (state.cheer || (state.action !== 'fly' && state.action !== 'scatter' && !(state.action === 'draw' && !state.line))), variant: () => [state.cheer ? 'cheer' : state.action, text(), state.lines, rev, state.codeOpen].join('|'), pose: stagePose },
  { name: 'wire', active: () => inView(sections[0]), variant: () => `${rev}|${layout}`, pose: wirePose },
  { name: 'scenes', active: () => inView(sections[1]), variant: () => `${rev}|${layout}`, pose: () => shapeIn(perchOf('scenes'), braces, { rest: 'circle', zone: orbitAbove(docBox(perchOf('scenes'))), keep: 40 }) },
  { name: 'shy', active: () => inView(sections[2]), variant: () => `${rev}|${layout}`, pose: () => shapeIn(perchOf('shy'), ring, { rest: 'leave', shy: true }) },
], { debug: new URLSearchParams(location.search).has('debug') });
addEventListener('scroll', () => requestAnimationFrame(() => scenes.update()), { passive: true });
let resizing = 0;
addEventListener('resize', () => { clearTimeout(resizing); resizing = setTimeout(() => { m.setGlyph(glyphNow()); scenes.update(true); }, 200); });

/* ——— Toolbar ——— */
// a radio group of icon buttons with a pill that slides under the chosen one; arrows move between them
function radioGroup(el, items, label, onPick) {
  const pill = el.querySelector('.pill');
  const buttons = items.map((item, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tool'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', label(item)); b.dataset.tip = label(item);
    b.innerHTML = item.svg;
    b.onclick = () => onPick(i);
    b.onkeydown = (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); instantly(pill); const n = buttons[(i + d + buttons.length) % buttons.length]; n.focus(); n.click();
    };
    el.append(b); return b;
  });
  return (i) => {
    buttons.forEach((b, k) => { b.setAttribute('aria-checked', k === i); b.tabIndex = k === i || (i == null && k === 0) ? 0 : -1; });
    pill.classList.toggle('on', i != null);
    if (i != null) pill.style.transform = `translateX(${buttons[i].offsetLeft}px)`;
  };
}
const pickGlyph = radioGroup($('glyphs'), glyphs.map((g) => ({ ...g, svg: `<svg class="glyph" viewBox="${g.view}" aria-hidden="true"><path d="${g.glyph.path}"/></svg>` })), (g) => g.name, (i) => {
  state.glyph = i; pickGlyph(i); m.setGlyph(glyphNow()); m.setColors(colorsNow()); showCode(); dismissHint();
});
const pickShape = radioGroup($('shapes'), shapes.map((s) => ({ ...s, svg: `<svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg>` })), (s) => s.name, (i) => choose(shapes[i].action));

function choose(action) {
  state.action = action; dismissHint();
  const i = shapes.findIndex((s) => s.action === action); pickShape(i < 0 ? null : i);
  stage.classList.toggle('drawing', action === 'draw');
  if (action === 'draw' && !state.line) say('Drag on the sky to draw a line.');
  if (scrollY > innerHeight * 0.45 && action !== 'fly' && action !== 'scatter') scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  scenes.update();
  if (action === 'scatter') m.scatter();
  showCode();
}

// typing anywhere writes: the first key focuses the field and replaces the word
let pause = 0;
input.addEventListener('input', () => {
  dismissHint(); state.action = 'word'; pickShape(null); stage.classList.remove('drawing'); showCode();
  clearTimeout(pause); pause = setTimeout(() => { if (!text()) return choose('fly'); choose('word'); say(`The flock writes ${text()}.`); }, 260);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { instantly(); if (closeSettings() || closeCode()) return; choose('fly'); return; }
  const t = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || t === input || t.closest('input, textarea, .code-panel')) return;
  if (t.closest('button, a') && (e.key === ' ' || e.key === 'Enter')) return;
  input.focus(); input.select();
});

// settings: a popover over the toolbar
const settings = $('settings'), settingsToggle = $('settings-toggle');
// a class and transitions (demo.css): it leaves faster than it came, and a quick second click reverses it midway
const openSettings = (open) => { settings.classList.toggle('open', open); settings.inert = !open; settingsToggle.setAttribute('aria-expanded', open); };
const closeSettings = () => { if (!settings.classList.contains('open')) return false; openSettings(false); return true; };
settingsToggle.onclick = () => { if (!closeSettings()) openSettings(true); };
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.settings, #settings-toggle')) closeSettings(); });
let settle = 0;
const slider = (id, format, apply) => {
  const el = $(id), out = $(id + '-value');
  out.textContent = format(+el.value);
  el.addEventListener('input', () => {
    out.textContent = format(+el.value); apply(+el.value); showCode();
    clearTimeout(settle); settle = setTimeout(() => { rev++; scenes.update(); }, 220);
  });
};
slider('count', (v) => v, (v) => { state.count = v; m.setCount(v); });
slider('scale', (v) => `${v} %`, (v) => { state.scale = v / 100; m.setGlyph(glyphNow()); });
slider('density', (v) => `${v} %`, (v) => { state.density = v / 100; });

/* ——— Theme ——— */
const themeButton = $('theme');
const showTheme = () => { themeButton.setAttribute('aria-label', theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); themeButton.dataset.tip = theme() === 'dark' ? 'Light theme' : 'Dark theme'; };
themeButton.onclick = () => { root.dataset.theme = theme() === 'dark' ? 'light' : 'dark'; store.set('theme', theme()); showTheme(); m.setColors(colorsNow()); showCode(); };
showTheme();

/* ——— Code panel: the code of this very flock, the values that just changed light up ——— */
const panel = $('code-panel'), codeToggle = $('code-toggle'), code = $('code');
const openCode = (open) => {
  state.codeOpen = open; panel.classList.toggle('open', open); document.body.classList.toggle('code-open', open); panel.inert = !open; codeToggle.setAttribute('aria-expanded', open);
  if (open) $('code-close').focus(); else codeToggle.focus();
  scenes.update(); showCode();
};
// the sections are narrower once the panel has pushed them: their shapes follow
document.querySelector('main').addEventListener('transitionend', (e) => { if (e.propertyName === 'margin-right') { layout++; scenes.update(); } });
const closeCode = () => { if (!state.codeOpen) return false; openCode(false); return true; };
codeToggle.onclick = () => openCode(!state.codeOpen);
$('code-close').onclick = () => openCode(false);

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
function segments() {
  const g = glyphs[state.glyph], out = [], t = (s) => out.push(s), v = (k, s) => out.push({ k, s });
  const custom = state.glyph !== 0 || glyphNow().scale !== PLAIN_BIRD.scale, box = stageBox();
  t(`import { createMurmuration, ${custom && state.glyph === 0 ? 'PLAIN_BIRD, ' : ''}sampleShape, fitShape } from '@flogeez/murmuration';\n\n`);
  t(`const m = createMurmuration(canvas, {\n  frame: 'page',\n  count: `); v('count', String(state.count));
  t(`,\n  colors: `); v('colors', `[${colorsNow().map(quote).join(', ')}]`);
  if (custom) {
    t(`,\n  glyph: `);
    v('glyph', state.glyph === 0 ? `{ ...PLAIN_BIRD, scale: ${glyphNow().scale} }` : `{ path: ${quote(g.glyph.path)}, anchor: [${g.glyph.anchor.join(', ')}], scale: ${glyphNow().scale}, flight: 'glyph' }`);
  }
  t(`,\n});\n\n`);
  if (state.action === 'fly') { t(`// no shape: the flock flies freely\n`); v('action', 'm.fly();'); return out; }
  if (state.action === 'scatter') { t(`// the flock leaves the screen\n`); v('action', 'm.scatter();'); return out; }
  t(`// a shape draws on a 720 × 640 canvas: fill the matter, the birds settle on it\n`);
  if (state.action === 'word') { t(`const shape = (g) => {\n  g.font = '800 300px Archivo';\n  g.textAlign = 'center';\n  g.fillText(`); v('word', quote(text())); t(`, 360, 330);\n};\n`); }
  else if (state.action === 'draw' && state.line) {
    const line = lineShape(state.line.filter((_, i) => i % 2 === 0 || i === state.line.length - 1), box);
    t(`const shape = (g) => {\n  g.lineWidth = `); v('width', String(line.width)); t(`;\n  g.stroke(new Path2D(`); v('line', quote(line.path)); t(`));\n};\n`);
  } else { t(`const shape = `); v('shape', state.action); t(`; // see the demo's source\n`); }
  t(`const box = { width: `); v('width-box', String(Math.round(box.width))); t(`, height: `); v('height-box', String(Math.round(box.height))); t(` };\n`);
  t(`m.perch(fitShape(sampleShape(shape, `); v('places', String(places(box))); t(`), box), {\n  rest: 'circle', keep: 60, shy: true,\n});\n`);
  return out;
}
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TOKENS = /(\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*')|\b(import|from|const|new)\b|(-?\b\d+(?:\.\d+)?\b)/g;
const highlight = (s) => escapeHtml(s).replace(TOKENS, (all, com, str, kw, num) =>
  `<span class="t-${com ? 'com' : str ? 'str' : kw ? 'kw' : 'num'}">${all}</span>`);
let before = {};
function showCode() {
  const segs = segments(), now = {};
  code.innerHTML = segs.map((s) => (typeof s === 'string' ? highlight(s) : `<span class="v" data-k="${s.k}">${highlight(s.s)}</span>`)).join('');
  for (const s of segs) if (typeof s !== 'string') {
    now[s.k] = s.s;
    if (s.k in before && before[s.k] !== s.s) code.querySelector(`[data-k="${s.k}"]`).classList.add('lit');
  }
  before = now;
}
// Copy → Copied: the label changes, the check mark draws itself, the button bounces once, back to rest after 2.4 s.
// Without a clipboard (outside HTTPS), the text is selected and the button says so. A screen reader hears it.
const COPY_LABEL = { idle: 'Copy', copied: 'Copied', selected: 'Selected' };
const COPY_SAID = { idle: '', copied: 'Copied to the clipboard', selected: 'Text selected, copy it with Ctrl+C' };
const copyButton = (button, textOf, target, then = () => {}) => {
  const icon = button.querySelector('svg').outerHTML, label = button.querySelector('span');
  let timer = 0;
  const show = (s) => {
    clearTimeout(timer);
    button.dataset.state = s; label.textContent = COPY_LABEL[s]; say(COPY_SAID[s]);
    // a light blur bridges the old word and the new one, so they read as one change
    if (!reducedMotion()) label.animate([{ filter: 'blur(2px)', opacity: 0.6 }, { filter: 'none', opacity: 1 }], { duration: 200, easing: EASE.out });
    button.querySelector('svg').outerHTML = s === 'idle' ? icon : '<svg class="check-draw" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 9.5 17.5 19.5 6.5" pathLength="1"/></svg>';
    if (s === 'idle') return;
    if (!reducedMotion()) button.animate([{ transform: 'scale(.94)' }, { transform: 'none' }], { duration: 500, easing: EASE.overshoot });
    timer = setTimeout(() => show('idle'), 2400);
  };
  const select = () => { const r = document.createRange(); r.selectNodeContents(target); getSelection().removeAllRanges(); getSelection().addRange(r); show('selected'); };
  button.onclick = () => { try { navigator.clipboard.writeText(textOf()).then(() => { show('copied'); then(); }, select); } catch { select(); } };
};
// the signature moment, after copying the code: only when the stage is on screen, never twice at once
const cheer = () => {
  if (state.cheer || reducedMotion() || scrollY > innerHeight * 0.45) return;
  state.cheer = true; scenes.update();
  setTimeout(() => { state.cheer = false; scenes.update(); if (state.action === 'scatter') m.scatter(); }, 2400);
};
copyButton($('copy-code'), () => code.textContent, code, cheer);
document.querySelectorAll('[data-copy]').forEach((b) => copyButton(b, () => b.dataset.copy, b.previousElementSibling));

/* ——— Tooltips: the first one waits 500 ms (no accidental opening), the next ones open at once, without animation,
   as long as the pointer moves from one control to the next. From the keyboard, at once. ——— */
const tip = document.createElement('div');
tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true'); // the controls already carry the same name (aria-label)
document.body.append(tip);
let tipWait = 0, tipCool = 0, warm = false, tipFor = null;
const placeTip = (el) => { const r = el.getBoundingClientRect(); tip.style.left = `${r.left + r.width / 2}px`; tip.style.top = `${r.top}px`; };
function showTip(el, instant) {
  tipFor = el; tip.textContent = el.dataset.tip; placeTip(el);
  tip.classList.toggle('instant', instant); tip.classList.add('on'); warm = true; clearTimeout(tipCool);
}
function hideTip() {
  clearTimeout(tipWait); if (!tipFor) return;
  tipFor = null; tip.classList.remove('on');
  tipCool = setTimeout(() => { warm = false; }, 300); // a short gap between two controls keeps the toolbar warm
}
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (e.pointerType !== 'mouse' || !el || el === tipFor) return;
  clearTimeout(tipWait);
  if (warm) showTip(el, true); else tipWait = setTimeout(() => showTip(el, false), 500);
});
document.addEventListener('pointerout', (e) => { const el = e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('pointerdown', hideTip, true); // pressing hides it: the action speaks
document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el && el.matches(':focus-visible')) showTip(el, true); });
document.addEventListener('focusout', hideTip);

/* ——— Hint and announcements ——— */
const hint = $('hint'), status = $('status');
let hinted = true;
function dismissHint() { if (hinted) { hinted = false; hint.classList.add('gone'); } }
const say = (s) => { status.textContent = s; };

/* ——— Start: the flock flies in, then writes the title once the font is there ——— */
pickGlyph(0); pickShape(null);
scenes.update(); // the first scene lands at once: let it be free flight, so that the title is written in flight
showCode();
Promise.race([document.fonts.load('800 100px Archivo'), new Promise((r) => setTimeout(r, 1500))]).then(() => {
  state.action = 'word'; scenes.update(); showCode(); before = {};
});
