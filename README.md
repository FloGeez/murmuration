# murmuration

A flock of birds that draws shapes. The birds land on a list of points, settle tight on a shape's outline and sparse inside it, circle a zone above it, shy away from the pointer, and follow the page section by section. One canvas, plain ES modules, no build, no dependency.

It is the engine behind the starlings of [florian-etourneau.dev](https://florian-etourneau.dev). Birds are only the default: give it a fish, a leaf or a dot and it becomes a school, a gust or a swarm of fireflies. **[Try the demo](https://flogeez.github.io/murmuration/demo/)**: type a word, change the glyph.

```sh
npm i @flogeez/murmuration
```

## A flock in a canvas

```js
import { createMurmuration, sampleShape, fitShape, solid, hollow } from '@flogeez/murmuration';

const ring = (g) => { solid(g); g.beginPath(); g.arc(360, 320, 260, 0, 6.2832); g.fill(); hollow(g); g.beginPath(); g.arc(360, 320, 150, 0, 6.2832); g.fill(); solid(g); };

const m = createMurmuration(canvas, { frame: 'canvas', count: 320 });
m.perch(fitShape(sampleShape(ring, 288), { width: canvas.clientWidth, height: canvas.clientHeight }), {
  rest: 'circle', zone: () => ({ x: canvas.clientWidth / 2, y: 40, rx: canvas.clientWidth * 0.3, ry: 20 }),
});
```

`m.fly()` lets the flock fly freely, `m.scatter()` sends it away, `m.setColors(colors)` and `m.setGlyph(glyph)` restyle it, `m.destroy()` cleans up.

## Options

`createMurmuration(canvas, options)`:

| Option | Default | |
| --- | --- | --- |
| `frame` | `'page'` | `'page'`: a fixed canvas over the whole page, the birds in document coordinates. `'canvas'`: the flock lives inside the canvas, in its own coordinates, with soft walls |
| `count` | `170` | How many birds |
| `colors` | two greys | The birds' colours, in turn |
| `glyph` | `PLAIN_BIRD` | The perched bird: `{ path, anchor, scale, flight }`, an SVG path facing right, the point that sits on its place, its scale, and how it travels: `'wings'` (default, flapping wings) or `'glyph'` (the glyph itself, turned towards its heading) |
| `scale` | the glyph's | Overrides the glyph's scale |
| `debug` | `false` | Shows the places, the swarm's zone and the current scene |

`m.perch(points, options)`:

| Option | |
| --- | --- |
| `rest` | Birds without a place: `'fly'` (default), `'double'` (squeeze next to a perched one), `'circle'` (in `zone`), `'leave'` |
| `zone` | Function returning an ellipse `{ x, y, rx, ry }` or a path `{ path: [[x, y], …] }` where the swarm circles |
| `keep` | With `'circle'`: how many birds circle; the others leave |
| `anchor` | Function returning the origin `[x, y]` of the points: the shape follows a moving element |
| `shy` | Perched birds fly off when the pointer comes close, then land again |
| `instant` | Land at once |

`prefers-reduced-motion` is honoured: the birds are placed without moving.

## Shapes

A shape is a function that draws on a 720 × 640 canvas: fill the matter (`solid`), hollow out the holes (`hollow`). `sampleShape(draw, count)` turns it into about `count` landing points, cached per shape; `fitShape(points, { width, height }, { zoom, dx, dy })` centres them in a box. A shape that changes over time gives its cache key, as `draw.key()` or the `{ key }` option.

## A page in scenes

```js
import { createScenes } from '@flogeez/murmuration';

const scenes = createScenes(m, [
  { name: 'hero', active: () => scrollY < 300, pose: ({ first }) => ({ points: wirePoints(), instant: first, rest: 'circle', zone: heroOrbit }) },
  { name: 'story', active: () => inView(story), variant: () => step.dataset.shape, pose: ({ variant }) => ({ points: shapePoints(variant), anchor: origin }) },
]);
addEventListener('scroll', () => requestAnimationFrame(() => scenes.update()), { passive: true });
```

The first active scene wins; no active scene, the flock flies freely. `variant()` re-lands the flock when a scene changes without scrolling; `update(true)` lands it again after a resize.

`animate(update)` is a shared animation loop for anything else that moves: `update(dt)` returns `false` to stop.

## Demo

`npx serve .`, then open `demo/`.

## License

MIT, see [LICENSE](LICENSE).
