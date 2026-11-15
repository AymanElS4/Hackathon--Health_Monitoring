---
name: Serene Clinical Telemetry
colors:
  surface: '#f8f9ff'
  surface-dim: '#cddbf2'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d6e3fa'
  on-surface: '#0f1c2d'
  on-surface-variant: '#424654'
  inverse-surface: '#243142'
  inverse-on-surface: '#eaf1ff'
  outline: '#737786'
  outline-variant: '#c2c6d7'
  surface-tint: '#0056d0'
  primary: '#0055ce'
  on-primary: '#ffffff'
  primary-container: '#2f6fed'
  on-primary-container: '#ffffff'
  inverse-primary: '#b1c5ff'
  secondary: '#25609d'
  on-secondary: '#ffffff'
  secondary-container: '#88bcfe'
  on-secondary-container: '#004b85'
  tertiary: '#555e69'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e7782'
  on-tertiary-container: '#ffffff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b1c5ff'
  on-primary-fixed: '#001847'
  on-primary-fixed-variant: '#0040a0'
  secondary-fixed: '#d3e4ff'
  secondary-fixed-dim: '#a2c9ff'
  on-secondary-fixed: '#001c38'
  on-secondary-fixed-variant: '#004881'
  tertiary-fixed: '#dae3f0'
  tertiary-fixed-dim: '#bec7d4'
  on-tertiary-fixed: '#131c25'
  on-tertiary-fixed-variant: '#3f4852'
  background: '#f8f9ff'
  on-background: '#0f1c2d'
  surface-variant: '#d6e3fa'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-sm:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  metric-vital:
    fontFamily: Inter
    fontSize: 42px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Inter
    fontSize: 19px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-strong:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.04em
  unit-label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-tablet-landscape: 1.5rem
  margin: 1.5rem
  margin-tablet-landscape: 2rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system establishes a high-acuity, calming clinical interface tailored for point-of-care tablet devices. The visual direction balances the precision of aerospace instrumentation with the therapeutic reassurance required in patient monitoring environments. By avoiding aggressive, high-saturation medical indicators, the interface prevents clinical alarm fatigue while retaining unambiguous diagnostic hierarchy.

The aesthetic fuses modern Scandinavian minimalism with high-legibility telemetric software: pristine white functional cards floating over a faint oceanic atmospheric tint, deep contrast typography for instantaneous rapid-glance scanning, and balanced touch ergonomics engineered specifically for two-handed tablet grips or mobile clinical carts.

## Colors

The palette is engineered to lower stress levels during critical physiological assessments. 

- **Canvas & Surfaces**: The base application canvas is `#F5F8FC`, providing a chilled, glare-reducing ground. Primary content surfaces and interactive cards utilize pure `#FFFFFF` to establish crisp figure-ground separation.
- **Primary & Interactive**: Clinical blue (`#2F6FED`) anchors all primary calls-to-action, key navigation states, and confirmed metric thresholds, shifting to `#2559C7` on direct tap/hover states.
- **Accents & Tracks**: The soft sky `#7FB3F5` acts as a supportive marker, while `#E8F1FE` serves as the universal track color for telemetry meters, progress dials, neutral chips, and active surface fills.
- **Text & Contrast Hierarchy**: Text avoids harsh pure blacks; primary typography uses slate navy `#1E2B3C` (achieving AAA contrast against white cards), while structural metadata, units, and timestamps use secondary text `#6B7A8F`.
- **Diagnostic Status States**: Diagnostic levels avoid jarring high-frequency neon. The *Optimal (Bien)* state utilizes calm sky-cerulean `#4A90E2` instead of agitated saturated green, keeping heart-rate and oxygen readings serene. *Warning (Atención)* relies on warm clinical amber `#F2A93B`. *Alert (Alerta)* uses a measured soft coral `#E5675A` for critical physiological anomalies without triggering chaotic visual panic.

## Typography

Typography prioritizes extreme legibility under varied lighting environments (harsh clinic fluorescents or dimmed night wards). **Inter** is deployed universally for its robust horizontal tracking, tall x-height, and open apertures. 

To safeguard clinician legibility, body and baseline interactive text never drops below 16px. Only peripheral diagnostic metadata, secondary metric units (`bpm`, `mmHg`, `% SpO2`), and uppercase micro-tags scale down to 13–14px, backed by elevated medium-to-bold weights and expanded tracking (`+0.04em` to `+0.06em`) to prevent glyph collapse. Numeric metrics utilize tabular figures where appropriate to eliminate layout jitter during active bio-telemetry streaming.

## Layout & Spacing

The interface is structured for 10-inch to 13-inch tablets in both landscape and portrait orientations, adopting a flexible fluid grid with strict ergonomic bounds:

