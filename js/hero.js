/* ============================================================
   BOREAL — Section 01: the scroll-scrubbed film
   ------------------------------------------------------------
   One persistent <video>, muted and permanently paused, whose
   timeline is driven entirely by accumulated wheel input.

     wheel -> normalised delta -> accumulated target frame
           -> rAF-damped current frame -> gated video.currentTime

   Three things were each independently fatal, all confirmed by
   measurement against the real 391-frame film:

   1. The source .MOV cannot be decoded by Chrome at all, and its GOP of
      29 made every seek decode up to 29 frames. The film is re-encoded
      all-intra (every frame a keyframe): seek latency 3-6ms vs 13-20ms
      at GOP 3, worst-case 1 frame of jump while scrubbing slowly.

   2. A plain src only ever buffers ~3.4s of a 13s paused video. The file
      is fetched in full and played from a Blob, so the entire timeline is
      resident in memory before scrubbing begins.

   3. Assigning currentTime every frame aborts the in-flight seek — 40
      assignments produced 1 presented frame. Seeks are gated: never more
      than one in flight, always targeting the newest requested time.
      That yields ~40 completed seeks/second, above the film's 30fps.

   If the video cannot be prepared, the renderer falls back to a
   pre-decoded still sequence driven by exactly the same input model.
   ============================================================ */

import {
  clamp, inv, lerp, damp, smoothstep, onTick, onResize, view,
  prefersReducedMotion, isTouch, qs
} from './core.js';
import { HERO_BEATS } from './data.js';

const FPS = 30;
const FRAMES = 391;           // 0 .. 390, one continuous timeline
const LAST = FRAMES - 1;

/* Wheel feel. gainFine is what an isolated nudge is worth; gainCoarse is
   what a sustained roll ramps up to. Both are frames per normalised pixel,
   so one 100px notch = 100 * gain frames. */
const FEEL = {
  gainFine: 1.8 / 100,      // a small deliberate increment ~= 1.8 frames
  gainCoarse: 15 / 100,     // held / rolled ~= 15 frames per notch
  rollAttack: 1 / 850,      // how fast a sustained roll builds
  rollDecay: 2.6,           // and how fast it falls away once you stop
  clampEvent: 180,          // a single wheel event can never exceed this
  lambda: 13,               // rAF smoothing toward the target
  lambdaGain: 0.9,
  lambdaCap: 30,
  snap: 0.004
};

const VIDEO_TIERS = [
  { min: 2000, src: 'assets/video/hero-lg.mp4' },
  { min: 1200, src: 'assets/video/hero-md.mp4' },
  { min: 0, src: 'assets/video/hero-sm.mp4' }
];

function pickVideo() {
  const c = navigator.connection || {};
  const slow = c.saveData === true || /(^|-)(slow-)?2g$/.test(c.effectiveType || '');
  if (slow) return VIDEO_TIERS[VIDEO_TIERS.length - 1].src;
  const px = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
  return (VIDEO_TIERS.find((t) => px >= t.min) || VIDEO_TIERS[2]).src;
}

/* ------------------------------------------------------------
   Fallback renderer: the pre-decoded still sequence.
   ------------------------------------------------------------ */
const FRAME_TIERS = { medium: 'w1100', small: 'w720' };
const SKELETON_STRIDE = 8;
const MAX_INFLIGHT = 8;

