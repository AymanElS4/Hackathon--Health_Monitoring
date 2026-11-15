/**
 * Design tokens (ui-build spec §2, kept from DESIGN.md). Single source for the
 * Tailwind theme: `frontend/tailwind.config.ts` is generated from this object,
 * so no component carries a hex value of its own.
 */
export const TOKENS = {
  font: {
    family: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    /** px scale. Smallest step is 13 px (DESIGN.md metadata floor). */
    size: {
      meta: 13,
      small: 15,
      body: 17,
      /** Uppercase card labels ("AHORA", "DESPUÉS", "CÓMO ESTÁS"). */
      label: 18,
      title: 22,
      /** Card headline, e.g. the current activity title. */
      heading: 26,
      display: 28,
      /** Agenda row title and time. */
      rowTitle: 16,
      /** Agenda row subtitle. */
      rowSub: 14,
    },
  },
  color: {
    canvas: '#F5F8FC',
    card: '#FFFFFF',
    primary: '#2F6FED',
    primaryHover: '#2559C7',
    track: '#E8F1FE',
    text: '#1E2B3C',
    textSecondary: '#6B7A8F',
    /** Zone color of the range bar (not a status badge). */
    rangeAllowed: '#4A90E2',
    /** "Tu normal" band under a range bar and in the legend (not a status color). */
    baseline: '#DDE3EA',
    /** Neutral hairline: the border of a body status pill and its leader line. Not a level color. */
    line: '#D5DCE5',
  },
  /** Spacing scale, px. Mapped to Tailwind `p-*`, `px-*`, `py-*`, `gap-*` via tailwind.config.ts. `page` is the side padding of the Home container; `dockClearance` is the bottom room kept for the floating dock. */
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, page: 32, dockClearance: 112 },
  /** Corner radius, px. `card` is 16..24; `row` is the inner row of a card; `dock` is the top of the floating dock. */
  radius: { card: 20, row: 14, dock: 24 },
  shadow: {
    ambient: '0 4px 20px -2px rgba(30,43,60,0.06)',
    /** Floating dock, casts upward. */
    dock: '0 -4px 24px -4px rgba(30,43,60,0.08)',
    /** Primary pill button and the raised Vita button. */
    primary: '0 4px 16px rgba(47,111,237,0.3)',
  },
  size: {
    /** Minimum touch target, px. */
    touchTarget: 48,
    /** Touch target inside the navigation bar, px. */
    navTouchTarget: 56,
    /** Crew avatar in the Home header, px. */
    avatar: 40,
    /** Raised Vita button in the dock, px. */
    vita: 64,
    /** Circle behind a row icon (Después), px. */
    iconCircle: 40,
    /** Height of the daily progress bar, px. */
    progressBar: 10,
    /** Maximum width of the Home content, px. */
    contentMax: 1280,
    /** Maximum width of the floating dock, px. */
    dockMax: 900,
    /** Body sensor dot in the normal state, px (its white outline is `sensorOutline`). */
    sensorDot: 10,
    /** Body sensor dot when altered (amber, red or in doubt), px. */
    sensorDotAltered: 14,
    /** Box around a body sensor dot: holds the halo, pulse ring and measuring spinner, px. */
    sensorRing: 22,
    /** White outline of a body sensor dot, px. */
    sensorOutline: 2,
    /** Circle behind a metric row's sensor icon on Home, px. */
    metricIcon: 28,
    /** Level marker inside a body status pill, px. */
    levelMarker: 8,
    /** Minimum height of the body area (3D body or fallback image) in the "Cómo estás" card, px. The area grows to fill the card. */
    bodyArea: 360,
    /** Height of the zone bar of a metric range bar, px. */
    rangeBar: 8,
    /** Marker dot on a metric range bar, px. */
    rangeMarker: 10,
    /** White outline of the range marker dot, px. */
    rangeMarkerOutline: 2,
    /** "Tu normal" band under a metric range bar, px. */
    rangeBaseline: 4,
    /** Pointer of the value bubble (a rotated square), px. */
    rangePointer: 6,
    /** Row above a range bar for the small value bubble, px (13 px text; no extra line in the row). */
    rangeBubbleRow: 16,
    /** Row of cut-point labels under a range bar, px. */
    rangeCutRow: 16,
  },
} as const;
