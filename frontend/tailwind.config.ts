import type { Config } from 'tailwindcss';
import { TOKENS } from './src/config/design-tokens';
import { SENSOR_COLORS, LEVEL_COLORS, type LevelColor } from './src/config/constants';

/**
 * Tailwind theme generated from the design tokens and the two color tables.
 * No hex literal is typed here; every value is imported.
 */

const px = (value: number): string => `${value}px`;

/** `sensor-<key>` for each body sensor. */
const sensorColors = Object.fromEntries(
  Object.entries(SENSOR_COLORS).map(([key, hex]) => [`sensor-${key}`, hex]),
);

/**
 * `level-<level>` is the label color; the other fields become
 * `level-<level>-<field>` (e.g. `level-green-bg`, `level-amber-ring`).
 * Fields that are `null` or absent are skipped.
 */
const levelColors: Record<string, string> = {};
for (const [level, entry] of Object.entries(LEVEL_COLORS as Record<string, LevelColor>)) {
  levelColors[`level-${level}`] = entry.label;
  if (entry.ring) levelColors[`level-${level}-ring`] = entry.ring;
  if (entry.fill) levelColors[`level-${level}-fill`] = entry.fill;
  if (entry.bg) levelColors[`level-${level}-bg`] = entry.bg;
}

const fontSize = Object.fromEntries(
  Object.entries(TOKENS.font.size).map(([name, value]) => [name, px(value)]),
);

const spacing = Object.fromEntries(Object.entries(TOKENS.spacing).map(([name, value]) => [name, px(value)]));

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: TOKENS.color.canvas,
        card: TOKENS.color.card,
        primary: TOKENS.color.primary,
        'primary-hover': TOKENS.color.primaryHover,
        track: TOKENS.color.track,
        ink: TOKENS.color.text,
        'ink-secondary': TOKENS.color.textSecondary,
        'range-allowed': TOKENS.color.rangeAllowed,
        line: TOKENS.color.line,
        baseline: TOKENS.color.baseline,
        ...sensorColors,
        ...levelColors,
      },
      fontFamily: {
        sans: TOKENS.font.family,
      },
      fontSize,
      spacing,
      borderRadius: {
        card: px(TOKENS.radius.card),
        row: px(TOKENS.radius.row),
        dock: px(TOKENS.radius.dock),
      },
      boxShadow: {
        ambient: TOKENS.shadow.ambient,
        dock: TOKENS.shadow.dock,
        primary: TOKENS.shadow.primary,
      },
      maxWidth: {
        content: px(TOKENS.size.contentMax),
        dock: px(TOKENS.size.dockMax),
      },
      height: {
        touch: px(TOKENS.size.touchTarget),
        avatar: px(TOKENS.size.avatar),
        vita: px(TOKENS.size.vita),
        iconCircle: px(TOKENS.size.iconCircle),
        progressBar: px(TOKENS.size.progressBar),
        sensorDot: px(TOKENS.size.sensorDot),
        sensorDotAltered: px(TOKENS.size.sensorDotAltered),
        sensorRing: px(TOKENS.size.sensorRing),
        bodyArea: px(TOKENS.size.bodyArea),
        levelMarker: px(TOKENS.size.levelMarker),
        metricIcon: px(TOKENS.size.metricIcon),
        rangeBar: px(TOKENS.size.rangeBar),
        rangeMarker: px(TOKENS.size.rangeMarker),
        rangeBaseline: px(TOKENS.size.rangeBaseline),
        rangePointer: px(TOKENS.size.rangePointer),
        rangeBubbleRow: px(TOKENS.size.rangeBubbleRow),
        rangeCutRow: px(TOKENS.size.rangeCutRow),
      },
      width: {
        touch: px(TOKENS.size.touchTarget),
        avatar: px(TOKENS.size.avatar),
        vita: px(TOKENS.size.vita),
        iconCircle: px(TOKENS.size.iconCircle),
        sensorDot: px(TOKENS.size.sensorDot),
        sensorDotAltered: px(TOKENS.size.sensorDotAltered),
        sensorRing: px(TOKENS.size.sensorRing),
        levelMarker: px(TOKENS.size.levelMarker),
        metricIcon: px(TOKENS.size.metricIcon),
        rangeMarker: px(TOKENS.size.rangeMarker),
        rangePointer: px(TOKENS.size.rangePointer),
      },
      borderWidth: {
        sensor: px(TOKENS.size.sensorOutline),
        rangeMarker: px(TOKENS.size.rangeMarkerOutline),
      },
      opacity: {
        'sensor-halo': '0.3',
      },
      keyframes: {
        'sensor-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.25)', opacity: '0.5' },
        },
        'sensor-spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'sensor-pulse': 'sensor-pulse 1.6s ease-in-out infinite',
        'sensor-spin': 'sensor-spin 0.9s linear infinite',
      },
      minHeight: {
        touch: px(TOKENS.size.touchTarget),
        nav: px(TOKENS.size.navTouchTarget),
        bodyArea: px(TOKENS.size.bodyArea),
      },
      minWidth: {
        touch: px(TOKENS.size.touchTarget),
        nav: px(TOKENS.size.navTouchTarget),
      },
    },
  },
  plugins: [],
};

export default config;
