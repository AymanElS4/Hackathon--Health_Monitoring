import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  Heart,
  Moon,
  Thermometer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { THRESHOLDS, levelFor } from '@base-vital/health-rules';
import type { Indicator, Level, Threshold } from '@base-vital/contracts';
import {
  SENSOR_COLORS,
  CHART_COLORS,
  HEALTH_CHART_DOMAINS,
  HEALTH_CHART_HEIGHT,
  DESKTOP_MEDIA_QUERY,
  TEMPERATURE_FRACTION_DIGITS,
  BPM_STEP,
} from '../../config/constants';
import { getLocale } from '../../config/i18n';
import { t } from '../../config/messages.es';
import { useLocale } from '../useLocale';
import { Badge } from './Badge';
import { levelBadgeText } from './levelBadgeText';

/** True from the desktop breakpoint up; desktop where `matchMedia` is missing (jsdom). */
function useIsDesktop(): boolean {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    supported ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches : true,
  );
  useEffect(() => {
    if (!supported) return undefined;
    const query = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = () => setIsDesktop(query.matches);
    onChange();
    if (typeof query.addEventListener !== 'function') return undefined;
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [supported]);
  return isDesktop;
}

/** Formats a number with the current locale (decimal separator follows it). */
function fmt(value: unknown): string {
  return typeof value === 'number'
    ? new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(value)
    : String(value);
}

/** Formats a temperature with a fixed number of decimals (38,0). */
function fmtTemp(value: number): string {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: TEMPERATURE_FRACTION_DIGITS,
    maximumFractionDigits: TEMPERATURE_FRACTION_DIGITS,
  }).format(value);
}

