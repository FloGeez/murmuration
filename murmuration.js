/* The murmuration — a flock of birds that goes along the whole page, or lives inside a canvas.
 * A fixed canvas behind the content; the birds live in document coordinates.
 *   const m = createMurmuration(canvas, { count: 170, colors: ['#2B2A33', '#5E5C6B'], frame: 'page', glyph, debug: false });
 *   frame: 'page' (default) — a fixed canvas over the whole page, the birds in document coordinates;
 *          'canvas' — the flock lives inside the canvas itself (a plate, a slide), in the canvas's own coordinates
 *   glyph: the perched bird, { path: SVG path d, anchor: [x, y] (the point that sits on its place), scale }; a plain bird by default
 *   m.perch(points, options)  // land on a list of [x, y] points (document coordinates); options: see perch
 *   (choosing the scene, section by section, is the scene engine's job: scenes.js)
 *   m.fly()          // fly freely in the viewport's margin
 *   m.scatter()      // leave the screen
 */
// Flock speeds (1 = the original setting at 60 frames/s):
// SPEED_PERCH for birds on their way to a place (shapes, wire, path); SPEED_FREE for the circling flock, slower:
// it stays on screen during the whole read and must not draw the eye; SPEED_AWAY for those leaving the screen.
const SPEED_PERCH = 2, SPEED_FREE = 0.8, SPEED_AWAY = 1;
// the default perched bird: a plain songbird in profile, about 12 px high, its feet on its place
export const PLAIN_BIRD = { path: 'M66 14 C56 8 44 12 41 24 C39 33 39 42 33 52 C27 62 18 70 8 78 L22 77 C30 72 38 66 46 63 C60 58 70 46 70 32 L84 30 L70 25 C69 20 68 17 66 14 Z', anchor: [44, 64], scale: 0.17 };
export function createMurmuration(canvas, opts = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let colors = opts.colors || ['#2B2A33', '#5E5C6B'];
  const glyph = opts.glyph || PLAIN_BIRD, GLYPH = new Path2D(glyph.path), [GX, GY] = glyph.anchor;
  const N = opts.count || 170, S = opts.scale || glyph.scale;
  // the view: the viewport scrolled over the page, or the canvas itself
  const inCanvas = opts.frame === 'canvas';
  const viewX = () => (inCanvas ? 0 : scrollX), viewY = () => (inCanvas ? 0 : scrollY);
  let zoneFn = null, Z = null, anchor = null, origin = [0, 0], prevAnchor = null, prevOrigin = [0, 0], waitEnd = 0, vw = inCanvas ? canvas.clientWidth : innerWidth, vh = inCanvas ? canvas.clientHeight : innerHeight, dpr = 1, raf = 0, mx = null, my = null, running = true;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (inCanvas) { vw = canvas.clientWidth; vh = canvas.clientHeight; } else { vw = innerWidth; vh = innerHeight; canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'; }
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    if (reduced) draw();
  };
  const B = [], grid = new Map();
  for (let k = 0; k < N; k++) B.push({ x: viewX() + vw * (0.2 + Math.random() * 0.6), y: viewY() + vh * Math.random() * 0.5, vx: Math.random() - 0.5, vy: Math.random() - 0.5, t: null, perched: false, away: false, ph: Math.random() * 6.283, c: colors[k % colors.length] });
  resize(); addEventListener('resize', resize);
  const sizeWatch = inCanvas && 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  if (sizeWatch) sizeWatch.observe(canvas);
  // the pointer, in the view's coordinates: recomputed on scroll too (the pointer stays still, the page moves)
  let px0 = null, py0 = null;
  const track = () => {
    if (px0 == null) return;
    if (inCanvas) { const r = canvas.getBoundingClientRect(); mx = px0 - r.left; my = py0 - r.top; } else { mx = px0 + scrollX; my = py0 + scrollY; }
    if (shy) dirty = true;
  };
  addEventListener('pointermove', (e) => { px0 = e.clientX; py0 = e.clientY; track(); }, { passive: true });
  addEventListener('scroll', track, { passive: true });
  document.addEventListener('pointerleave', () => { px0 = mx = null; });
  // shy: perched birds fly off when the pointer comes close, circle above their place, then land on it again
  let shy = false;
  function startle(b, ms) { b.perched = false; const a = Math.atan2(b.y - my, b.x - mx); b.vx = Math.cos(a) * 2.5 + (Math.random() - 0.5); b.vy = -2.5 - Math.random() * 1.5; b.fright = ms + 900 + Math.random() * 500; }

  function takeOff(b) { b.wait = 0; b.orb = false; b.fright = 0; if (b.perched) { b.vy -= 2 + Math.random() * 1.5; b.vx += (Math.random() - 0.5) * 2; } b.perched = false; b.t = null; }
  // birds that left come back from the side the page comes from: from the top when scrolling up, from the bottom when scrolling down
  let prevScroll = scrollY, goingUp = false;
  addEventListener('scroll', () => { if (scrollY !== prevScroll) goingUp = scrollY < prevScroll; prevScroll = scrollY; }, { passive: true });
  function comeBack(b) {
    if (!b.away) return; b.away = false;
    b.x = viewX() + vw * (0.1 + Math.random() * 0.8);
    b.y = viewY() + (goingUp ? -20 - Math.random() * 60 : vh + 20 + Math.random() * 60);
    b.vx = (Math.random() - 0.5) * 2; b.vy = goingUp ? 2 + Math.random() : -2 - Math.random();
  }
  // Leaving the screen: the whole flock leaves the same way, up and to the right (±20°), not in a star from the centre
  function leave(b) { b.away = true; const a = -Math.PI / 3 + (Math.random() - 0.5) * 0.7; b.ex = Math.cos(a); b.ey = Math.sin(a); }
  // The attraction point of a path: it goes back and forth along the polyline, at 70 px/s, with a slight float
  function alongPath(pts, now) {
    const lg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = lg.reduce((a, l) => a + l, 0) || 1;
    let s = (now * 70) % (2 * total); if (s > total) s = 2 * total - s;
    let i = 0; while (i < lg.length - 1 && s > lg[i]) { s -= lg[i]; i++; }
    const u = lg[i] ? Math.min(1, s / lg[i]) : 0, a = pts[i], z = pts[i + 1] || a;
    return [a[0] + (z[0] - a[0]) * u + Math.cos(now * 0.87) * 14, a[1] + (z[1] - a[1]) * u + Math.sin(now * 1.13) * 14];
  }
  // Land on the points T. Options:
  //   instant: the birds land at once (first display, resize)
  //   rest: what do birds without a place do? 'fly' (default), 'double' (squeeze next to another one), 'circle' (in the zone), 'leave'
  //   anchor: function returning the origin [x, y] (document) of the points T; the shape then follows a moving element (position sticky…)
  //   zone: function returning the ellipse {x, y, rx, ry} (document) where birds without a place circle (rest = 'circle'),
  //         or a path {path: [[x, y], …]} (document) along which they go back and forth
  //   keep: with 'circle', how many birds without a place circle; the others leave (all of them circle by default)
  //   shy: perched birds fly off when the pointer comes close (see startle)
  function perch(T, { instant = false, rest = 'fly', anchor: anc = null, zone = null, keep = Infinity, shy: isShy = false } = {}) {
    idle = false; shy = isShy;
    zoneFn = rest === 'circle' ? zone : null;
    // the flock re-forms: perched birds fly off one after the other, from left to right
    const now = performance.now(), before = B.map((b) => (b.perched && b.t && !reduced && !instant ? b.t : null));
    prevAnchor = anchor; prevOrigin = anchor ? anchor() : [0, 0];
    anchor = anc; origin = anc ? anc() : [0, 0];
    B.forEach(takeOff);
    const tg = [...T].sort((a, c) => a[0] - c[0]);
    const n = Math.min(tg.length, B.length), taken = new Set();
    // places go first to the birds on screen: birds that left only come back if some are missing
    const present = B.map((b, k) => k).filter((k) => !B[k].away);
    const order = (present.length >= n ? present : B.map((b, k) => k)).sort((a, c) => B[a].x - B[c].x), stride = order.length / n;
    for (let j = 0; j < n; j++) { const k = order[Math.floor(j * stride)]; B[k].t = tg[j]; taken.add(k); }
    let kept = 0;
    B.forEach((b, k) => {
      if (!taken.has(k) && n && n < B.length) {
        if (rest === 'double') { const p = tg[Math.floor(Math.random() * n)]; b.t = [p[0] + (Math.random() < 0.5 ? -4 : 4), p[1]]; }
        else if (rest === 'circle' && zone && kept < keep) { b.orb = true; kept++; }
        else if (rest === 'leave' || (rest === 'circle' && zone)) { if (!b.away) leave(b); return; } // already gone: they stay gone
      }
      comeBack(b);
    });
    const waiting = B.map((b, k) => k).filter((k) => before[k]).sort((a, c) => before[a][0] - before[c][0]);
    waiting.forEach((k, r) => { const b = B[k]; b.ot = before[k]; b.wait = now + (r / waiting.length) * 500 + Math.random() * 140; b.perched = true; b.vx = b.vy = 0; });
    waitEnd = now + 700;
    if (reduced || instant) { B.forEach((b) => { if (b.t) { b.x = b.t[0] + origin[0]; b.y = b.t[1] + origin[1]; b.perched = true; } }); draw(); }
  }
  function fly() { idle = false; shy = false; anchor = null; zoneFn = null; B.forEach((b) => { takeOff(b); comeBack(b); }); if (reduced) draw(); }
  function scatter() {
    idle = false; shy = false;
    anchor = null; zoneFn = null;
    B.forEach((b) => { takeOff(b); leave(b); });
    if (reduced) draw();
  }
  function offscreen(b) { const x = viewX(), y = viewY(); return b.x < x - 60 || b.x > x + vw + 60 || b.y < y - 60 || b.y > y + vh + 60; }
  // dt: the elapsed time, in "frames at 60 Hz"; each bird multiplies it by its speed (k)
  function step(dt = 1) {
    const now = performance.now() / 1000;
    // free-flight zone: on a page, the right margin of the viewport, a little above the middle; in a canvas, around its centre
    const ax = inCanvas ? vw / 2 + Math.cos(now * 0.33) * vw * 0.2 : scrollX + vw * (vw > 900 ? 0.86 : 0.66) + Math.cos(now * 0.33) * vw * 0.1;
    const ay = inCanvas ? vh / 2 + Math.sin(now * 0.51) * vh * 0.1 : scrollY + vh * 0.3 + Math.sin(now * 0.51) * vh * 0.15;
    origin = anchor ? anchor() : [0, 0];
    Z = zoneFn ? zoneFn() : null;
    if (Z && Z.path) Z.point = alongPath(Z.path, now);
    const ms = performance.now(); if (prevAnchor && ms < waitEnd) prevOrigin = prevAnchor();
    // neighbourhood: a 40 px grid for the free birds (the flock counts several hundred birds)
    grid.clear();
    for (const o of B) { if (o.perched || o.away || o.t) continue; const c = Math.floor(o.x / 40) * 100003 + Math.floor(o.y / 40); const l = grid.get(c); if (l) l.push(o); else grid.set(c, [o]); }
    for (const b of B) {
      if (b.perched) {
        if (b.wait) {
          if (ms < b.wait) { b.x = b.ot[0] + prevOrigin[0]; b.y = b.ot[1] + prevOrigin[1]; continue; }
          b.wait = 0; b.perched = false; b.vy = -(1.5 + Math.random() * 2); b.vx = (Math.random() - 0.5) * 2;
        } else {
          if (anchor && b.t) { b.x = b.t[0] + origin[0]; b.y = b.t[1] + origin[1]; }
          if (!(shy && b.t && mx != null && Math.hypot(b.x - mx, b.y - my) < 56)) continue;
          startle(b, ms);
        }
      }
      const k = dt * (b.away ? SPEED_AWAY : b.t && !b.fright ? SPEED_PERCH : SPEED_FREE);
      if (b.away) { if (offscreen(b)) continue; b.vx += b.ex * 0.14 * k; b.vy += b.ey * 0.14 * k; const v = Math.hypot(b.vx, b.vy); if (v > 4.5) { b.vx = b.vx / v * 4.5; b.vy = b.vy / v * 4.5; } b.x += b.vx * k; b.y += b.vy * k; continue; }
      let fx = 0, fy = 0;
      // scrolling is faster than the birds: those that fall behind come back in through the nearest edge
      if (!b.t) {
        const y0 = viewY();
        if (b.y < y0 - 220) { b.y = y0 - 30; b.vy = Math.abs(b.vy) + 1; }
        else if (b.y > y0 + vh + 220) { b.y = y0 + vh + 30; b.vy = -Math.abs(b.vy) - 1; }
      } else {
        const ty = b.t[1] + origin[1];
        if (Math.abs(b.y - ty) > vh * 0.9) { b.y = ty + (b.y < ty ? -vh * 0.6 : vh * 0.6); }
      }
      const tx = b.t ? b.t[0] + origin[0] : 0, ty = b.t ? b.t[1] + origin[1] : 0;
      if (b.fright && b.t && (ms < b.fright || (mx != null && Math.hypot(tx - mx, ty - my) < 90))) {
        // startled: it circles above its place while the pointer is there, then comes back to land on it
        if (ms >= b.fright) b.fright = ms + 300;
        const px = tx + Math.cos(now * 1.6 + b.ph) * 36, py = ty - 64 + Math.sin(now * 2.1 + b.ph) * 18;
        fx = (px - b.x) * 0.006 - b.vx * 0.04; fy = (py - b.y) * 0.006 - b.vy * 0.04;
      } else if (b.t) {
        b.fright = 0;
        const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
        if (d < 1.2) { b.perched = true; b.x = b.t[0] + origin[0]; b.y = b.t[1] + origin[1]; b.vx = b.vy = 0; continue; }
        const sp = Math.min(d > 300 ? 12 : 5.5, d * 0.08);
        // on the way, the flock swirls a little before landing
        const swirl = Math.min(0.75, Math.max(0, (d - 50) / 380)), ca = Math.cos(swirl), sa = Math.sin(swirl), ux = dx / d, uy = dy / d;
        fx = (ux * ca - uy * sa) * sp - b.vx; fy = (ux * sa + uy * ca) * sp - b.vy;
        const lim = d > 300 ? 1.2 : 0.45, f = Math.hypot(fx, fy); if (f > lim) { fx = fx / f * lim; fy = fy / f * lim; }
      } else {
        let sx = 0, sy = 0, axx = 0, ayy = 0, cx = 0, cy = 0, n = 0;
        const gx = Math.floor(b.x / 40), gy = Math.floor(b.y / 40);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = grid.get((gx + i) * 100003 + gy + j); if (l) for (const o of l) {
          if (o === b) continue;
          const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 1600) { n++; axx += o.vx; ayy += o.vy; cx += o.x; cy += o.y; if (d2 < 420) { const d = Math.sqrt(d2) || 1; sx -= dx / d * (1 - d / 20.5); sy -= dy / d * (1 - d / 20.5); } }
        } }
        if (n) { fx += (axx / n - b.vx) * 0.05 + (cx / n - b.x) * 0.0007; fy += (ayy / n - b.vy) * 0.05 + (cy / n - b.y) * 0.0007; }
        if (b.orb && Z) {
          // like the whole flock: an attraction point wandering in the zone, and the swarm's rules do the rest
          let px, py;
          if (Z.path) { [px, py] = Z.point; b.far = Math.hypot(b.x - px, b.y - py) > 220; }
          else {
            px = Z.x + Math.cos(now * 0.33) * Z.rx * 0.7 + Math.cos(now * 0.87) * Z.rx * 0.2; py = Z.y + Math.sin(now * 0.51) * Z.ry * 0.7 + Math.sin(now * 1.13) * Z.ry * 0.2;
            b.far = Math.hypot((b.x - Z.x) / Z.rx, (b.y - Z.y) / Z.ry) > 1.8;
          }
          const pull = b.far ? 0.004 : 0.0011;
          fx += sx * 0.35 + (px - b.x) * pull; fy += sy * 0.35 + (py - b.y) * pull;
        } else { fx += sx * 0.35 + (ax - b.x) * 0.0006; fy += sy * 0.35 + (ay - b.y) * 0.0006; }
        // in a canvas, soft walls: a free bird nearing an edge is turned back inside, so the flock is never cut by the frame
        if (inCanvas) { const M = 48; if (b.x < M) fx += (M - b.x) * 0.01; else if (b.x > vw - M) fx -= (b.x - vw + M) * 0.01; if (b.y < M) fy += (M - b.y) * 0.01; else if (b.y > vh - M) fy -= (b.y - vh + M) * 0.01; }
      }
      if (mx != null) { const dx = b.x - mx, dy = b.y - my, d2 = dx * dx + dy * dy; if (d2 < 7000 && (!b.t || b.fright)) { const d = Math.sqrt(d2) || 1, f = (1 - d / 84) * 1.4; fx += dx / d * f; fy += dy / d * f; } }
      b.vx += fx * k; b.vy += fy * k;
      const v = Math.hypot(b.vx, b.vy), vmax = b.fright ? 3.2 : b.t ? 12 : b.orb && b.far ? 9 : 3.2, vmin = b.t && !b.fright ? 0 : 1.3;
      if (v > vmax) { b.vx = b.vx / v * vmax; b.vy = b.vy / v * vmax; } else if (v < vmin && v > 0) { b.vx = b.vx / v * vmin; b.vy = b.vy / v * vmin; }
      b.x += b.vx * k; b.y += b.vy * k;
    }
    draw(now);
  }
  function draw(now = 0) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
    ctx.translate(-viewX(), -viewY()); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const b of B) {
      if (offscreen(b)) continue;
      if (b.perched) {
        ctx.globalAlpha = 1; ctx.save(); ctx.translate(b.x - GX * S, b.y - GY * S); ctx.scale(S, S); ctx.fillStyle = b.c; ctx.fill(GLYPH); ctx.restore();
      } else if (!reduced) {
        ctx.globalAlpha = b.t ? 0.95 : 0.5;
        const w = Math.sin(now * 16 + b.ph) * 2.4; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx) * 0.25);
        ctx.strokeStyle = b.c; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-5, w); ctx.quadraticCurveTo(-2.4, -1.2, 0, 0.9); ctx.quadraticCurveTo(2.4, -1.2, 5, w); ctx.stroke(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (opts.debug) drawDebug();
  }
  // debug: the places (crosses), the zone where the swarm circles (ellipse or path) and its attraction point
  function drawDebug() {
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#C8612E'; ctx.fillStyle = '#C8612E';
    for (const b of B) if (b.t) { const x = b.t[0] + origin[0], y = b.t[1] + origin[1]; ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2); ctx.stroke(); }
    if (Z) {
      ctx.setLineDash([4, 4]); ctx.beginPath();
      if (Z.path) Z.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      else ctx.ellipse(Z.x, Z.y, Z.rx, Z.ry, 0, 0, Math.PI * 2);
      ctx.stroke(); ctx.setLineDash([]);
      if (Z.point) { ctx.beginPath(); ctx.arc(Z.point[0], Z.point[1], 4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  // at rest (all perched, nothing moves) nothing is recomputed: the flock is only redrawn on scroll or resize
  let idle = false, dirty = true;
  const wake = () => { dirty = true; };
  addEventListener('scroll', wake, { passive: true }); addEventListener('resize', wake);
  // The step follows real time, not the number of frames: same speed at 60, 120 or 144 Hz.
  // Capped at 3 frames so that a hiccup (throttled tab, garbage collector) does not teleport the flock.
  let prevT = 0;
  const loop = (t) => {
    const dt = prevT ? Math.min(3, (t - prevT) / (1000 / 60)) : 1; prevT = t;
    if (running && (!idle || dirty)) { dirty = false; step(dt); idle = B.every((b) => (b.perched && !b.wait) || (b.away && offscreen(b))); }
    raf = requestAnimationFrame(loop);
  };
  if (reduced) { addEventListener('scroll', () => { if (anchor) { origin = anchor(); B.forEach((b) => { if (b.perched && b.t) { b.x = b.t[0] + origin[0]; b.y = b.t[1] + origin[1]; } }); } draw(); }, { passive: true }); draw(); } else loop();
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
  return {
    perch, fly, scatter,
    setColors(c) { idle = false; colors = c; B.forEach((b, k) => { b.c = colors[k % colors.length]; }); if (reduced) draw(); },
    destroy() { cancelAnimationFrame(raf); removeEventListener('resize', resize); if (sizeWatch) sizeWatch.disconnect(); },
  };
}
