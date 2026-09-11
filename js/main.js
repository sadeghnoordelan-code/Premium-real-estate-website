/* ============================================================
   BOREAL — boot
   Each subsystem is isolated so a failure in one never takes the
   page down with it.
   ============================================================ */

import {
  clamp, damp, onTick, onResize, view, observeReveals,
  scrollToY, prefersReducedMotion, isTouch, qs, qsa
} from './core.js';
import { initHero } from './hero.js';
import { initProjects } from './projects.js';
import { initBooking } from './booking.js';

const safe = (name, fn) => {
  try { return fn(); }
  catch (err) { console.error(`[boreal] ${name} failed:`, err); return null; }
};

/* ------------------------------------------------------------
   Preloader
   ------------------------------------------------------------ */
function makePreloader() {
  const root = qs('[data-preloader]');
  const bar = qs('[data-preload-bar]');
  const pct = qs('[data-preload-pct]');
  let shown = 0, target = 0, done = false;

  const stop = onTick((dt) => {
    shown = damp(shown, target, 6, dt);
    const v = Math.min(Math.round(shown * 100), 100);
    if (bar) bar.style.transform = `scaleX(${shown.toFixed(4)})`;
    if (pct) pct.textContent = String(v).padStart(2, '0');
    if (done && v >= 100) { stop(); }
  });

  return {
    set(p) { target = clamp(p, 0, 1); },
    async finish() {
      target = 1;
      done = true;
      await new Promise((r) => setTimeout(r, 420));
      root?.setAttribute('data-done', '');
      document.documentElement.setAttribute('data-booted', '');
      setTimeout(() => { root?.remove(); stop(); }, 1100);
    }
  };
}

/* ------------------------------------------------------------
   Header — adapts to whatever is under it
   ------------------------------------------------------------ */
function initHeader() {
  const header = qs('[data-header]');
  const hero = qs('#hero');
  const projects = qs('#projects');
  const projectNav = qs('[data-project-nav]');
  const burger = qs('[data-burger]');
  const menu = qs('[data-menu]');
  if (!header) return;

  let dark = null, solid = null, navOn = null;

  const contact = qs('#contact');

  onTick(() => {
    const hb = hero ? hero.getBoundingClientRect().bottom : 0;
    const overFilm = hb > 96;

    /* the film and the collection are dark; the contact section is not */
    const overContact = contact ? contact.getBoundingClientRect().top <= 96 : false;
    const wantDark = !overContact;
    if (wantDark !== dark) {
      dark = wantDark;
      if (dark) header.setAttribute('data-theme', 'dark');
      else header.removeAttribute('data-theme');
    }

    const wantSolid = !overFilm && view.scroll > 30;
    if (wantSolid !== solid) {
      solid = wantSolid;
      header.toggleAttribute('data-solid', wantSolid);
    }

    if (projects && projectNav) {
      const r = projects.getBoundingClientRect();
      const on = r.top < view.h * 0.55 && r.bottom > view.h * 0.45;
      if (on !== navOn) { navOn = on; projectNav.toggleAttribute('data-visible', on); }
    }
  });

  /* ---- mobile menu ---- */
  let open = false;
  const setMenu = (v) => {
    open = v;
    header.toggleAttribute('data-menu-open', v);
    burger?.setAttribute('aria-expanded', String(v));
    burger?.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    if (v) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.setAttribute('data-open', ''));
      document.body.setAttribute('data-locked', '');
    } else {
      menu.removeAttribute('data-open');
      document.body.removeAttribute('data-locked');
      setTimeout(() => { if (!open) menu.hidden = true; }, 620);
    }
  };
  burger?.addEventListener('click', () => setMenu(!open));
  qsa('[data-menu-close]').forEach((b) => b.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setMenu(false); });

  return { closeMenu: () => setMenu(false) };
}

/* ------------------------------------------------------------
   Anchor navigation — one smooth-scroll implementation
   ------------------------------------------------------------ */