- **Grid Model**: A 12-column grid in tablet landscape and an 8-column grid in tablet portrait. Lateral gutter width defaults to `1.25rem` (20px) scaling to `1.5rem` (24px) in landscape view to ensure touch targets never crowd adjacent zones.
- **Safe Tap Bounds**: All interactive components adhere to a mandatory minimum touch target size of 48×48px to accommodate gloved fingers and swift bedside navigation.
- **Content Partitioning**: The screen splits into a persistent left telemetry anchor rail (280–320px fixed) for live vitals monitoring, while the remaining viewport flows variable clinical summaries, waveforms, and longitudinal medication tracking modules.

## Elevation & Depth

Visual hierarchy is maintained through soft atmospheric dispersal rather than heavy structural borders or pitch-black drop shadows:

- **Base Ambient Shadow**: All cards, data modules, and floating containers utilize a calibrated atmospheric shadow: `0 4px 20px -2px rgba(30, 43, 60, 0.06)`. The tinted dark-slate pigment (`#1E2B3C`) prevents dingy gray artifacts and creates a clean, hovering depth effect against the `#F5F8FC` canvas.
- **Modal & Popover Layering**: Elevated panels, contextual dosage menus, and alert sheets sit at a higher tier using `0 12px 32px -4px rgba(30, 43, 60, 0.10)`.
- **Card Framing**: Elevated surfaces do not rely on aggressive strokes; edge separation is achieved purely through surface-to-canvas value contrast, supplemented only when necessary by an ultra-subtle hairline stroke (`1px solid rgba(127, 179, 245, 0.20)`).

## Shapes

The interface embraces modern medical roundedness (`roundedness: 2`). Standard containers, metric displays, and interactive inputs employ an `8px` (`0.5rem`) radius. Key structural cards, diagnostic modules, and persistent flyouts transition up to `rounded-lg` (`16px` / `1rem`), while primary modals and vital-status badge pills use `rounded-xl` (`24px` / `1.5rem`).

This curvature creates a welcoming, calm clinical environment that reduces tension while maintaining crisp geometrical structure suitable for numerical readings.

## Components

### Buttons
- **Primary**: Solid `#2F6FED` background, `#FFFFFF` text, `12px 24px` padding, minimum height 48px, rounded 8px. Hover/active state deepens to `#2559C7`.
- **Secondary / Soft**: `#E8F1FE` background with `#2F6FED` text, providing clear low-stress interaction for non-destructive actions.
- **Ghost**: Transparent background, `#1E2B3C` text, `#E8F1FE` fill on active press.

### Vital Status Badges & Chips
- Designed as rounded pill containers (`rounded-xl`).
- **Optimal (Bien)**: Background `#EAF3FC`, text & icon `#4A90E2`, 1px border `rgba(74, 144, 226, 0.25)`.
- **Warning (Atención)**: Background `#FEF6EB`, text & icon `#F2A93B`, 1px border `rgba(242, 169, 59, 0.3)`.
- **Alert (Alerta)**: Background `#FDF0EE`, text & icon `#E5675A`, 1px border `rgba(229, 103, 90, 0.3)`.
- Chip text uses `label-sm` (14px, bold) for rapid readability across clinic rooms.

### Cards & Metric Tiles
- Base `#FFFFFF` background with subtle ambient shadow (`0 4px 20px -2px rgba(30, 43, 60, 0.06)`), 16px corner radius, internal padding of 20px–24px.
- Vitals card header displays parameter label (`label-sm`, uppercase `#6B7A8F`) paired with real-time numeric stream (`metric-vital`, 42px bold `#1E2B3C`) and inline unit suffix (`unit-label`, 13px `#6B7A8F`).
- Sparkline or telemetry wave visualizer integrated into the lower 40% of the tile over a subdued `#E8F1FE` grid track.

### Input Fields & Controls
- **Inputs**: 48px height, `#FFFFFF` surface, border 1.5px solid `rgba(107, 122, 143, 0.25)`, text 16px `#1E2B3C`. Focused state elevates to `#2F6FED` border with a subtle 3px glow tint `rgba(47, 111, 237, 0.15)`.
- **Checkboxes & Radios**: 24×24px bounding box to enable immediate bedside tapping. Unselected border `#6B7A8F`, selected fill `#2F6FED` with clean white icon check/dot.

### List Modules & Waveform Logs
- Divided list items feature a minimum touch row height of 56px, separated by hairline rules of `#E8F1FE`.
- Critical event rows utilize a subtle left border-radius indicator (4px wide) colored with the corresponding diagnostic status (e.g., `#E5675A` for Alerta).