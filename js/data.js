/* ============================================================
   BOREAL — content model
   Placeholder listing copy for design purposes; geography,
   coordinates and climate classifications are real.
   ============================================================ */

export const STUDIO = {
  name: 'BOREAL',
  descriptor: 'Architectural Estates',
  founded: '2011',
  statement: 'We design and place a small number of houses each year, in forests, on coastlines, and at altitude.',
  offices: [
    { city: 'Oslo', role: 'Studio — Head Office',
      lines: ['Thorvald Meyers gate 44', '0555 Oslo, Norway'], tel: '+47 22 04 18 60' },
    { city: 'Vienna', role: 'Alpine Representation',
      lines: ['Getreidemarkt 17', '1060 Vienna, Austria'], tel: '+43 1 512 88 40' }
  ],
  enquiries: [
    { label: 'Acquisitions', value: 'acquisitions@boreal.estate' },
    { label: 'Press', value: 'press@boreal.estate' },
    { label: 'Studio', value: 'studio@boreal.estate' }
  ],
  social: [
    { label: 'Instagram', href: '#' },
    { label: 'Journal', href: '#' },
    { label: 'LinkedIn', href: '#' }
  ]
};

export const PROJECTS = [
  {
    id: 'lima', index: '01', name: 'Lima Cabin', theme: 'dark',
    style: 'Contemporary A-Frame — Nordic Vernacular',
    tagline: 'A single roof, drawn all the way to the ground.',
    year: '2023', status: 'Available',
    description: 'Lima reduces the house to one gesture: a glulam A-frame that touches the forest floor on both sides and opens, at its north end, into a wall of triangulated glass. The plan is stacked rather than spread — living below, a sleeping platform above — so the building takes only 74 square metres of ground from the pine heath it sits in.',
    characteristics: [
      { k: 'Structure', v: 'Glulam A-frame, 11.4 m ridge' },
      { k: 'Envelope', v: 'Charred pine rainscreen, black brick core' },
      { k: 'Aperture', v: 'Triangulated glazing, north elevation' },
      { k: 'Foundation', v: 'Screw-pile platform, zero excavation' }
    ],
    specs: [
      { k: 'Internal area', v: '186 m²' },
      { k: 'Site', v: '2.4 ha, private' },
      { k: 'Bedrooms', v: '3' },
      { k: 'Completed', v: '2023' }
    ],
    location: { place: 'Vrådal', region: 'Telemark', country: 'Norway' },
    coords: { lat: 59.3517, lon: 8.4247, latDMS: '59°21′06″N', lonDMS: '8°25′29″E' },
    plot: 'N59 — TLM — 014',
    elevation: '612 m',
    orientation: 'N 14° E',
    climate: {
      koppen: 'Dfc',
      zone: 'Subarctic — boreal conifer',
      notes: 'Deep-winter site. The envelope is detailed for a 3.5 kN/m² snow load and 19 hours of summer daylight.',
      metrics: [
        { k: 'Jan mean', v: '−7.8 °C' },
        { k: 'Jul mean', v: '15.6 °C' },
        { k: 'Precip.', v: '890 mm/yr' },
        { k: 'Snow load', v: '3.5 kN/m²' }
      ]
    },
    price: { display: '€2,450,000', note: 'Freehold, furnished' },
    images: {
      main: 'lima-main', sub: 'lima-sub',
      gallery: [
        { f: 'lima-g1', c: 'Living volume, north glazing' },
        { f: 'lima-g2', c: 'Sleeping platform' },
        { f: 'lima-g3', c: 'Upper lounge' },
        { f: 'lima-g4', c: 'Study, east corner' }
      ]
    }
  },
  {
    id: 'maverick', index: '02', name: 'Maverick Cabin', theme: 'light',
    style: 'Asymmetric Gable — Alpine Modernism',
    tagline: 'A house held level against a still sheet of water.',
    year: '2024', status: 'Available',
    description: 'Maverick sets a 34-metre asymmetric gable against a mirror pool that doubles the elevation and moderates the courtyard climate. Accommodation runs the length of the ridge on one level; service, garaging and the wellness rooms are folded below grade so the silhouette from the water stays a single, uninterrupted line.',
    characteristics: [
      { k: 'Structure', v: 'Asymmetric double gable, 34 m span' },
      { k: 'Water', v: 'Mirror pool — thermal mass and reflector' },
      { k: 'Envelope', v: 'Triple-glazed structural facade' },
      { k: 'Performance', v: 'Passive-house envelope, 0.9 ACH' }
    ],
    specs: [
      { k: 'Internal area', v: '642 m²' },
      { k: 'Site', v: '1.8 ha, lakeside' },
      { k: 'Bedrooms', v: '6' },
      { k: 'Completed', v: '2024' }
    ],
    location: { place: 'Attersee', region: 'Salzkammergut', country: 'Austria' },
    coords: { lat: 47.8583, lon: 13.5236, latDMS: '47°51′30″N', lonDMS: '13°31′25″E' },
    plot: 'A47 — SKG — 002',
    elevation: '469 m',
    orientation: 'S 08° W',
    climate: {
      koppen: 'Dfb',
      zone: 'Warm-summer continental — alpine foreland',
      notes: 'A wet, temperate lake basin. Deep overhangs and the pool surface carry most of the summer cooling load.',
      metrics: [
        { k: 'Jan mean', v: '−1.4 °C' },
        { k: 'Jul mean', v: '18.9 °C' },
        { k: 'Precip.', v: '1,540 mm/yr' },
        { k: 'Lake temp', v: '22 °C (Aug)' }
      ]
    },
    price: { display: '€8,900,000', note: 'Freehold, turnkey' },
    images: {
      main: 'maverick-main', sub: 'maverick-sub',
      gallery: [
        { f: 'maverick-g1', c: 'Living, toward the pool' },
        { f: 'maverick-g2', c: 'Principal bedroom' },
        { f: 'maverick-g3', c: 'Lower garage' },
        { f: 'maverick-g4', c: 'Arrival court' }
      ]
    }
  },
  {
    id: 'puzzle', index: '03', name: 'Puzzle Cabin', theme: 'dark',
    style: 'Interlocking Volumes — Baltic Timber',
    tagline: 'Two gables, set into one another at the ridge.',
    year: '2022', status: 'Reserved — enquire',
    description: 'Puzzle is two gable volumes pushed together until their roof planes interlock, leaving a sheltered notch that becomes the entrance. The larger volume holds the living rooms and turns its glazed end to the pine heath; the smaller one carries the bedrooms and steps down with the existing grade, so no part of the site was cut or filled.',
    characteristics: [
      { k: 'Geometry', v: 'Two interlocking gable volumes' },
      { k: 'Ground', v: 'Terraced deck follows existing grade' },
      { k: 'Screening', v: 'Slotted timber fins, controlled solar gain' },
      { k: 'Roof', v: 'Standing-seam zinc, charcoal' }
    ],
    specs: [
      { k: 'Internal area', v: '318 m²' },
      { k: 'Site', v: '3.1 ha, pine heath' },
      { k: 'Bedrooms', v: '4' },
      { k: 'Completed', v: '2022' }
    ],
    location: { place: 'Ljugarn', region: 'Gotland', country: 'Sweden' },
    coords: { lat: 57.3286, lon: 18.7053, latDMS: '57°19′43″N', lonDMS: '18°42′19″E' },
    plot: 'S57 — GTL — 009',
    elevation: '24 m',
    orientation: 'S 22° E',
    climate: {
      koppen: 'Dfb',
      zone: 'Maritime continental — Baltic pine heath',
      notes: 'The sunniest coast in Sweden. Fins on the south elevation cut roughly 1,900 annual sun hours to a workable gain.',
      metrics: [
        { k: 'Jan mean', v: '−0.6 °C' },
        { k: 'Jul mean', v: '17.2 °C' },
        { k: 'Sunshine', v: '1,900 h/yr' },
        { k: 'Precip.', v: '520 mm/yr' }
      ]
    },
    price: { display: '€4,150,000', note: 'Freehold, part-furnished' },
    images: {
      main: 'puzzle-main', sub: 'puzzle-sub',
      gallery: [
        { f: 'puzzle-g1', c: 'South elevation' },
        { f: 'puzzle-g2', c: 'Entrance notch' },
        { f: 'puzzle-g3', c: 'From the heath' },
        { f: 'puzzle-g4', c: 'Deck, evening' }
      ]
    }
  }
];

