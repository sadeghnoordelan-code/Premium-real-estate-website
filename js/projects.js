/* ============================================================
   BOREAL — Section 02: the collection
   ------------------------------------------------------------
   A split stage, after the supplied reference: the film plate runs
   two thirds of the width, and a navy panel carries the project's
   identity in the remaining third.

   Vertical scroll turns the projects to the right; scrolling back
   reverses them. The plates lag the rail slightly so the movement
   reads as depth rather than a slide. The panel changes with them.

   Every project is reachable three ways: the arrows, the numbered
   index, and the plate itself (which opens its reservation).
   ============================================================ */

import {
  clamp, damp, smoothstep, onTick, onResize, view, pinProgress,
  prefersReducedMotion, isTouch, scrollToY, qs, qsa
} from './core.js';
import { PROJECTS } from './data.js';

const N = PROJECTS.length;
const STACK_QUERY = '(max-width: 1023px)';

/* Survey mark: contour rings + crosshair. Abstract on purpose — a site
   mark, not a map widget. */
function siteMark(p) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'sitemark');
  svg.setAttribute('aria-hidden', 'true');
  const seed = (p.coords.lat * 7.3) % 1;
  let html = '';
  [46, 34, 23, 13].forEach((r, i) => {
    const rr = r + Math.sin(seed * 6.2 + i) * 3.2;
    html += `<circle cx="60" cy="60" r="${rr.toFixed(1)}" class="sitemark__ring" style="--i:${i}"/>`;
  });
  html += `
    <line x1="60" y1="6"  x2="60" y2="34"  class="sitemark__cross"/>
    <line x1="60" y1="86" x2="60" y2="114" class="sitemark__cross"/>
    <line x1="6"  y1="60" x2="34" y2="60"  class="sitemark__cross"/>
    <line x1="86" y1="60" x2="114" y2="60" class="sitemark__cross"/>
    <circle cx="60" cy="60" r="3.1" class="sitemark__dot"/>`;
  svg.innerHTML = html;
  return svg;
}

const firstSentence = (t) => {
  const i = t.indexOf('. ');
  return i < 0 ? t : t.slice(0, i + 1);
};

