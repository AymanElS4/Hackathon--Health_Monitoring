# docs/design — Home screen reference (do not invent)

Visual reference for the Home screen of feature `001-chequeo-diario-voz-cuerpo`.
Rule: **build exactly what is here**. If something is not covered here, in `docs/base-vital-ui-build-spec.md` or
in `spec.md`, ask — do not invent layout, colors, texts or components.

## Files and authority

| File | What it is | Authority |
|---|---|---|
| `home-mockup.png` | Target screenshot at 1280×1024 (header chips fixed, legend at the bottom) | **Layout and proportions** |
| `home-mockup-body-dots.png` | Same screen, dots placed on the body | Dot positions on the body |
| `stitch-home.html` | Stitch export (Tailwind CDN, remote images) | **Measurements only** (sizes, gaps, radii). Never copy its markup, CDN links or image URLs |
| `DESIGN.md` | Design system "Serene Clinical Telemetry" | Typography, spacing, shadows, radii, surfaces |

Precedence when they disagree: `spec.md` > `base-vital-ui-build-spec.md` > this README > `home-mockup.png` >
`DESIGN.md` > `stitch-home.html`.

## Layout (from the mockup + Stitch measurements)

- Viewport target: **1280×800** tablet landscape; content centered, `max-width: 1280px`, side padding 32 px.
- **Header** (one line, ~64 px, white, subtle shadow): avatar 40 px + "Hola, Ana" (22 px, 600) on the left;
  chips "Día 23 · Luz 9/14" (moon icon) and connectivity on the right; chips are pills on `#E8F1FE`.
- **Grid**: 12 columns, gap 24 px.
  - Left, 4 columns: **Ahora** card on top, **Después** card below; both stretch to equal height.
  - Right, 8 columns: **Cómo estás** card, full height of the left column.
- **Ahora** card: label "AHORA" (18 px, uppercase, `#6B7A8F`) + time chip "09:30 · 1 min" on the right;
  title "Chequeo diario" (26 px, 700); "Progreso diario: 1 de 5"; progress bar 10 px on `#E8F1FE`;
  footer row: "Tiempo estimado 1 min" left, **"Empezar ▶" pill button right** (not full width).
- **Después** card: label "DESPUÉS" + link "Agenda →"; max 2 rows (icon 40 px circle, title 16/600,
  subtitle 14, time right 16/700) on `#F5F8FC` row background; footer "N actividades pendientes hoy" centered.
- **Cómo estás** card: header "CÓMO ESTÁS" + link "Salud →"; body split **40 % body / 60 % metrics card**.
  - Body column: 3D viewer (or fallback image), transparent background, hint "Toca un sensor" below.
  - Metrics card (`#F5F8FC`, radius 20): header "ESTADO DE ANA" + chip "Hoy: <nivel>" + chip "Ánimo N/5*";
    5 metric rows (white, radius 14); legend at the bottom (see below).
- **Bottom dock**: floating, centered, `max-width: 900px`, white, radius 24 top, shadow; tabs Hoy · Salud ·
  Agenda · Guía; **Vita = 64 px circular primary button, raised, in the center** with label "Vita" below.
  Disabled tabs: gray icon + name only; "Próximamente" goes in the tooltip, not on screen.
- **Demo scenario selector**: discreet, bottom-left corner above the dock, small (13 px). Not in the header.

## Metric row (one per sensor, 5 rows)

- Line 1: sensor icon in a 28 px circle (tinted with the **sensor** color) + name (15/600) · value (18/700,
  `#1E2B3C`) + unit (13, `#6B7A8F`) · status badge.
- Line 2: range bar 8 px, zones with 2 px white gaps; **value bubble** above the marker (dark navy `#1E2B3C`,
  white 13/700 text, pointer) + 10 px marker dot with white border.
- Line 3: "tu normal" = light gray band `#DDE3EA`, 4 px, under the bar (no text).
- Line 4: the allowed range "Permitido …" (13 px, primary blue), centred under the bar (D40). The cut numbers
  are not printed: they would collide with the centred label. The "tu normal" note, when learning, sits at the
  right of this line. No scale ends.

## Legend (bottom of the metrics card, right-aligned, 13 px)

`● Permitido  ● Atención  ● Alerta  ▬ Tu normal` and below it `* Criterio del equipo, no clínico`.

## Overrides — what the mockup gets wrong (use these, not the picture)

| In the mockup | Use |
|---|---|
| "Chequeo antes de salir" | "Chequeo diario" |
| Sensor colors amber / coral / purple / teal / blue | Sueño `#5B5FD6` · Pulso `#D946A8` · Presión `#9D5CE6` · Temperatura `#14A3A0` · Oxígeno `#38A3E8` |
| Alert red `#E5675A` | `#E5484D` |
| Badge "Bien" in primary blue | Status style from `LEVEL_COLORS` (Bien = slate, no alarm color) |
| Sueño value painted amber | Value text always `#1E2B3C`; only badge, ring and zone carry status color |
| "Salida al exterior · Reparar panel solar" / "Vitamina D" | Use the demo agenda in `config/agenda.ts` (no medication) |
| Body glows blue/amber | Plain pearl gray body; only the altered sensor dot gets a status ring |
| Remote logo, avatar, body image, Google Fonts, Material Symbols, Tailwind CDN | Everything local, from `frontend/public/` and the compiled build |
| Range bar zones placed by hand | Computed from `libs/health-rules` thresholds |

## Acceptance

At 1280×800, a screenshot of the running app placed next to `home-mockup.png` shows the same structure
(header, 4/8 grid, card order, dock with central Vita), with the overrides above applied.
