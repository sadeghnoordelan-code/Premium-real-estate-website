# BOREAL — Architectural Estates

A scroll-driven architectural/real-estate site. Three main sections and one hidden
reservation flow. No framework, no build step — ES modules, hand-written CSS.

**Double-click `index.html`** — it works straight from the filesystem.

For development, serve it instead (proper caching, and the ES modules load
directly rather than through the fallback build):

```bash
node serve.mjs
```

It prints the URL it bound to (`PORT` overrides, and `node serve.mjs 5183`
still works for a fixed port).

> ES modules are blocked over `file://`, so `index.html` loads `js/main.js` as a
> module and falls back to the generated `js/bundle.js` if that never starts.
> **After editing anything in `js/`, run `node tools/build-bundle.mjs`** — the
> modules are the source of truth, the bundle is generated output.

---

## The three sections

| # | Section | Interaction |
|---|---------|-------------|
| 01 | **Film** | Mouse wheel scrubs a 391-frame architectural film, frame by frame. The stage stays pinned until the film runs out, then releases into section 02. Works in reverse. |
| 02 | **Collection** | Split stage after the supplied reference: the plate runs two thirds, a navy panel carries the project's identity in the remaining third. Scrolling turns the projects to the right and back. |
| 03 | **Contact** | Full navy. The close of the sequence. |

**Reserve Time** on any project opens the booking overlay — a hidden flow, not a
fourth section. `PROJECT → DATE → TIME → DETAILS → CONFIRMATION`.

---

## How the hero actually works

The hero is one persistent `<video>` — muted, permanently paused, no controls —
whose timeline is driven entirely by accumulated wheel input:

```
wheel -> normalised delta -> accumulated target frame
      -> rAF-damped current frame -> gated video.currentTime
```

Nothing writes `currentTime` outside that loop, and no wheel event is ever applied
to the timeline directly. While the film is running the page cannot scroll at all;
it hands the wheel back when the film reaches frame 390, and takes it again
(in reverse) when you return to the top.

Three separate things each made naive video scrubbing fail, all found by
measurement against the real 391-frame film:

1. **The source `.MOV` cannot be decoded by Chrome at all**, and its GOP of 29
   meant every seek had to decode up to 29 frames. The film is re-encoded
   **all-intra** — every frame a keyframe. Measured seek latency 3–6ms, against
   13–20ms at GOP 3 and 7–17ms at GOP 6.
2. **A plain `src` only ever buffers ~3.4s of a 13s paused video.** The file is
   fetched in full and played from a Blob, so the whole timeline is resident
   before scrubbing begins. (Over `file://`, where `fetch` is blocked, the path is
   handed to the element directly — a local file needs no buffering strategy.)
3. **Assigning `currentTime` every frame aborts the in-flight seek.** 40
   assignments produced *one* presented frame. Seeks are gated: never more than
   one in flight, always targeting the newest requested time.

### Wheel feel

`FEEL` in `js/hero.js` is the whole input model. Deltas are normalised across
`deltaMode` (pixels / lines / pages) so a trackpad and a wheel agree. Gain is
velocity-adaptive: an isolated nudge is worth ~1.8 frames, while a sustained roll
ramps up to ~15 frames per notch, so the film is precise when you inch and quick
when you sweep. Measured with real wheel events:

| input | target moved | distinct frames shown | worst jump |
|---|---|---|---|
| one notch | 2.3 f | 2 | 1 frame |
| slow, 10 notches | 31.9 f | **32 of 32** | 1 frame |
| medium, 20 notches | 108 f | 92 | 2 frames |
| fast, 30 notches | 387 f | 144 | 8 frames |
| trackpad, Δ12 | 5.9 f | 7 | 1 frame |

Presentation holds 46–52 fps while scrubbing, above the film's own 30fps.

### A note on reduced motion

`prefers-reduced-motion: reduce` removes motion the visitor did not ask for — the
scroll cue, parallax drift, the custom cursor, entrance transitions. It does **not**
dismantle the film or the project rail: both move only in direct response to the
visitor's own input and stop the instant they stop, and the rAF interpolation is
what makes the film play continuously rather than snap between frames.

An earlier build did collapse the hero under that setting, which mapped a single
wheel notch onto ~85 frames — the film became five stills. That is why the
interpolation is deliberately not gated on it.

### Fallback

If the video cannot be fetched or decoded, the hero falls back to a pre-decoded
still sequence (`assets/hero/`) driven by exactly the same input model, with
sub-frame cross-blending so it stays continuous. Nothing downloads it unless the
video fails.

Three video tiers are generated; **a visitor downloads only one**, chosen from
viewport width, DPR and `navigator.connection`:

| tier | width | size |
|------|-------|------|
| `hero-lg.mp4` | 1600 | 18.1 MB |
| `hero-md.mp4` | 1280 | 13.2 MB |
| `hero-sm.mp4` | 960 | 8.1 MB |

Measured cold load on the 1280 tier: **interactive in ~1.1s**, fully buffered.

---

## Files

