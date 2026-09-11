/* ============================================================
   BOREAL — motion core
   One rAF loop. One easing vocabulary. One scroll reader.
   Everything continuous on the site subscribes here, so we never
   run competing loops or read layout in the middle of a frame.
   ============================================================ */

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (v, a, b) => (b - a === 0 ? 0 : (v - a) / (b - a));
export const mapRange = (v, a, b, c, d) => lerp(c, d, clamp(inv(v, a, b)));
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

/* Frame-rate independent exponential damping.
   A plain lerp(cur, target, 0.1) travels twice as fast on a 120Hz
   panel as on 60Hz. This keeps the feel identical on both. */
export const damp = (cur, target, lambda, dt) =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt));

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- the single rAF bus ---------------- */
const subscribers = new Set();
let running = false;
let lastTime = 0;

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 20); // clamp tab-restore spikes
  lastTime = now;
  for (const fn of subscribers) fn(dt, now);
  if (subscribers.size) requestAnimationFrame(frame);
  else running = false;
}

export function onTick(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }
  return () => subscribers.delete(fn);
}

/* ---------------- scroll + viewport state ----------------
   Read once per frame at most, never inside a subscriber. */
export const view = { w: 0, h: 0, scroll: 0, dpr: 1 };

function measure() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
}
function readScroll() { view.scroll = window.scrollY || window.pageYOffset || 0; }

measure(); readScroll();

const resizeListeners = new Set();
export function onResize(fn) { resizeListeners.add(fn); return () => resizeListeners.delete(fn); }

let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    measure();
    for (const fn of resizeListeners) fn(view);
  });
}, { passive: true });

window.addEventListener('scroll', readScroll, { passive: true });
/* orientation change on iOS reports stale innerHeight for a beat */
window.addEventListener('orientationchange', () => setTimeout(() => {
  measure(); for (const fn of resizeListeners) fn(view);
}, 260));

/* ---------------- progress of an element through the viewport ----------------
   Returns 0 while the element's top is below the fold, 1 once it has
   been fully traversed. Used by every pinned section. */
export function pinProgress(el) {
  const rect = el.getBoundingClientRect();
  const total = rect.height - view.h;
  if (total <= 0) return rect.top <= 0 ? 1 : 0;
  return clamp(-rect.top / total);
}

/* ---------------- reveal observer ---------------- */
export function observeReveals(root = document) {
  const targets = root.querySelectorAll('[data-observe]');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((t) => t.setAttribute('data-inview', ''));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.setAttribute('data-inview', '');
      io.unobserve(e.target); // reveals are one-way; replaying reads as a gimmick
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  targets.forEach((t) => io.observe(t));
  return io;
}

/* ---------------- smooth scroll to a y offset ---------------- */
let scrollAnim = null;
export function scrollToY(targetY, duration = 1150) {
  if (scrollAnim) scrollAnim();
  if (prefersReducedMotion()) { window.scrollTo(0, targetY); return; }

  const startY = window.scrollY;
  const delta = targetY - startY;
  if (Math.abs(delta) < 2) return;
  const start = performance.now();
  let cancelled = false;

  const stop = () => { cancelled = true; window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); };
  window.addEventListener('wheel', stop, { passive: true, once: true });
  window.addEventListener('touchstart', stop, { passive: true, once: true });

  const step = (now) => {
    if (cancelled) { scrollAnim = null; return; }
    const t = clamp((now - start) / duration);
    // expo-out, matching --ease-out
    const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    window.scrollTo(0, startY + delta * e);
    if (t < 1) requestAnimationFrame(step);
    else { scrollAnim = null; stop(); }
  };
  requestAnimationFrame(step);
  scrollAnim = stop;
}

/* ---------------- misc ---------------- */
export const isTouch = () =>
  window.matchMedia('(hover: none), (pointer: coarse)').matches;

export const qs = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}
