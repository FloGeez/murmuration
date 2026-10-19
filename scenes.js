/* The scene engine: each section of the page describes a scene; the engine picks the one on screen and lands the flock on it.
 *
 *   const scenes = createScenes(murmuration, [
 *     { name: 'wire', active: () => scrollY < 300, pose: () => ({ points: wirePoints(), rest: 'circle', zone: orbit }) },
 *     …
 *   ]);
 *   scenes.update()      // on scroll: switches scene if needed
 *   scenes.update(true)  // the page moved (resize, fonts): lands the flock again on the current scene
 *
 * A scene:
 *   name: its name (shown in debug mode)
 *   active(): true when the scene is on screen; the first active scene, in array order, wins
 *   variant(): optional, for a scene that changes without scrolling (the current step's shape); the engine checks it
 *              twice a second and lands the flock again when it changes
 *   pose({ variant, first, force, same }): the points to land on (points) and the options of murmuration.perch (rest, zone,
 *              anchor, keep, shy, instant). By default, the flock lands at once on the first scene, or when the same scene
 *              is forced again; otherwise it flies to its places.
 * No active scene: the flock flies freely.
 */
export function createScenes(murmuration, scenes, { debug = false } = {}) {
  let key = '', current = null, first = true;
  const label = debug ? createLabel() : null;

  function update(force = false) {
    const scene = scenes.find((s) => s.active());
    const variant = scene && scene.variant ? scene.variant() : '';
    const k = scene ? scene.name + (variant ? ':' + variant : '') : 'fly';
    if (k !== key || force) {
      const same = k === key;
      key = k; current = scene;
      if (!scene) murmuration.fly();
      else {
        const { points, ...options } = scene.pose({ variant, first, force, same });
        murmuration.perch(points, { instant: first || (force && same), ...options });
      }
      if (label) label.textContent = k;
    }
    first = false;
  }
  const timer = setInterval(() => { if (current && current.variant) update(); }, 500);

  return {
    update,
    get scene() { return current ? current.name : 'fly'; },
    destroy() { clearInterval(timer); if (label) label.remove(); },
  };
}

// debug: the current scene's name, bottom left
function createLabel() {
  const e = document.createElement('div');
  e.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;padding:4px 8px;border-radius:6px;background:#1F1E24;color:#FF8A3D;font:500 12px/1.4 "JetBrains Mono",monospace;pointer-events:none';
  document.body.append(e);
  return e;
}