```
index.html            structure; sections 01–03 + overlay shell
serve.mjs             zero-dependency static server
css/
  tokens.css          colour, type, space, motion — the single source of truth
  base.css            reset, typography, buttons, reveals, preloader, cursor
  header.css  hero.css  projects.css  booking.css  contact.css
  responsive.css      breakpoints; rail ≥1024px, stacked below
  fonts.css           generated @font-face (self-hosted, latin subsets)
js/
  core.js             one rAF bus, damping, scroll state, reveal observer
  data.js             ALL CONTENT LIVES HERE
  hero.js             frame sequence + copy beats
  projects.js         split stage, plate rail, site marks
  booking.js          reservation flow
  main.js             boot, header, nav, cursor, parallax
  bundle.js           GENERATED classic build (file:// fallback)
assets/
  video/hero-{lg,md,sm}.mp4  the film, all-intra for scrubbing
  hero/{w1100,w720}/         fallback still sequences
  projects/                  plates + gallery, 2 sizes each (~5 MB total)
  fonts/                     woff2, ~490 KB (latin + latin-ext)
tools/
  build-video.mjs     re-encode the film for scrubbing (all-intra)
  build-frames.mjs    regenerate the fallback still sequences
  build-images.py     regenerate the project plates from the source folders
  build-bundle.mjs    regenerate js/bundle.js after editing js/
```

The original source material (`4_5796466014182976619.MOV`, `Lima Cabin/`,
`Maverick Cabin/`, `Puzzle Cabin/`) is left untouched at the project root. Nothing
at runtime reads it — everything is served from `assets/`.

---

## Editing content

Almost everything is in **`js/data.js`**: project names, styles, descriptions,
characteristics, specs, location, coordinates, plot codes, climate, prices, and
which images each project uses. The hero's five copy beats are `HERO_BEATS`, keyed
to normalised progress through the film. Viewing hours are `SLOTS`.

Contact details appear both in `data.js` (`STUDIO`) and in the contact section of
`index.html` — update both if they change.

To swap project photography, drop new files into the source folders, edit the
`JOBS` map in `tools/build-images.py`, and run it.

---

## Section 02 — the collection

Rebuilt against the supplied reference: a full-bleed plate on the left two
thirds and a flat identity panel on the right third.

**The plate is a disc.** Each project's main photograph is masked to a circle.
When a project takes the stage a white disc scales up from 0.26, then the
photograph wipes in around it as a conic mask sweeps 0deg -> 360deg. The
`--sweep` angle is a registered custom property (`@property`), which is what
makes a conic-gradient mask animatable at all — without registration the
browser cannot interpolate it and the wipe would snap.

**Backdrops are per project.** `theme` in `data.js` selects the plate's
backdrop; Maverick is `light`, the other two `dark`. The index numerals,
eyebrow, coordinates, leader line and progress meter all invert with it via
one set of `--plate-*` tokens, so adding a light project is a one-word change.

**Under the disc** sit the coordinates, a row of circular thumbnails for the
other photographs of that project, and the place/year caption. Clicking a
thumbnail swaps the disc image; clicking the disc opens the reservation.

**Navigation.** Vertical scroll drives the horizontal move; the numbered index
on the left, the arrows in the panel and the header project list all jump
directly. Below 1024px the plates and panels interleave into a single column
and the index becomes a sticky bar.

Section 03 continues the navy full-bleed, so the collection panel and the
contact section read as one field.


## Design system

Four colour families, no others. **Note the balance has shifted:** the film,
the collection and the contact section are all dark now, so navy carries the page
and ivory has become the type and accent colour rather than the dominant ground.
Ivory still owns the reservation overlay. Charcoal survives only inside that
overlay. Tints within a family are allowed — new hues are not. All in
`css/tokens.css`.

Because the whole page is dark, nothing in the header may hard-code a colour:
`.link` and `.btn` both default to charcoal, which measured 1.05:1 on navy —
invisible. They inherit from the bar instead.

Type is a trio: **Instrument Serif** for display, **Inter** for text, **IBM Plex
Mono** for coordinates, indices and metadata. Self-hosted, latin subsets only.

Motion uses one easing family and one duration scale, also in `tokens.css`.
Everything continuous subscribes to the single rAF bus in `core.js` — there are no
competing loops.

---

## Behaviour worth knowing

- **Responsive.** The rail runs at ≥1024px. Below that the scenes stack and scroll
  vertically — a dense three-column rail fights the thumb and the reading order on
  a phone. Project hierarchy, image quality and tap targets are preserved, and the
  dots become a sticky index.
- **Reduced motion.** `prefers-reduced-motion: reduce` collapses the pinned
  spacers, stops the sequence and disables reveals. The site becomes an ordinary
  scrolling page and stays complete.
- **Keyboard.** Skip link, visible focus rings, arrow keys move the rail while it
  is pinned, and off-stage projects are `inert` so focus never lands somewhere the
  rail cannot scroll to. The booking overlay traps focus and closes on `Escape`.
- **Measured:** 60fps with zero dropped frames across all three sections; no
  horizontal overflow at 390/1024/1280/1440/1920; header type sits at 12–16:1
  contrast over the film.

---

## Two things to decide before this goes live

1. **The hero film shows a Dior flagship store**, with the brand's signage clearly
   legible for much of its length. It is a striking piece of architecture and it
   was supplied as the hero asset, so it is used as-is — but it is another
   company's trademark on a page selling BOREAL's own houses. Worth clearing, or
   replacing with the studio's own footage.
2. **Listing copy is placeholder.** Descriptions, prices, areas and plot codes are
   written to be plausible, not factual. The geography is real: the coordinates,
   places and Köppen classifications resolve correctly. Replace before publishing.

The reservation flow has no backend — confirmations are generated locally. Wiring
`confirm()` in `js/booking.js` to a real endpoint is the only change needed.