function initNav() {
  qsa('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      const el = qs(id);
      if (!el) return;
      e.preventDefault();
      const hero = qs('#hero');
      if (id === '#hero') {
        window.scrollTo(0, 0);
        hero?.dispatchEvent(new CustomEvent('boreal:rewind'));
        history.replaceState(null, '', id);
        return;
      }
      // the hero holds the wheel and locks the page; let it go first
      hero?.dispatchEvent(new CustomEvent('boreal:release'));
      requestAnimationFrame(() => {
        const y = window.scrollY + el.getBoundingClientRect().top;
        scrollToY(y, 1250);
      });
      history.replaceState(null, '', id);
    });
  });
}

/* ------------------------------------------------------------
   Cursor — desktop only, and only where it adds information
   ------------------------------------------------------------ */
function initCursor() {
  if (isTouch() || prefersReducedMotion()) return;
  const root = qs('[data-cursor]');
  const dot = qs('.cursor__dot');
  const ring = qs('.cursor__ring');
  const label = qs('.cursor__label');
  if (!root) return;

  document.documentElement.setAttribute('data-custom-cursor', '');
  let x = view.w / 2, y = view.h / 2, tx = x, ty = y;
  let rx = x, ry = y, visible = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY;
    if (!visible) { visible = true; root.setAttribute('data-on', ''); x = tx; y = ty; rx = tx; ry = ty; }

    const hit = e.target.closest?.('a,button,[data-cursor-label],input,select,textarea,label');
    const text = hit?.dataset?.cursorLabel;
    root.toggleAttribute('data-hover', !!hit);
    if (label) label.textContent = text || '';
    root.toggleAttribute('data-labelled', !!text);
  }, { passive: true });

  document.addEventListener('pointerleave', () => { visible = false; root.removeAttribute('data-on'); });
  window.addEventListener('pointerdown', () => root.setAttribute('data-down', ''));
  window.addEventListener('pointerup', () => root.removeAttribute('data-down'));

  onTick((dt) => {
    if (!visible) return;
    x = damp(x, tx, 34, dt);   // dot tracks tightly
    y = damp(y, ty, 34, dt);
    rx = damp(rx, tx, 11, dt); // ring trails, giving the motion weight
    ry = damp(ry, ty, 11, dt);
    dot.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0) translate(-50%,-50%)`;
  });
}

/* ------------------------------------------------------------
   Light parallax for anything tagged [data-parallax]
   ------------------------------------------------------------ */
function initParallax() {
  if (prefersReducedMotion()) return;
  const items = qsa('[data-parallax]');
  if (!items.length) return;
  const state = items.map((el) => ({ el, k: parseFloat(el.dataset.parallax) || 0.08, y: 0 }));

  onTick((dt) => {
    for (const s of state) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > view.h + 80) continue;
      const centre = r.top + r.height / 2;
      const off = (centre - view.h / 2) / view.h;   // -1 .. 1
      const target = -off * s.k * view.h * 0.5;
      s.y = damp(s.y, target, 7, dt);
      s.el.style.transform = `translate3d(0,${s.y.toFixed(2)}px,0) scale(1.08)`;
    }
  });
}

/* ------------------------------------------------------------ */
function boot() {
  /* the file:// fallback in index.html may also reach here */
  if (window.__BOREAL_BOOTED__) return;
  window.__BOREAL_BOOTED__ = true;

  /* The hero locks the page, so a browser-restored scroll offset would drop
     the visitor into the middle of the document with the film still at its
     start. Reloads begin at the top; a real deep link is handled below. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!/^#(projects|contact|project-)/.test(location.hash)) window.scrollTo(0, 0);

  const pre = makePreloader();
  const yr = qs('[data-year]');
  if (yr) yr.textContent = String(new Date().getFullYear());

  safe('header', initHeader);
  safe('nav', initNav);
  safe('cursor', initCursor);
  safe('parallax', initParallax);
  safe('reveals', () => observeReveals());

  const projects = safe('projects', initProjects);
  safe('booking', () => initBooking({ projects }));

  const hero = safe('hero', () => initHero({ onProgress: (p) => pre.set(p * 0.94) }));

  const ready = hero?.ready ?? Promise.resolve();
  const cap = new Promise((r) => setTimeout(r, 9000));   // never trap the user
  Promise.race([ready, cap]).then(() => pre.finish());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
