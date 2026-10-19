/* Shapes the flock draws, and their sampling into landing points.
   A shape is a function that draws on a 720 × 640 canvas: fill (black), then hollow out (destination-out). The birds fill
   the matter, and the shape reads through mass and holes, like a real murmuration. Each shape must read in one second.

     const ring = (g) => { solid(g); g.beginPath(); g.arc(360, 320, 260, 0, 6.2832); g.fill(); hollow(g); g.beginPath(); g.arc(360, 320, 150, 0, 6.2832); g.fill(); solid(g); };
     const points = sampleShape(ring, 300);                     // [[x, y], …] in the 720 × 640 frame
     m.perch(fitShape(points, box), { anchor: () => [box.left + scrollX, box.top + scrollY] }); */
export const SHAPE_WIDTH = 720, SHAPE_HEIGHT = 640;
const W = SHAPE_WIDTH, H = SHAPE_HEIGHT;

/* ——— Drawing helpers, for writing shapes ——— */
export const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
export const solid = (g) => { g.globalCompositeOperation = 'source-over'; };
export const hollow = (g) => { g.globalCompositeOperation = 'destination-out'; };
export const stroke = (g, x1, y1, x2, y2, width) => { g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };

/* ——— Sampling ——— */
const mask = (draw) => {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.strokeStyle = '#000'; draw(g);
  return g.getImageData(0, 0, W, H).data;
};
const inside = (d, x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 128; };
const fill = (d, De) => {
  const pts = [], cell = new Map(), C = De;
  const key = (i, j) => i * 1000 + j;
  const add = (x, y) => { const k = key(Math.floor(x / C), Math.floor(y / C)); (cell.get(k) || cell.set(k, []).get(k)).push([x, y]); pts.push([x, y]); };
  const near = (x, y, r) => { const cx = Math.floor(x / C), cy = Math.floor(y / C), n = Math.ceil(r / C); for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const l = cell.get(key(cx + i, cy + j)); if (l) for (const q of l) if ((q[0] - x) ** 2 + (q[1] - y) ** 2 < r * r) return true; } return false; };
  // the outline, tight, for legibility…
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (!inside(d, x, y) || (inside(d, x + 4, y) && inside(d, x - 4, y) && inside(d, x, y + 4) && inside(d, x, y - 4))) continue;
    if (!near(x, y, De)) add(x, y);
  }
  // …and the inside, sparse, for the matter (a triangular grid)
  const Di = De * 2.1, dy = Di * 0.866;
  for (let y = Di / 2, r = 0; y < H; y += dy, r++) for (let x = (r % 2 ? Di / 2 : 0) + Di / 4; x < W; x += Di) if (inside(d, x, y) && !near(x, y, De * 1.1)) add(x, y);
  return pts;
};
const fontsReady = () => !document.fonts || document.fonts.status === 'loaded';
const cache = new Map();
/** Landing points that draw the shape `draw` (720 × 640 frame), about `count` of them.
    The result is cached per shape and count; a shape that changes gives its key, as `draw.key()`
    or as the `key` option (a clock: key = the current minute). A shape that writes text is only cached once the fonts are loaded. */
export const sampleShape = (draw, count, { key = draw.key ? draw.key() : '' } = {}) => {
  let perShape = cache.get(draw); if (!perShape) cache.set(draw, (perShape = new Map()));
  const k = key + '/' + count;
  if (perShape.has(k)) return perShape.get(k);
  const d = mask(draw); let lo = 4, hi = 64, best = fill(d, 30);
  for (let i = 0; i < 8; i++) { const D = (lo + hi) / 2, p = fill(d, D); if (p.length > count) lo = D; else { hi = D; best = p; } }
  if (fontsReady()) perShape.set(k, best);
  return best;
};
/** Fits shape points (720 × 640 frame) into a box of width × height, centred: points relative to the box's top-left corner.
    zoom > 1 lets the shape overflow the box a little. */
export const fitShape = (points, { width, height }, { zoom = 1, dx = 0, dy = 0 } = {}) => {
  const k = Math.min(width / W, height / H) * zoom, ox = (width - W * k) / 2 + dx, oy = (height - H * k) / 2 + dy;
  return points.map(([x, y]) => [ox + x * k, oy + y * k]);
};
