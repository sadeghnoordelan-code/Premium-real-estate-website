/* ============================================================
   BOREAL — reservation flow
   Not a fourth section: a hidden overlay that only exists once a
   visitor asks to see a specific house. It reads
   PROJECT -> DATE -> TIME -> DETAILS -> CONFIRMATION.
   No backend; the confirmation is produced locally.
   ============================================================ */

import { qs, qsa, el } from './core.js';
import { PROJECTS, SLOTS } from './data.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a && b && iso(a) === iso(b);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* Deterministic "already booked" slots, so the diary looks real and
   does not reshuffle every time the calendar re-renders. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
function slotsFor(date, projectId) {
  const dow = (date.getDay() + 6) % 7;                 // 0 = Monday
  const base = dow === 6 ? SLOTS.sunday : dow === 5 ? SLOTS.saturday : SLOTS.weekday;
  return base.map((t) => ({ time: t, taken: hash(iso(date) + projectId + t) % 7 === 0 }));
}
const hasOpenSlot = (date, pid) => slotsFor(date, pid).some((s) => !s.taken);

export function initBooking({ projects } = {}) {
  const root = qs('[data-booking]');
  const inner = qs('[data-booking-inner]');
  const scrim = qs('[data-booking-scrim]');
  if (!root || !inner) return null;

  const state = {
    project: PROJECTS[0],
    month: startOfDay(new Date()),
    date: null,
    time: null,
    open: false,
    confirmed: null,
    errors: {},
    fields: { name: '', email: '', phone: '', party: '2', notes: '' }
  };
  state.month = new Date(state.month.getFullYear(), state.month.getMonth(), 1);

  let lastFocused = null;

  /* ---------------- render ---------------- */
  function render() {
    inner.innerHTML = state.confirmed ? confirmedView() : formView();
    bind();
  }

  function stepState() {
    return [
      { k: 'Project', done: true },
      { k: 'Date', done: !!state.date },
      { k: 'Time', done: !!state.time },
      { k: 'Details', done: !!(state.fields.name && state.fields.email) },
      { k: 'Confirm', done: false }
    ];
  }

  function formView() {
    const p = state.project;
    const steps = stepState();
    const activeIdx = steps.findIndex((s) => !s.done);

    return `
    <button class="booking__close" data-close aria-label="Close reservation">
      <span></span><span></span>
    </button>

    <div class="booking__grid">
     <div class="booking__col booking__col--a">

      <!-- ══ identity ══ -->
      <div class="b-identity">
        <header class="booking__head">
          <p class="label">Reservation</p>
          <h2 class="booking__title display" id="booking-title">Reserve a viewing</h2>
        </header>

        <ol class="steps" aria-label="Progress">
          ${steps.map((s, i) => `
            <li class="step" ${s.done ? 'data-done' : ''} ${i === activeIdx ? 'data-active' : ''}>
              <span class="step__n idx">${String(i + 1).padStart(2, '0')}</span>
              <span class="step__k">${s.k}</span>
            </li>`).join('')}
        </ol>

        <div class="bproject">
          <div class="bproject__img">
            <img src="assets/projects/${p.images.main}@sm.webp" alt="${p.name}" width="760" height="950">
          </div>
          <div class="bproject__body">
            <span class="idx">${p.index} / 03</span>
            <h3 class="bproject__name display">${p.name}</h3>
            <p class="meta">${p.location.place}, ${p.location.region} &mdash; ${p.location.country}</p>
            <p class="meta bproject__coord">${p.coords.latDMS} &ensp; ${p.coords.lonDMS}</p>
            <p class="bproject__price display">${p.price.display}</p>
          </div>
        </div>

        <div class="bswitch" role="group" aria-label="Choose a project">
          ${PROJECTS.map((x) => `
            <button class="bswitch__b" data-pick-project="${x.id}" ${x.id === p.id ? 'data-active' : ''}>
              <span class="idx">${x.index}</span> ${x.name}
            </button>`).join('')}
        </div>
      </div>

      <!-- ══ details ══ -->
      <div class="b-details">

        <form class="bform" data-form novalidate>
          <p class="label bform__label">Your details</p>
          <div class="bform__row">
            ${field('name', 'Full name', 'text', state.fields.name, state.errors.name, 'name')}
            ${field('email', 'Email', 'email', state.fields.email, state.errors.email, 'email')}
          </div>
          <div class="bform__row">
            ${field('phone', 'Telephone', 'tel', state.fields.phone, null, 'tel')}
            <label class="fld">
              <span class="fld__k label">Party size</span>
              <select class="fld__i" name="party">
                ${['1', '2', '3', '4', '5+'].map((n) =>
                  `<option value="${n}" ${state.fields.party === n ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="fld">
            <span class="fld__k label">Notes <span class="fld__opt">optional</span></span>
            <textarea class="fld__i" name="notes" rows="2"
              placeholder="Anything we should know before the visit">${state.fields.notes}</textarea>
          </label>
        </form>
      </div>
     </div>

     <div class="booking__col booking__col--b">
      <!-- ══ calendar + time ══ -->
      <div class="b-calendar">
        ${calendarView()}

        <div class="btimes">
          <div class="btimes__head">
            <p class="label">Available time</p>
            <p class="meta">${state.date ? longDate(state.date) : 'Select a date first'}</p>
          </div>
          <div class="btimes__grid">${timesView()}</div>
        </div>
      </div>

      <!-- ══ summary + confirm ══ -->
      <div class="b-summary">
        <div class="bsummary">
          <dl class="bsummary__list">
            <div><dt class="meta">Project</dt><dd>${p.name}</dd></div>
            <div><dt class="meta">Date</dt><dd>${state.date ? longDate(state.date) : '&mdash;'}</dd></div>
            <div><dt class="meta">Time</dt><dd>${state.time || '&mdash;'}</dd></div>
          </dl>
          <button class="btn btn--solid bsummary__go" data-confirm ${canConfirm() ? '' : 'disabled'}>
            Confirm reservation <span class="btn-arrow">&rarr;</span>
          </button>
          <p class="bsummary__note meta" data-form-note>
            ${canConfirm()
              ? 'No payment is taken. We confirm by email within one working day.'
              : 'Choose a date and time, and add your name and email.'}
          </p>
        </div>
      </div>
     </div>
    </div>`;
  }

  function field(name, labelText, type, value, error, autocomplete) {
    return `
    <label class="fld ${error ? 'fld--err' : ''}">
      <span class="fld__k label">${labelText}</span>
      <input class="fld__i" type="${type}" name="${name}" value="${escapeAttr(value)}"
             autocomplete="${autocomplete}" ${name === 'name' || name === 'email' ? 'required' : ''}>
      ${error ? `<span class="fld__err meta">${error}</span>` : ''}
    </label>`;
  }

  function calendarView() {
    const m = state.month;
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;           // Monday-first
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const today = startOfDay(new Date());
    const limit = new Date(today.getFullYear(), today.getMonth() + 4, 1);
    const atStart = m.getFullYear() === today.getFullYear() && m.getMonth() === today.getMonth();
    const atEnd = m >= limit;

    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<span class="cal__pad"></span>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(m.getFullYear(), m.getMonth(), d);
      const past = date < today;
      const open = !past && hasOpenSlot(date, state.project.id);
      const sel = sameDay(date, state.date);
      cells += `
        <button class="cal__d" data-date="${iso(date)}"
          ${open ? '' : 'disabled'} ${sel ? 'data-selected' : ''}
          ${sameDay(date, today) ? 'data-today' : ''}
          aria-label="${longDate(date)}${open ? '' : ' — unavailable'}">
          <span>${d}</span>
        </button>`;
    }

    return `
    <div class="cal">
      <div class="cal__head">
        <p class="cal__month display">${MONTHS[m.getMonth()]} <span>${m.getFullYear()}</span></p>
        <div class="cal__nav">
          <button class="calbtn" data-month="-1" ${atStart ? 'disabled' : ''} aria-label="Previous month">
            <svg viewBox="0 0 24 10"><path d="M23 5H1m0 0 4-4M1 5l4 4"/></svg>
          </button>
          <button class="calbtn" data-month="1" ${atEnd ? 'disabled' : ''} aria-label="Next month">
            <svg viewBox="0 0 24 10"><path d="M1 5h22m0 0-4-4M23 5l-4 4"/></svg>
          </button>
        </div>
      </div>
      <div class="cal__dows">${DAY_NAMES.map((d) => `<span class="meta">${d}</span>`).join('')}</div>
      <div class="cal__grid">${cells}</div>
      <p class="cal__key meta">
        <span class="cal__key-i" data-k="open"></span> Available
        <span class="cal__key-i" data-k="none"></span> Fully booked
      </p>
    </div>`;
  }

  function timesView() {
    if (!state.date) return `<p class="btimes__empty meta">Times appear once a date is chosen.</p>`;
    const list = slotsFor(state.date, state.project.id);
    if (!list.length) return `<p class="btimes__empty meta">No viewings on this day.</p>`;
    return list.map((s) => `
      <button class="slot" data-time="${s.time}" ${s.taken ? 'disabled' : ''}
        ${state.time === s.time ? 'data-selected' : ''}>
        <span class="slot__t">${s.time}</span>
        <span class="slot__s meta">${s.taken ? 'Taken' : 'Open'}</span>
      </button>`).join('');
  }

  function confirmedView() {
    const c = state.confirmed;
    return `
    <button class="booking__close" data-close aria-label="Close"><span></span><span></span></button>
    <div class="bdone">
      <div class="bdone__mark" aria-hidden="true">
        <svg viewBox="0 0 64 64"><path d="M14 33.5 27 46l23-28"/></svg>
      </div>
      <p class="label">Confirmed</p>
      <h2 class="bdone__title display">Your viewing is reserved.</h2>
      <p class="bdone__lead lead">
        We have sent the details to <strong>${escapeHtml(c.email)}</strong>.
        A member of the studio will meet you on site.
      </p>
      <dl class="bdone__list">
        <div><dt class="meta">Reference</dt><dd class="bdone__ref">${c.ref}</dd></div>
        <div><dt class="meta">Project</dt><dd>${c.project}</dd></div>
        <div><dt class="meta">Location</dt><dd>${c.place}</dd></div>
        <div><dt class="meta">Date</dt><dd>${c.date}</dd></div>
        <div><dt class="meta">Time</dt><dd>${c.time}</dd></div>
        <div><dt class="meta">Guests</dt><dd>${c.party}</dd></div>
      </dl>
      <div class="bdone__cta">
        <button class="btn btn--solid" data-close>Close <span class="btn-arrow">&rarr;</span></button>
        <button class="btn" data-again>Reserve another viewing</button>
      </div>
    </div>`;
  }

  const longDate = (d) =>
    `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;

  const canConfirm = () =>
    !!(state.date && state.time && state.fields.name.trim() && /\S+@\S+\.\S+/.test(state.fields.email));

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const escapeAttr = escapeHtml;

  /* ---------------- events ---------------- */
  function bind() {
    qsa('[data-close]', inner).forEach((b) => b.addEventListener('click', close));

    qsa('[data-pick-project]', inner).forEach((b) =>
      b.addEventListener('click', () => {
        const next = PROJECTS.find((x) => x.id === b.dataset.pickProject);
        if (!next || next === state.project) return;
        state.project = next;
        state.time = null;                  // availability differs per project
        if (state.date && !hasOpenSlot(state.date, next.id)) state.date = null;
        render();
      }));

    qsa('[data-month]', inner).forEach((b) =>
      b.addEventListener('click', () => {
        const d = Number(b.dataset.month);
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() + d, 1);
        render();
      }));

    qsa('[data-date]', inner).forEach((b) =>
      b.addEventListener('click', () => {
        const [y, mo, dd] = b.dataset.date.split('-').map(Number);
        state.date = new Date(y, mo - 1, dd);
        state.time = null;
        render();
      }));

    qsa('[data-time]', inner).forEach((b) =>
      b.addEventListener('click', () => {
        state.time = b.dataset.time;
        render();
        /* the confirm block is the next thing the visitor needs */
        const go = qs('.b-summary', inner);
        if (go && inner.scrollHeight > inner.clientHeight + 8) {
          go.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }));

    const form = qs('[data-form]', inner);
    if (form) {
      form.addEventListener('input', (e) => {
        const t = e.target;
        if (!t.name) return;
        state.fields[t.name] = t.value;
        if (state.errors[t.name]) { delete state.errors[t.name]; }
        // keep the confirm button live without re-rendering the inputs
        const go = qs('[data-confirm]', inner);
        const note = qs('[data-form-note]', inner);
        if (go) go.disabled = !canConfirm();
        if (note) note.textContent = canConfirm()
          ? 'No payment is taken. We confirm by email within one working day.'
          : 'Choose a date and time, and add your name and email.';
        syncSteps();
      });
      form.addEventListener('submit', (e) => e.preventDefault());
    }

    qs('[data-confirm]', inner)?.addEventListener('click', confirm);
    qs('[data-again]', inner)?.addEventListener('click', () => {
      state.confirmed = null; state.date = null; state.time = null;
      render();
    });
  }

  function syncSteps() {
    const steps = stepState();
    const nodes = qsa('.step', inner);
    const activeIdx = steps.findIndex((s) => !s.done);
    nodes.forEach((n, i) => {
      n.toggleAttribute('data-done', steps[i].done);
      n.toggleAttribute('data-active', i === activeIdx);
    });
  }

  function confirm() {
    state.errors = {};
    if (!state.fields.name.trim()) state.errors.name = 'Please add your name';
    if (!/\S+@\S+\.\S+/.test(state.fields.email)) state.errors.email = 'Please add a valid email';
    if (Object.keys(state.errors).length) { render(); return; }

    const p = state.project;
    state.confirmed = {
      ref: 'BOR-' + String(hash(iso(state.date) + state.time + state.fields.email) % 100000).padStart(5, '0'),
      project: p.name,
      place: `${p.location.place}, ${p.location.country}`,
      date: longDate(state.date),
      time: state.time,
      party: state.fields.party,
      email: state.fields.email
    };
    render();
    inner.querySelector('.bdone')?.setAttribute('data-in', '');
  }

  /* ---------------- open / close ---------------- */
  function open(projectId) {
    const p = PROJECTS.find((x) => x.id === projectId);
    if (p) state.project = p;
    else if (projects && typeof projects.active === 'number') {
      state.project = PROJECTS[projects.active] || state.project;
    }
    state.confirmed = null;
    state.errors = {};
    lastFocused = document.activeElement;

    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    render();
    requestAnimationFrame(() => root.setAttribute('data-open', ''));
    document.body.setAttribute('data-locked', '');
    state.open = true;
    setTimeout(() => qs('.booking__close', inner)?.focus(), 60);
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    root.removeAttribute('data-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.removeAttribute('data-locked');
    setTimeout(() => { if (!state.open) { root.hidden = true; inner.innerHTML = ''; } }, 620);
    lastFocused?.focus?.();
  }

  scrim?.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = qsa('button:not([disabled]),input,select,textarea,a[href]', root)
      .filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* every Reserve Time button on the page routes here */
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-open-booking]');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.project);
  });

  return { open, close };
}