class FrameSequence {
  constructor(dir, count) {
    this.dir = dir; this.count = count;
    this.frames = new Array(count).fill(null);
    this.state = new Uint8Array(count);      // 0 empty 1 loading 2 ready 3 failed
    this.pending = new Array(count).fill(null);
    this.loaded = 0; this.inflight = 0;
    this._cache = { want: -1, got: -1 };
  }
  url(i) { return `assets/hero/${this.dir}/${String(i + 1).padStart(4, '0')}.webp`; }
  load(i) {
    if (i < 0 || i >= this.count) return Promise.resolve(false);
    if (this.state[i] === 2) return Promise.resolve(true);
    if (this.pending[i]) return this.pending[i];
    this.state[i] = 1; this.inflight++;
    const p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      const done = (ok) => {
        this.inflight--; this.pending[i] = null;
        if (ok) { this.frames[i] = img; this.state[i] = 2; this.loaded++; this._cache.want = -1; }
        else this.state[i] = 3;
        resolve(ok);
      };
      img.onload = () => (img.decode ? img.decode().then(() => done(true)).catch(() => done(true)) : done(true));
      img.onerror = () => done(false);
      img.src = this.url(i);
    });
    this.pending[i] = p;
    return p;
  }
  async loadSkeleton(onProgress) {
    const idx = [];
    for (let i = 0; i < this.count; i += SKELETON_STRIDE) idx.push(i);
    if (idx[idx.length - 1] !== this.count - 1) idx.push(this.count - 1);
    let cursor = 0, settled = 0;
    const worker = async () => {
      while (cursor < idx.length) { await this.load(idx[cursor++]); onProgress?.(++settled / idx.length); }
    };
    await Promise.race([
      Promise.all(Array.from({ length: Math.min(MAX_INFLIGHT, idx.length) }, worker)),
      new Promise((r) => setTimeout(r, 15000))
    ]);
  }
  pump(center) {
    if (this.loaded >= this.count) return;
    let guard = 0;
    while (this.inflight < MAX_INFLIGHT && guard++ < 4) {
      const c = Math.round(clamp(center, 0, this.count - 1));
      let found = -1;
      for (let d = 0; d < this.count; d++) {
        if (c + d < this.count && this.state[c + d] === 0) { found = c + d; break; }
        if (c - d >= 0 && this.state[c - d] === 0) { found = c - d; break; }
      }
      if (found < 0) return;
      this.load(found);
    }
  }
  nearestReady(i) {
    const want = Math.round(clamp(i, 0, this.count - 1));
    if (this.state[want] === 2) return want;
    if (this._cache.want === want) return this._cache.got;
    for (let d = 1; d < this.count; d++) {
      if (want + d < this.count && this.state[want + d] === 2) { this._cache = { want, got: want + d }; return want + d; }
      if (want - d >= 0 && this.state[want - d] === 2) { this._cache = { want, got: want - d }; return want - d; }
    }
    return -1;
  }
}