/* ------------------------------------------------------------ */
export function initProjects() {
  const section = qs('#projects');
  const spacer = qs('[data-projects-spacer]');
  const shotsWrap = qs('[data-shots]');
  const cardsWrap = qs('[data-cards]');
  const indexWrap = qs('[data-rail-dots]');
  const currentEl = qs('[data-rail-current]');
  const meter = qs('[data-rail-meter]');
  if (!section || !shotsWrap || !cardsWrap) return null;

  const reduced = prefersReducedMotion();
  const mq = window.matchMedia(STACK_QUERY);
  const isStacked = () => mq.matches;

  /* ---------- the plates (left two thirds) ----------
     After the third reference: the photograph lives inside a circle that
     grows out of a white disc and is wiped in by a radial sweep. A leader
     line runs from the circle's centre down to the coordinates, and the
     project's other photographs sit beneath it. */
  const shots = PROJECTS.map((p, i) => {
    const g = p.images.gallery;
    const node = document.createElement('article');
    node.className = 'pshot';
    node.style.setProperty('--i', i);   // lets the stacked layout interleave
    node.dataset.theme = p.theme || 'dark';
    node.id = `project-${p.id}`;
    node.setAttribute('aria-label', p.name);

    const plate = (f, k, alt, eager) => `
      <img class="pdisc__img" data-layer="${k}" ${k === 0 ? 'data-on' : ''}
           src="assets/projects/${f}.webp"
           srcset="assets/projects/${f}@sm.webp 760w, assets/projects/${f}.webp 1240w"
           sizes="(max-width:1023px) 86vw, 34vw"
           alt="${alt}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;

    node.innerHTML = `
      <div class="pshot__inner">
        <div class="pdisc-wrap">
          <figure class="pdisc">
            <span class="pdisc__fill" aria-hidden="true"></span>
            ${plate(p.images.main, 0, `${p.name} — ${p.tagline}`, i === 0)}
            ${g.map((im, k) => plate(im.f, k + 1, `${p.name} — ${im.c}`, false)).join('')}
          </figure>
          <span class="pdisc__leader" aria-hidden="true"></span>
          <span class="pdisc__dot" aria-hidden="true"></span>
          <button class="pdisc__hit" data-open-booking data-project="${p.id}"
                  data-cursor-label="Reserve"
                  aria-label="Reserve a viewing of ${p.name}"></button>
        </div>

        <p class="pshot__coords">
          <span>${p.coords.latDMS}</span><span>${p.coords.lonDMS}</span>
        </p>

        <div class="pshot__thumbs" role="group" aria-label="${p.name} photographs">
          <button class="pthumb" data-thumb="0" data-active aria-label="${p.name} — exterior">
            <img src="assets/projects/${p.images.main}@sm.webp" alt="" loading="lazy" decoding="async">
          </button>
          ${g.map((im, k) => `
            <button class="pthumb" data-thumb="${k + 1}" aria-label="${p.name} — ${im.c}">
              <img src="assets/projects/${im.f}@sm.webp" alt="" loading="lazy" decoding="async">
            </button>`).join('')}
        </div>
        <p class="pshot__cap meta" data-cap>${p.location.place}, ${p.location.country} &mdash; ${p.year}</p>
      </div>`;

    shotsWrap.append(node);

    /* the other photographs swap into the same circle */
    const layers = qsa('.pdisc__img', node);
    const thumbs = qsa('.pthumb', node);
    const cap = node.querySelector('[data-cap]');
    thumbs.forEach((t) => t.addEventListener('click', (e) => {
      e.stopPropagation();
      const k = Number(t.dataset.thumb);
      thumbs.forEach((o) => o.toggleAttribute('data-active', o === t));
      layers.forEach((l) => l.toggleAttribute('data-on', Number(l.dataset.layer) === k));
      cap.textContent = k === 0
        ? `${p.location.place}, ${p.location.country} — ${p.year}`
        : g[k - 1].c;
    }));

    return { data: p, node, img: node.querySelector('.pdisc-wrap'), local: 99 };
  });

  /* ---------- the panel (right third, navy) ---------- */
  const cards = PROJECTS.map((p, i) => {
    const node = document.createElement('article');
    node.className = 'pcard';
    node.style.setProperty('--i', i);
    node.innerHTML = `
      <p class="pcard__eyebrow label">${p.style}</p>
      <h3 class="pcard__name display">${p.name}</h3>
      <p class="pcard__tagline">${p.tagline}</p>
      <p class="pcard__desc">${firstSentence(p.description)}</p>

      <dl class="pcard__specs">
        ${p.specs.slice(0, 3).map((s) => `
          <div><dt class="meta">${s.k}</dt><dd>${s.v}</dd></div>`).join('')}
      </dl>

      <div class="pcard__geo">
        <div class="pcard__geo-body">
          <p class="pcard__place">${p.location.place}, ${p.location.region} &mdash; ${p.location.country}</p>
          <p class="pcard__plot meta">${p.plot} &middot; ${p.elevation} &middot; ${p.climate.koppen}</p>
        </div>
        <div class="pcard__mark" data-sitemark></div>
      </div>

      <dl class="pcard__chars">
        ${p.characteristics.map((c) => `
          <div class="pcard__char"><dt>${c.k}</dt><dd>${c.v}</dd></div>`).join('')}
      </dl>

      <div class="pcard__foot">
        <div class="pcard__price">
          <span class="label">Price</span>
          <span class="pcard__price-v display">${p.price.display}</span>
          <span class="meta">${p.status}</span>
        </div>
        <button class="pcard__cta" data-open-booking data-project="${p.id}">
          <span>Reserve Time</span>
          <svg viewBox="0 0 46 8" aria-hidden="true"><path d="M0 4h44m0 0-5-3.5M44 4l-5 3.5"/></svg>
        </button>
      </div>`;
    node.querySelector('[data-sitemark]').append(siteMark(p));
    cardsWrap.append(node);
    return { data: p, node };
  });

  /* ---------- numbered index ---------- */
  PROJECTS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'collindex__b';
    b.setAttribute('aria-label', `Go to ${p.name}`);
    b.innerHTML = `<span class="collindex__n">${p.index}</span>
                   <span class="collindex__name">${p.name.replace(' Cabin', '')}</span>
                   <span class="collindex__rule"></span>`;
    b.addEventListener('click', () => goTo(i));
    indexWrap.append(b);
  });
  const indexBtns = qsa('.collindex__b', indexWrap);
  const headBtns = qsa('[data-goto-project]');
  headBtns.forEach((b) => b.addEventListener('click', () => goTo(Number(b.dataset.gotoProject))));

  /* ---------- navigation ---------- */
  function goTo(i) {
    const k = clamp(i, 0, N - 1);
    if (isStacked()) {
      const r = shots[k].node.getBoundingClientRect();
      scrollToY(window.scrollY + r.top - 64, 1050);
      return;
    }
    const top = window.scrollY + spacer.getBoundingClientRect().top;
    scrollToY(top + (k / (N - 1)) * (spacer.offsetHeight - view.h), 1150);
  }
  qs('[data-rail-prev]')?.addEventListener('click', () => goTo(active - 1));
  qs('[data-rail-next]')?.addEventListener('click', () => goTo(active + 1));

  window.addEventListener('keydown', (e) => {
    if (!pinned || isStacked()) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
  });

  /* ---------- state ---------- */
  let active = -1, pinned = false, head = 0;

  function setActive(a) {
    if (a === active) return;
    active = a;
    indexBtns.forEach((b, i) => b.toggleAttribute('data-active', i === a));
    headBtns.forEach((b, i) => b.toggleAttribute('data-active', i === a));
    cards.forEach((c, i) => c.node.toggleAttribute('data-active', i === a));
    shots.forEach((s, i) => {
      s.node.toggleAttribute('data-active', i === a);
      /* the circle grows out of the white disc each time a project takes
         the stage, so the reveal is tied to activity, not to first paint */
      s.node.toggleAttribute('data-revealed', i === a);
      /* only the project on stage is reachable by keyboard: the others are
         translated off the plate and cannot be scrolled to */
      if (!isStacked()) s.node.inert = i !== a;
    });
    if (currentEl) currentEl.textContent = PROJECTS[a].index;
    section.style.setProperty('--active', a);
    /* the index, eyebrow and meter invert over a light plate */
    const media = document.querySelector('[data-media]');
    if (media) media.dataset.plate = PROJECTS[a].theme || 'dark';
  }

  /* stacked mode drives activity from an observer instead of the rail */
  const io = new IntersectionObserver((entries) => {
    if (!isStacked()) return;
    for (const e of entries) {
      if (!e.isIntersecting || e.intersectionRatio < 0.5) continue;
      const i = shots.findIndex((s) => s.node === e.target);
      if (i >= 0) setActive(i);
    }
  }, { threshold: [0.15, 0.55] });
  shots.forEach((s) => io.observe(s.node));

  /* ---------- per frame ---------- */
  onTick((dt) => {
    const rect = section.getBoundingClientRect();
    if (rect.top > view.h * 1.2 || rect.bottom < -view.h * 0.2) {
      if (pinned) { pinned = false; section.removeAttribute('data-pinned'); }
      return;
    }

    if (isStacked()) return;

    const p = pinProgress(section);
    const nowPinned = rect.top <= 1 && rect.bottom >= view.h - 1;
    if (nowPinned !== pinned) { pinned = nowPinned; section.toggleAttribute('data-pinned', pinned); }

    const target = p * (N - 1);
    head = reduced ? target : damp(head, target, 15, dt);

    setActive(clamp(Math.round(head), 0, N - 1));
    if (meter) meter.style.transform = `scaleX(${(head / (N - 1) || 0).toFixed(4)})`;

    for (let i = 0; i < N; i++) {
      const s = shots[i];
      const local = i - head;            // 0 = on stage, +1 = next, -1 = previous
      const a = Math.abs(local);

      /* the card always gets its state, even when its plate is offstage —
         skipping it here left every card painted on top of the others */
      const c = cards[i];
      const near = smoothstep(clamp(1 - a * 1.7, 0, 1));
      c.node.style.opacity = near.toFixed(3);
      c.node.style.visibility = near < 0.01 ? 'hidden' : 'visible';
      if (near > 0) c.node.style.transform = `translate3d(0,${(local * 34).toFixed(2)}px,0)`;

      if (a > 1.6) {
        if (s.local !== 99) { s.node.style.visibility = 'hidden'; s.local = 99; }
        continue;
      }
      if (s.local === 99) s.node.style.visibility = 'visible';

      /* the plate slides a full width per project; the image inside lags,
         which is what makes it read as depth rather than a card swap */
      s.node.style.transform = `translate3d(${(local * 100).toFixed(3)}%,0,0)`;
      s.img.style.transform = `translate3d(${(-local * 7).toFixed(2)}%,0,0)`;
      s.node.style.opacity = clamp(1 - (a - 0.55) * 2.2, 0, 1).toFixed(3);
      s.local = local;
    }
  });

  onResize(() => { if (!isStacked()) head = pinProgress(section) * (N - 1); });

  /* crossing the breakpoint leaves stale inline transforms behind */
  const clearInline = () => {
    shots.forEach((s, i) => {
      s.node.style.cssText = '';
      s.node.style.setProperty('--i', i);
      s.img.style.cssText = '';
      s.node.inert = false;
      s.local = 99;
    });
    cards.forEach((c, i) => {
      c.node.style.cssText = '';
      c.node.style.setProperty('--i', i);
    });
    if (!isStacked()) head = pinProgress(section) * (N - 1);
  };
  mq.addEventListener('change', clearInline);

  setActive(0);
  if (isStacked()) shots.forEach((s) => s.node.setAttribute('data-revealed', ''));

  return { goTo, get active() { return active; } };
}