/** Formats an ISO date (YYYY-MM-DD) for the axis with the current locale; falls back to the raw text. */
function fmtDate(value: unknown): string {
  const date = new Date(`${String(value)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}

/** Error shown in the fallback banner: a catalog key with params, or a raw message from the runtime. */
type FetchError = { key: string; params?: Record<string, string | number> } | { raw: string };

class MetricsFetchError extends Error {
  constructor(
    readonly key: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(key);
  }
}

/**
 * Registro de métricas fisiológicas individuales
 */
export interface MetricRecord {
  date: string;
  sleep_hours: number;
  temperature: number;
  heart_rate: number;
  bp_systolic: number;
  bp_diastolic: number;
}

export interface MetricsApiResponse {
  data: MetricRecord[];
  /** Ignored by the panel: reference lines come from `THRESHOLDS` (health-rules), not from the API. */
  thresholds?: unknown;
}

/**
 * Datos simulados (Dummy data) coherentes para fallback en caso de error de red o backend desconectado
 */
export const DUMMY_METRICS_DATA: MetricRecord[] = [
  { date: '2023-10-01', sleep_hours: 6.5, temperature: 36.8, heart_rate: 72, bp_systolic: 115, bp_diastolic: 75 },
  { date: '2023-10-02', sleep_hours: 7.2, temperature: 36.6, heart_rate: 68, bp_systolic: 118, bp_diastolic: 76 },
  { date: '2023-10-03', sleep_hours: 8.0, temperature: 36.7, heart_rate: 65, bp_systolic: 112, bp_diastolic: 74 },
  { date: '2023-10-04', sleep_hours: 5.8, temperature: 37.1, heart_rate: 78, bp_systolic: 124, bp_diastolic: 82 },
  { date: '2023-10-05', sleep_hours: 7.5, temperature: 36.5, heart_rate: 70, bp_systolic: 116, bp_diastolic: 77 },
  { date: '2023-10-06', sleep_hours: 7.0, temperature: 36.9, heart_rate: 74, bp_systolic: 119, bp_diastolic: 78 },
  { date: '2023-10-07', sleep_hours: 8.2, temperature: 36.6, heart_rate: 66, bp_systolic: 114, bp_diastolic: 73 },
];

/** A reference line drawn on a chart; `y` and the value text are read from `THRESHOLDS`. */
interface RefLine {
  y: number;
  color: string;
  /** Catalog key of the label. */
  labelKey: string;
  /** Text substituted for `{value}` in the label. */
  value: string;
  /** True when the band is a team criterion (drawn with "*"). */
  team: boolean;
}

/** Everything a card shows about its thresholds: lines, reference box text, sources. */
interface ThresholdView {
  lines: RefLine[];
  reference: string;
  sources: string[];
}

function find(indicator: Threshold['indicator'], pick: (th: Threshold) => boolean): Threshold {
  const found = THRESHOLDS.find((th) => th.indicator === indicator && pick(th));
  if (!found) throw new Error(`Missing threshold for ${indicator}`);
  return found;
}

/** Short source name: text before " — " and without the "(systolic, mmHg)" suffix. */
function sourceName(th: Threshold): string {
  return (th.source ?? '').split(' — ')[0].replace(/\s*\((?:systolic|diastolic), mmHg\)$/, '');
}

const defined = (value: number | undefined): value is number => value !== undefined;

function buildSleep(): ThresholdView {
  const cited = find('sleep_hours', (th) => defined(th.green.min));
  const team = find('sleep_hours', (th) => th.sourceStatus === 'team_criterion' && defined(th.red.max));
  const min = cited.green.min as number;
  const redBelow = team.red.max as number;
  return {
    lines: [
      { y: min, color: CHART_COLORS.minLine, labelKey: 'health.chart.min', value: fmt(min), team: false },
      { y: redBelow, color: CHART_COLORS.alertLine, labelKey: 'health.chart.redBelow', value: fmt(redBelow), team: true },
    ],
    reference: t('health.threshold.sleep', { min: fmt(min), unit: 'h' }),
    sources: [sourceName(cited)],
  };
}

function buildTemperature(): ThresholdView {
  const normal = find('body_temperature', (th) => defined(th.green.min));
  const fever = find('body_temperature', (th) => defined(th.red.min));
  const min = normal.green.min as number;
  const amberFrom = normal.amber.min as number;
  const feverFrom = fever.red.min as number;
  return {
    lines: [
      { y: min, color: CHART_COLORS.minLine, labelKey: 'health.chart.minTemp', value: fmtTemp(min), team: false },
      { y: amberFrom, color: CHART_COLORS.warningLine, labelKey: 'health.chart.amberTemp', value: fmtTemp(amberFrom), team: false },
      { y: feverFrom, color: CHART_COLORS.alertLine, labelKey: 'health.chart.fever', value: fmtTemp(feverFrom), team: false },
    ],
    reference: t('health.threshold.rangeLt', { min: fmtTemp(min), max: fmtTemp(amberFrom), unit: '°C' }),
    sources: [sourceName(normal), sourceName(fever)],
  };
}

function buildHeart(): ThresholdView {
  const green = find('resting_heart_rate', (th) => th.sourceStatus === 'cited');
  const team = find('resting_heart_rate', (th) => th.sourceStatus === 'team_criterion' && defined(th.red.min));
  const min = green.green.min as number;
  const max = (green.green.max as number) - BPM_STEP;
  const redFrom = team.red.min as number;
  return {
    lines: [
      { y: min, color: CHART_COLORS.minLine, labelKey: 'health.chart.minBpm', value: fmt(min), team: false },
      { y: max, color: CHART_COLORS.maxLine, labelKey: 'health.chart.maxBpm', value: fmt(max), team: false },
      { y: redFrom, color: CHART_COLORS.alertLine, labelKey: 'health.chart.redBpm', value: fmt(redFrom), team: true },
    ],
    reference: t('health.threshold.range', { min: fmt(min), max: fmt(max), unit: 'BPM' }),
    sources: [sourceName(green)],
  };
}

function buildPressure(): ThresholdView {
  const sys = find('blood_pressure', (th) => th.component === 'systolic');
  const dia = find('blood_pressure', (th) => th.component === 'diastolic');
  const sysGreen = sys.green.max as number;
  const sysRed = sys.red.min as number;
  const diaGreen = dia.green.max as number;
  const diaRed = dia.red.min as number;
  return {
    lines: [
      { y: sysGreen, color: SENSOR_COLORS.pressure, labelKey: 'health.chart.greenSys', value: fmt(sysGreen), team: false },
      { y: sysRed, color: CHART_COLORS.alertLine, labelKey: 'health.chart.redSys', value: fmt(sysRed), team: false },
      { y: diaGreen, color: CHART_COLORS.diastolic, labelKey: 'health.chart.greenDia', value: fmt(diaGreen), team: false },
      { y: diaRed, color: CHART_COLORS.alertLine, labelKey: 'health.chart.redDia', value: fmt(diaRed), team: false },
    ],
    reference: t('health.threshold.pressure', {
      sys: fmt(sysGreen),
      dia: fmt(diaGreen),
      redSys: fmt(sysRed),
      redDia: fmt(diaRed),
      unit: 'mmHg',
    }),
    sources: [sourceName(sys)],
  };
}

/** Label of a line: catalog text, plus "*" when the band is a team criterion. */
function lineLabel(line: RefLine): string {
  const text = t(line.labelKey, { value: line.value });
  return line.team ? `${text}${t('team.criterion.mark')}` : text;
}

/** One reference line; the label text is the only place the value appears. */
function renderLine(line: RefLine) {
  return (
    <ReferenceLine
      key={line.labelKey}
      y={line.y}
      stroke={line.color}
      strokeDasharray="4 4"
      label={{ value: lineLabel(line), fill: line.color, fontSize: 11 }}
    />
  );
}

type MetricKey = 'all' | 'sleep_hours' | 'temperature' | 'heart_rate' | 'blood_pressure';

interface MetricConfig {
  key: keyof MetricRecord | 'blood_pressure';
  /** Catalog key of the title. */
  title: string;
  unit: string;
  color: string;
  secondaryColor?: string;
  icon: React.ReactNode;
  /** Catalog key of the description. */
  description: string;
}

/** Endpoint shown in the fallback banner (a path, not user text). */
const API_PATH = '/api/metrics';

const METRIC_CONFIGS: Record<Exclude<MetricKey, 'all'>, MetricConfig> = {
  sleep_hours: {
    key: 'sleep_hours',
    title: 'health.metric.sleep.title',
    unit: 'h',
    color: SENSOR_COLORS.sleep,
    icon: <Moon className="h-5 w-5 text-indigo-500" />,
    description: 'health.metric.sleep.desc',
  },
  temperature: {
    key: 'temperature',
    title: 'health.metric.temperature.title',
    unit: '°C',
    color: SENSOR_COLORS.temperature,
    icon: <Thermometer className="h-5 w-5 text-teal-500" />,
    description: 'health.metric.temperature.desc',
  },
  heart_rate: {
    key: 'heart_rate',
    title: 'health.metric.heart.title',
    unit: 'BPM',
    color: SENSOR_COLORS.pulse,
    icon: <Heart className="h-5 w-5 text-pink-500" />,
    description: 'health.metric.heart.desc',
  },
  blood_pressure: {
    key: 'blood_pressure',
    title: 'health.metric.pressure.title',
    unit: 'mmHg',
    color: SENSOR_COLORS.pressure,
    secondaryColor: CHART_COLORS.diastolic,
    icon: <Activity className="h-5 w-5 text-purple-500" />,
    description: 'health.metric.pressure.desc',
  },
};

export interface PhysiologicalMetricsDashboardProps {
  /** Render the team-criterion note here (default). A parent that shows it once sets this to false. */
  showTeamNote?: boolean;
  /** Called with whether the metrics shown draw a team-criterion band (a "*" line). */
  onTeamBandsChange?: (drawsTeamBand: boolean) => void;
}

const METRIC_KEYS = ['sleep_hours', 'temperature', 'heart_rate', 'blood_pressure'] as const;

/** Short chip label (catalog key) of each metric, used by the mobile selector. */
const CHIP_LABELS: Record<(typeof METRIC_KEYS)[number], string> = {
  sleep_hours: 'health.chip.sleep',
  temperature: 'health.chip.temperature',
  heart_rate: 'health.chip.heart',
  blood_pressure: 'health.chip.pressure',
};

const LEVEL_INDICATOR = {
  sleep_hours: 'sleep_hours',
  temperature: 'body_temperature',
  heart_rate: 'resting_heart_rate',
} as const satisfies Record<string, Indicator>;

/** Level of the latest record's value for one metric (earlier days feed the consecutive-night rules). */
function latestLevel(key: (typeof METRIC_KEYS)[number], data: MetricRecord[]): Level | null {
  if (data.length === 0) return null;
  const last = data[data.length - 1];
  if (key === 'blood_pressure') {
    return levelFor('blood_pressure', { systolic: last.bp_systolic, diastolic: last.bp_diastolic }).level;
  }
  const history = data
    .slice(0, -1)
    .reverse()
    .map((record) => record[key]);
  return levelFor(LEVEL_INDICATOR[key], last[key], { history }).level;
}

export function PhysiologicalMetricsDashboard({
  showTeamNote: renderTeamNote = true,
  onTeamBandsChange,
}: PhysiologicalMetricsDashboardProps = {}) {
  useLocale();
  const isDesktop = useIsDesktop();
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [data, setData] = useState<MetricRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<FetchError | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MetricKey>('all');

  const fetchMetrics = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      // Intento de conexión al backend de Next.js
      const response = await fetch(API_PATH);

      if (!response.ok) {
        throw new MetricsFetchError('health.error.http', {
          status: response.status,
          statusText: response.statusText,
        });
      }

      const json: MetricsApiResponse = await response.json();

      if (!json || !Array.isArray(json.data)) {
        throw new MetricsFetchError('health.error.format');
      }

      setData(json.data);
      setIsFallback(false);
    } catch (err) {
      // Mecanismo de Fallback robusto en caso de caída, backend apagado o error de red
      console.warn('API /api/metrics unavailable or failed. Using fallback demo data:', err);
      setData(DUMMY_METRICS_DATA);
      setIsFallback(true);
      if (err instanceof MetricsFetchError) setFetchError({ key: err.key, params: err.params });
      else if (err instanceof Error) setFetchError({ raw: err.message });
      else setFetchError({ key: 'health.error.connect' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const latestRecord = useMemo(() => {
    if (data.length === 0) return null;
    return data[data.length - 1];
  }, [data]);

  const views = useMemo(
    () => ({ sleep: buildSleep(), temperature: buildTemperature(), heart: buildHeart(), pressure: buildPressure() }),
    [],
  );
  // Mobile shows one metric at a time: "all" falls back to the first metric.
  const activeFilter: MetricKey = !isDesktop && selectedFilter === 'all' ? METRIC_KEYS[0] : selectedFilter;
  const chartHeight = isDesktop ? HEALTH_CHART_HEIGHT.desktop : HEALTH_CHART_HEIGHT.mobile;
  const shown = METRIC_KEYS.filter((key) => activeFilter === 'all' || activeFilter === key);
  const viewOf = { sleep_hours: views.sleep, temperature: views.temperature, heart_rate: views.heart, blood_pressure: views.pressure };
  const drawsTeamBand = shown.some((key) => viewOf[key].lines.some((line) => line.team));
  useEffect(() => {
    onTeamBandsChange?.(drawsTeamBand);
  }, [drawsTeamBand, onTeamBandsChange]);

  const errorText =
    fetchError === null ? null : 'raw' in fetchError ? fetchError.raw : t(fetchError.key, fetchError.params);
  const xAxisProps = {
    dataKey: 'date',
    stroke: CHART_COLORS.text,
    fontSize: 12,
    tickLine: false,
    tickFormatter: fmtDate,
    minTickGap: 12,
  } as const;

  return (
    <section className="flex w-full min-w-0 flex-col gap-6" aria-label={t('health.panelAria')}>
      {/* Header del Panel con estado de conexión */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">{t('health.title')}</h2>
            {isFallback ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                {t('health.badge.fallback')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {t('health.badge.connected')}
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm text-slate-500 md:block ${infoOpen ? 'block' : 'hidden'}`}>
            {t('health.subtitle')}
          </p>
        </div>

        <div className="flex w-full items-center gap-3 md:w-auto">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex min-h-touch w-full items-center justify-center gap-2 px-4 py-2 md:min-h-0 md:w-auto rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t('health.refresh.loading') : t('health.refresh.idle')}
          </button>
        </div>
      </div>

      {/* Banner explicativo de Fallback si la API falló */}
      {isFallback && (
        <div
          className={`p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-sm items-start gap-3 md:flex ${infoOpen ? 'flex' : 'hidden'}`}
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">{t('health.fallback.lead')}</span> {t('health.fallback.body1')}{' '}
            <code className="break-all rounded bg-amber-100 px-1 py-0.5 text-xs">{API_PATH}</code>
            {t('health.fallback.tail', {
              detail: errorText ? t('health.fallback.detail', { message: errorText }) : '',
            })}
          </div>
        </div>
      )}

      {/* Selector de métrica o vista general */}
      <div className="flex flex-wrap items-center gap-2">
        {isDesktop && (
          <button
            onClick={() => setSelectedFilter('all')}
            className={`min-h-touch md:min-h-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('health.filter.all')}
          </button>
        )}
        {METRIC_KEYS.map((key) => {
          const cfg = METRIC_CONFIGS[key];
          return (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              aria-pressed={activeFilter === key}
              className={`min-h-touch md:min-h-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                activeFilter === key
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t(isDesktop ? cfg.title : CHIP_LABELS[key])}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setInfoOpen((open) => !open)}
          aria-expanded={infoOpen}
          className="min-h-touch px-3.5 text-sm font-semibold text-primary md:hidden"
        >
          {t(infoOpen ? 'health.info.hide' : 'health.info.show')}
        </button>
      </div>

      {/* Gráficos de tendencias lineales para cada parámetro */}
      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        {(activeFilter === 'all' || activeFilter === 'sleep_hours') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.sleep_hours}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.sleep_hours : null}
            thresholdDisplay={views.sleep.reference}
            sources={views.sleep.sources}
            level={latestLevel('sleep_hours', data)}
            isDesktop={isDesktop}
            infoOpen={infoOpen}
            chartComponent={
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[...HEALTH_CHART_DOMAINS.sleep]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit=" h"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${fmt(val)} h`, t('health.tooltip.sleep')]}
                  />
                  <Legend />
                  {views.sleep.lines.map(renderLine)}
                  <Line
                    type="linear"
                    dataKey="sleep_hours"
                    name={t('health.series.sleep')}
                    stroke={METRIC_CONFIGS.sleep_hours.color}
                    strokeWidth={3}
                    dot={{ r: 5, fill: METRIC_CONFIGS.sleep_hours.color }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
          />
        )}

        {(activeFilter === 'all' || activeFilter === 'temperature') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.temperature}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.temperature : null}
            thresholdDisplay={views.temperature.reference}
            sources={views.temperature.sources}
            level={latestLevel('temperature', data)}
            isDesktop={isDesktop}
            infoOpen={infoOpen}
            chartComponent={
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[...HEALTH_CHART_DOMAINS.temperature]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={METRIC_CONFIGS.temperature.unit}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${fmt(val)} ${METRIC_CONFIGS.temperature.unit}`, t('health.tooltip.temperature')]}
                  />
                  <Legend />
                  {views.temperature.lines.map(renderLine)}
                  <Line
                    type="linear"
                    dataKey="temperature"
                    name={t('health.series.temperature')}
                    stroke={METRIC_CONFIGS.temperature.color}
                    strokeWidth={3}
                    dot={{ r: 5, fill: METRIC_CONFIGS.temperature.color }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
          />
        )}

        {(activeFilter === 'all' || activeFilter === 'heart_rate') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.heart_rate}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.heart_rate : null}
            thresholdDisplay={views.heart.reference}
            sources={views.heart.sources}
            level={latestLevel('heart_rate', data)}
            isDesktop={isDesktop}
            infoOpen={infoOpen}
            chartComponent={
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[...HEALTH_CHART_DOMAINS.heart]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={` ${METRIC_CONFIGS.heart_rate.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${fmt(val)} ${METRIC_CONFIGS.heart_rate.unit}`, t('health.tooltip.heart')]}
                  />
                  <Legend />
                  {views.heart.lines.map(renderLine)}
                  <Line
                    type="linear"
                    dataKey="heart_rate"
                    name={t('health.series.heart')}
                    stroke={METRIC_CONFIGS.heart_rate.color}
                    strokeWidth={3}
                    dot={{ r: 5, fill: METRIC_CONFIGS.heart_rate.color }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
          />
        )}

        {(activeFilter === 'all' || activeFilter === 'blood_pressure') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.blood_pressure}
            dataLength={data.length}
            latestValue={latestRecord ? `${fmt(latestRecord.bp_systolic)}/${fmt(latestRecord.bp_diastolic)}` : null}
            thresholdDisplay={views.pressure.reference}
            sources={views.pressure.sources}
            level={latestLevel('blood_pressure', data)}
            isDesktop={isDesktop}
            infoOpen={infoOpen}
            chartComponent={
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={[...HEALTH_CHART_DOMAINS.pressure]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={` ${METRIC_CONFIGS.blood_pressure.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown, name: unknown) => [
                      `${fmt(val)} ${METRIC_CONFIGS.blood_pressure.unit}`,
                      String(name),
                    ]}
                  />
                  <Legend />
                  {views.pressure.lines.map(renderLine)}
                  <Line
                    type="linear"
                    dataKey="bp_systolic"
                    name={t('health.series.systolic')}
                    stroke={SENSOR_COLORS.pressure}
                    strokeWidth={3}
                    dot={{ r: 5, fill: SENSOR_COLORS.pressure }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="linear"
                    dataKey="bp_diastolic"
                    name={t('health.series.diastolic')}
                    stroke={CHART_COLORS.diastolic}
                    strokeWidth={3}
                    dot={{ r: 5, fill: CHART_COLORS.diastolic }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            }
          />
        )}
      </div>

      {renderTeamNote && drawsTeamBand && <p className="text-xs text-slate-500">{t('team.criterion.note')}</p>}
    </section>
  );
}

interface MetricTrendCardProps {
  config: MetricConfig;
  dataLength: number;
  latestValue: number | string | null;
  thresholdDisplay: string;
  /** Source names of the cited bands drawn on the chart. */
  sources: string[];
  /** Level of the latest value (null without data); shown as a badge on mobile. */
  level: Level | null;
  isDesktop: boolean;
  /** Mobile only: the long descriptions and captions are shown. */
  infoOpen: boolean;
  chartComponent: React.ReactNode;
}

function MetricTrendCard({
  config,
  dataLength,
  latestValue,
  thresholdDisplay,
  sources,
  level,
  isDesktop,
  infoOpen,
  chartComponent,
}: MetricTrendCardProps) {
  const longText = `md:block ${infoOpen ? 'block' : 'hidden'}`;
  return (
    <article className="min-w-0 rounded-2xl bg-white border border-slate-200/90 shadow-sm p-4 md:p-6 flex flex-col gap-3 md:gap-5">
      {/* Cabecera del parámetro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 md:pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{t(config.title)}</h3>
            <p className={`text-xs text-slate-500 ${longText}`}>{t(config.description)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 md:flex-row md:items-center md:gap-4">
          <div>
            <span className="text-xs text-slate-500 block">{t('health.card.latest')}</span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-extrabold text-slate-800 md:text-base">
                {latestValue !== null ? `${latestValue} ${config.unit}` : t('health.card.noData')}
              </span>
              {!isDesktop && level !== null && <Badge level={level}>{levelBadgeText(level)}</Badge>}
            </span>
          </div>
          <div className="hidden h-7 w-[1px] bg-slate-200 md:block" />
          <div>
            <span className="hidden text-xs text-slate-500 md:block">{t('health.card.reference')}</span>
            <span className="mr-2 text-xs font-semibold text-slate-700 md:mr-0 md:block">{thresholdDisplay}</span>
            <span className="text-[11px] text-slate-500 md:block">
              {t('health.card.source', { source: sources.join(', ') })}
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico de Líneas Rectas: Evolución temporal histórica a ancho completo */}
      <div className="w-full min-w-0 flex flex-col justify-between p-3 md:p-4 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className={`mb-3 flex-wrap items-center justify-between gap-1 md:flex ${infoOpen ? 'flex' : 'hidden'}`}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {t('health.card.trendTitle')}
            </h4>
          </div>
          <span className="text-xs text-slate-400">{t('health.card.records', { count: dataLength })}</span>
        </div>

        <div className="w-full min-w-0">{chartComponent}</div>
        <p className={`mt-2 text-center text-[11px] text-slate-500 ${longText}`}>
          {t('health.card.caption')}
        </p>
      </div>
    </article>
  );
}