/* ------------------------------------------------------------ */
export function initHero({ onProgress } = {}) {
  const section = qs('#hero');
  const video = qs('.hero__video');
  const canvas = qs('.hero__canvas');
  const copyRoot = qs('.hero__copy');
  const counter = qs('[data-hero-counter]');
  const bar = qs('[data-hero-bar]');
  const cue = qs('.hero__cue');
  if (!section || !video) return { ready: Promise.resolve() };

  const reduced = prefersReducedMotion();
  const root = document.documentElement;

  /* ---------- copy beats ---------- */
  const beats = HERO_BEATS.map((b) => {
    const node = document.createElement('article');
    node.className = 'hero-beat';
    node.innerHTML = `
      <p class="hero-beat__kicker label">${b.kicker}</p>
      <h2 class="hero-beat__title display">
        <span class="reveal-line" style="--i:0"><span>${b.line1}</span></span>
        <span class="reveal-line" style="--i:1"><span><em>${b.line2}</em></span></span>
      </h2>
      <p class="hero-beat__body">${b.body}</p>`;
    copyRoot.append(node);
    return { ...b, node, alpha: -1, on: false };
  });

  /* ---------- shared timeline state ---------- */
  let target = 0;        // frame the input asks for  (0 .. 390, fractional)
  let current = 0;       // damped frame actually shown
  let roll = 0;          // 0..1 sustained-roll intensity
  /* The hero owns the wheel until the film ends. Reduced motion does NOT
     disable this: the film only ever moves in direct response to the
     user's own input, and it stops the instant they stop. What reduced
     motion removes is the easing and the decorative animation. Deep-linking
     straight to another section skips the film entirely. */
  let locked = !/^#(projects|contact|project-)/.test(location.hash) && window.scrollY <= 4;
  let engaged = false;
  let mode = 'video';
  let live = false;      // the renderer is prepared and safe to drive
  let seq = null;
  const DIAG = (window.__heroDiag = { target: 0, current: 0, shown: -1, seeks: 0, done: 0, skipped: 0, mode });

  /* ============================================================
     RENDERER A — the video element
     ============================================================ */
  let duration = FRAMES / FPS;
  let seeking = false, wantTime = null;

  function flushSeek() {
    if (wantTime == null) { seeking = false; return; }
    const t = wantTime; wantTime = null;
    seeking = true;
    DIAG.seeks++;
    try { video.currentTime = t; } catch { seeking = false; }
  }
  video.addEventListener('seeked', () => { DIAG.done++; seeking = false; flushSeek(); });
  video.addEventListener('error', () => { seeking = false; });

  let lastSent = -1;
  function showFrameVideo(frame) {
    // idle: nothing moved, so do not spend a seek on it
    if (Math.abs(frame - lastSent) < 0.02) return;
    if (seeking) DIAG.skipped++;
    lastSent = frame;
    // aim at the middle of the frame's interval so rounding never lands short
    wantTime = clamp((frame + 0.5) / FPS, 0, Math.max(0, duration - 1 / (2 * FPS)));
    if (!seeking) flushSeek();
    DIAG.shown = frame;
  }

  /* ============================================================
     RENDERER B — pre-decoded stills (only if the video cannot run)
     ============================================================ */
  let ctx = null, cw = 0, ch = 0, lastDrawn = -1;
  function sizeCanvas() {
    const dpr = view.dpr;
    cw = Math.round(view.w * dpr); ch = Math.round(view.h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; lastDrawn = -1; }
  }
  function showFrameCanvas(frame) {
    const lo = Math.floor(frame), frac = frame - lo;
    const a = seq.nearestReady(lo);
    if (a < 0) return;
    const imgA = seq.frames[a];
    const iw = imgA.naturalWidth, ih = imgA.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(cw / iw, ch / ih) * 1.045;
    const w = iw * s, h = ih * s, x = (cw - w) / 2, y = (ch - h) / 2;
    ctx.globalAlpha = 1;
    ctx.drawImage(imgA, x, y, w, h);
    if (frac > 0.012 && a === lo && lo + 1 < seq.count && seq.state[lo + 1] === 2) {
      ctx.globalAlpha = frac;
      ctx.drawImage(seq.frames[lo + 1], x, y, w, h);
      ctx.globalAlpha = 1;
    }
    lastDrawn = frame;
    DIAG.shown = frame;
  }

  /* ============================================================
     INPUT — normalised wheel, accumulated, never applied directly
     ============================================================ */
  function normalise(e) {
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;             // lines
    else if (e.deltaMode === 2) d *= view.h;    // pages
    return clamp(d, -FEEL.clampEvent, FEEL.clampEvent);
  }

  function advance(delta) {
    // a lone nudge is fine-grained; a sustained roll progressively opens up
    roll = clamp(roll + Math.abs(delta) * FEEL.rollAttack, 0, 1);
    const gain = lerp(FEEL.gainFine, FEEL.gainCoarse, smoothstep(roll));
    target = clamp(target + delta * gain, 0, LAST);
    DIAG.target = target;
  }

  const setLock = (v) => {
    if (v === locked) return;
    locked = v;
    root.toggleAttribute('data-hero-lock', v);
  };
  if (locked) root.setAttribute('data-hero-lock', '');
  else { target = LAST; current = LAST; }   // arrived past the hero

  function onWheel(e) {
    const down = e.deltaY > 0;

    if (!locked) {
      // coming back up to the very top re-engages the film, in reverse
      if (!down && window.scrollY <= 1) setLock(true);
      else return;
    }
    // at the end of the film, hand the wheel back to the page
    if (down && target >= LAST - 0.001) { setLock(false); return; }

    e.preventDefault();
    advance(normalise(e));
  }
  window.addEventListener('wheel', onWheel, { passive: false });

  /* touch: drag up runs the film forward */
  let touchY = null;
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY == null) return;
    const y = e.touches[0].clientY;
    const d = (touchY - y) * 2.4;
    touchY = y;
    if (!locked) { if (d < 0 && window.scrollY <= 1) setLock(true); else return; }
    if (d > 0 && target >= LAST - 0.001) { setLock(false); return; }
    e.preventDefault();
    advance(clamp(d, -FEEL.clampEvent, FEEL.clampEvent));
  }, { passive: false });

  /* keyboard */
  window.addEventListener('keydown', (e) => {
    if (!locked) return;
    if (e.key === 'End') { e.preventDefault(); target = LAST; setLock(false); return; }
    if (e.key === 'Home') { e.preventDefault(); target = 0; return; }
    const step = { ArrowDown: 6, ArrowUp: -6, PageDown: 48, PageUp: -48, ' ': 48 }[e.key];
    if (step == null) return;
    e.preventDefault();
    target = clamp(target + step, 0, LAST);
    if (target >= LAST - 0.001 && step > 0) setLock(false);
  });

  /* navigation away from the hero releases the wheel; navigation back to
     it rewinds the film and takes the wheel again */
  section.addEventListener('boreal:release', () => { target = LAST; current = LAST; setLock(false); });
  section.addEventListener('boreal:rewind', () => {
    target = 0; current = 0; roll = 0;
    setLock(true);
  });

  /* ============================================================
     THE LOOP — the only place the timeline is written
     ============================================================ */
  onResize(() => { if (mode === 'frames') sizeCanvas(); });

  onTick((dt) => {
    roll = damp(roll, 0, FEEL.rollDecay, dt);

    /* This interpolation is NOT decorative easing, so it is not gated on
       prefers-reduced-motion: it is the only thing that turns a discrete
       wheel notch into continuous playback. Snapping straight to the
       target makes the film jump several frames at once, which is both
       uglier and more jarring than gliding through them. */
    const gap = Math.abs(target - current);
    const lambda = FEEL.lambda + Math.min(gap * FEEL.lambdaGain, FEEL.lambdaCap);
    current = damp(current, target, lambda, dt);
    if (gap < FEEL.snap) current = target;
    DIAG.current = current;

    if (!live) { updateCopy(current / LAST); updateHud(current / LAST); return; }

    if (mode === 'video') {
      showFrameVideo(current);
    } else if (seq) {
      seq.pump(current);
      if (Math.abs(current - lastDrawn) > 0.008) showFrameCanvas(current);
    }

    const p = current / LAST;
    updateCopy(p);
    updateHud(p);
  });

  /* ---------- copy + HUD, driven by progress ---------- */
  function updateCopy(p) {
    for (const b of beats) {
      const span = b.to - b.from;
      let a = 0;
      if (p >= b.from && p <= b.to) {
        const inT = b.from === 0 ? 0 : span * 0.24;
        const outT = b.to >= 1 ? 0 : span * 0.28;
        if (inT > 0 && p < b.from + inT) a = smoothstep(inv(p, b.from, b.from + inT));
        else if (outT > 0 && p > b.to - outT) a = 1 - smoothstep(inv(p, b.to - outT, b.to));
        else a = 1;
      }
      if (Math.abs(a - b.alpha) > 0.004) {
        b.alpha = a;
        const drift = (inv(clamp(p, b.from, b.to), b.from, b.to) - 0.5) * -46;
        b.node.style.opacity = a.toFixed(3);
        b.node.style.transform = `translate3d(0,${drift.toFixed(2)}px,0)`;
        b.node.style.visibility = a < 0.01 ? 'hidden' : 'visible';
      }
      const on = a > 0.34;
      if (on !== b.on) { b.on = on; b.node.toggleAttribute('data-inview', on); }
    }
  }

  function updateHud(p) {
    if (counter) counter.textContent = `${String(Math.round(current) + 1).padStart(3, '0')} / ${FRAMES}`;
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (cue) {
      const hide = p > 0.008;
      if (hide !== engaged) { engaged = hide; cue.toggleAttribute('data-hidden', hide); }
    }
    section.style.setProperty('--hero-p', p.toFixed(4));
  }

  /* ============================================================
     BOOT — full preload, then hand over
     ============================================================ */
  async function preloadVideo(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('http ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body) { onProgress?.(1); return URL.createObjectURL(await res.blob()); }
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (total) onProgress?.(clamp(got / total, 0, 1));
    }
    onProgress?.(1);
    return URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
  }

  async function startVideo() {
    const file = pickVideo();
    /* fetch() is blocked on file://, and a local file needs no buffering
       strategy anyway — hand the path straight to the element. */
    const direct = location.protocol === 'file:';
    const url = direct ? file : await preloadVideo(file);
    if (direct) onProgress?.(1);
    video.src = url;
    video.muted = true;
    await new Promise((res, rej) => {
      if (video.readyState >= 2) { res(); return; }
      video.addEventListener('loadeddata', res, { once: true });
      video.addEventListener('canplay', res, { once: true });
      video.addEventListener('error', () => rej(new Error('decode')), { once: true });
      setTimeout(() => (video.readyState >= 2 ? res() : rej(new Error('timeout'))), 20000);
    });
    if (!video.duration || !isFinite(video.duration)) throw new Error('no duration');
    video.pause();
    duration = video.duration;
    live = true;
    lastSent = -1;
    showFrameVideo(0);
  }

  async function startFrames() {
    mode = 'frames'; DIAG.mode = 'frames';
    section.setAttribute('data-fallback', '');
    const dir = isTouch() && window.innerWidth < 900 ? FRAME_TIERS.small : FRAME_TIERS.medium;
    seq = new FrameSequence(dir, dir === FRAME_TIERS.small ? 196 : 391);
    ctx = canvas.getContext('2d', { alpha: false });
    sizeCanvas();
    await seq.loadSkeleton(onProgress);
    live = true;
    showFrameCanvas(0);
  }

  const ready = (async () => {
    try {
      await startVideo();
    } catch (err) {
      console.warn('[boreal] video scrubbing unavailable, using frame sequence:', err.message);
      try { await startFrames(); } catch (e2) { console.error('[boreal] hero failed:', e2); }
    }
    section.setAttribute('data-ready', '');
    section.setAttribute('data-mode', mode);
  })();

  return { ready, get mode() { return mode; } };
}
