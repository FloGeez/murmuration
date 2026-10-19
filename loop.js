/* One animation loop for every animated bird (or anything else) on the page.
   animate(update): update(dt) is called on each frame, dt in seconds, capped at 50 ms. It returns false to stop.
   The loop goes to sleep as soon as nothing moves. Returns a function that stops this update. */
const updates = new Set();
let raf = 0, prev = 0;
const tick = (now) => {
  const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now;
  for (const update of [...updates]) if (update(dt) === false) updates.delete(update);
  raf = updates.size ? requestAnimationFrame(tick) : 0;
};
export function animate(update) {
  updates.add(update);
  if (!raf) { prev = performance.now(); raf = requestAnimationFrame(tick); }
  return () => updates.delete(update);
}
