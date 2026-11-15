import type { DemoScenarioId, Level, SensorKey, Verdict } from '@base-vital/contracts';

export interface HomeMetricPreview {
  sensor: SensorKey;
  value: string;
  level: Level;
  min: number;
  max: number;
  allowedStart: number;
  allowedEnd: number;
  marker: number | null;
}

export interface HomeScenarioPreview {
  verdict: Verdict | null;
  mood: number | null;
  metrics: HomeMetricPreview[];
}

const LEVELS = {
  green: 'green',
  amber: 'amber',
  inDoubt: 'in_doubt',
  unknown: 'unknown',
} as const satisfies Record<string, Level>;

const metric = (
  sensor: SensorKey,
  value: string,
  level: Level,
  min: number,
  max: number,
  allowedStart: number,
  allowedEnd: number,
  marker: number | null,
): HomeMetricPreview => ({
  sensor,
  value,
  level,
  min,
  max,
  allowedStart,
  allowedEnd,
  marker,
});

const makeMetrics = (
  pressure: string,
  pulse: string,
  oxygen: string,
  temperature: string,
  sleep: string,
  sleepLevel: Level,
  temperatureLevel: Level = LEVELS.green,
  pressureLevel: Level = LEVELS.green,
): HomeMetricPreview[] => [
  metric('pressure', pressure, pressureLevel, 90, 160, 90, 120, pressure === '—' ? null : Number(pressure.split('/')[0])),
  metric('pulse', pulse, LEVELS.green, 40, 130, 60, 100, Number(pulse)),
  metric('oxygen', oxygen, oxygen === '—' ? LEVELS.unknown : LEVELS.green, 85, 100, 95, 100, oxygen === '—' ? null : Number(oxygen)),
  metric('temperature', temperature, temperatureLevel, 35, 39, 36.1, 37.2, Number(temperature.replace(',', '.'))),
  metric('sleep', sleep, sleepLevel, 0, 10, 7, 10, Number(sleep.replace(',', '.'))),
];

export const HOME_SCENARIO_PREVIEW: Record<DemoScenarioId, HomeScenarioPreview> = {
  normal: {
    verdict: 'ok',
    mood: 4,
    metrics: makeMetrics('112/72', '64', '98', '36,6', '7,5', LEVELS.green),
  },
  ca4: {
    verdict: 'attention',
    mood: 4,
    metrics: makeMetrics('118/76', '72', '98', '36,8', '5', LEVELS.amber),
  },
  missing_sensor: {
    verdict: 'attention',
    mood: 4,
    metrics: makeMetrics('—', '66', '97', '36,7', '7,3', LEVELS.green, LEVELS.green, LEVELS.unknown),
  },
  low_temp: {
    verdict: 'attention',
    mood: 4,
    metrics: makeMetrics('114/74', '66', '97', '35,6', '7,2', LEVELS.green, LEVELS.inDoubt),
  },
  voice_not_understood: {
    verdict: null,
    mood: null,
    metrics: makeMetrics('112/72', '64', '98', '36,6', '—', LEVELS.unknown),
  },
};

export const HOME_RANGE_PERCENT = 100;
export const HOME_PROGRESS_PERCENT = 20;