/* Viewing slots. Weekends deliberately sparser — reads as a real diary. */
export const SLOTS = {
  weekday: ['09:30', '11:00', '13:30', '15:00', '16:30'],
  saturday: ['10:00', '12:00', '14:00'],
  sunday: []
};

/* Hero copy beats, keyed to normalised scroll progress through the
   film: arrival (exterior) -> threshold -> interior -> material -> release. */
export const HERO_BEATS = [
  { from: 0.00, to: 0.135, kicker: 'Est. 2011 — Oslo & Vienna',
    line1: 'Arrival', line2: 'is the first room.',
    body: 'A small studio placing a handful of houses each year, in forests, on coastlines, and at altitude.' },
  { from: 0.155, to: 0.315, kicker: '01 — Threshold',
    line1: 'We design', line2: 'the way in.',
    body: 'Every project begins at the point where the ground stops and the building starts.' },
  { from: 0.355, to: 0.575, kicker: '02 — Interior',
    line1: 'Volume', line2: 'before surface.',
    body: 'Rooms are shaped first by light and section, and only then by material.' },
  { from: 0.615, to: 0.805, kicker: '03 — Material',
    line1: 'Stone, timber,', line2: 'and weather.',
    body: 'We build with what the site already understands, detailed to last several lifetimes.' },
  { from: 0.845, to: 1.00, kicker: '04 — Portfolio',
    line1: 'Three houses,', line2: 'available now.',
    body: 'Continue to view the current collection.' }
];
