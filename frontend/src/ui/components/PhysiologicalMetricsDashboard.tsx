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
import { SENSOR_COLORS, CHART_COLORS } from '../../config/constants';
import { getLocale } from '../../config/i18n';
import { t } from '../../config/messages.es';
import { useLocale } from '../useLocale';

/** Formats a number with the current locale (decimal separator follows it). */
function fmt(value: unknown): string {
  return typeof value === 'number'
    ? new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(value)
    : String(value);
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

/**
 * Umbrales clínicos estáticos
 */
export interface MetricThresholds {
  sleep_hours: { min: number; max: number; unit: string };
  temperature: { min: number; max: number; unit: string };
  heart_rate: { min: number; max: number; unit: string };
  blood_pressure: { sys_max: number; dia_max: number; unit: string };
}

export interface MetricsApiResponse {
  data: MetricRecord[];
  thresholds: MetricThresholds;
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

export const DEFAULT_THRESHOLDS: MetricThresholds = {
  sleep_hours: { min: 7, max: 9, unit: 'h' },
  temperature: { min: 36.1, max: 37.2, unit: '°C' },
  heart_rate: { min: 60, max: 80, unit: 'BPM' },
  blood_pressure: { sys_max: 120, dia_max: 80, unit: 'mmHg' },
};

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

/* eslint-disable no-magic-numbers -- chart axis ranges; TODO move to config/constants.ts */
/** Y-axis ranges per chart: [min, max] in the metric's unit. */
const SLEEP_DOMAIN: [number, number] = [4, 11];
const TEMPERATURE_DOMAIN: [number, number] = [35.5, 38];
const HEART_DOMAIN: [number, number] = [50, 95];
const PRESSURE_DOMAIN: [number, number] = [60, 140];
/* eslint-enable no-magic-numbers */

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

export function PhysiologicalMetricsDashboard() {
  useLocale();
  const [data, setData] = useState<MetricRecord[]>([]);
  const [thresholds, setThresholds] = useState<MetricThresholds>(DEFAULT_THRESHOLDS);
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

      if (!json || !Array.isArray(json.data) || !json.thresholds) {
        throw new MetricsFetchError('health.error.format');
      }

      setData(json.data);
      setThresholds(json.thresholds);
      setIsFallback(false);
    } catch (err) {
      // Mecanismo de Fallback robusto en caso de caída, backend apagado o error de red
      console.warn('API /api/metrics unavailable or failed. Using fallback demo data:', err);
      setData(DUMMY_METRICS_DATA);
      setThresholds(DEFAULT_THRESHOLDS);
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
          <p className="text-sm text-slate-500 mt-1">
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
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
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
        <button
          onClick={() => setSelectedFilter('all')}
          className={`min-h-touch md:min-h-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedFilter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {t('health.filter.all')}
        </button>
        {(['sleep_hours', 'temperature', 'heart_rate', 'blood_pressure'] as const).map((key) => {
          const cfg = METRIC_CONFIGS[key];
          return (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`min-h-touch md:min-h-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedFilter === key
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t(cfg.title)}
            </button>
          );
        })}
      </div>

      {/* Gráficos de tendencias lineales para cada parámetro */}
      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        {(selectedFilter === 'all' || selectedFilter === 'sleep_hours') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.sleep_hours}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.sleep_hours : null}
            thresholdDisplay={t('health.threshold.sleep', {
              min: fmt(thresholds.sleep_hours.min),
              max: fmt(thresholds.sleep_hours.max),
              unit: thresholds.sleep_hours.unit,
            })}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={SLEEP_DOMAIN}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={` ${thresholds.sleep_hours.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${fmt(val)} ${thresholds.sleep_hours.unit}`, t('health.tooltip.sleep')]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.sleep_hours.min}
                    stroke={CHART_COLORS.minLine}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.min', { value: fmt(thresholds.sleep_hours.min) }), fill: CHART_COLORS.minLine, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.sleep_hours.max}
                    stroke={CHART_COLORS.maxLine}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.max', { value: fmt(thresholds.sleep_hours.max) }), fill: CHART_COLORS.maxLine, fontSize: 11 }}
                  />
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

        {(selectedFilter === 'all' || selectedFilter === 'temperature') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.temperature}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.temperature : null}
            thresholdDisplay={t('health.threshold.range', {
              min: fmt(thresholds.temperature.min),
              max: fmt(thresholds.temperature.max),
              unit: thresholds.temperature.unit,
            })}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={TEMPERATURE_DOMAIN}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={thresholds.temperature.unit}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${fmt(val)} ${thresholds.temperature.unit}`, t('health.tooltip.temperature')]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.temperature.min}
                    stroke={CHART_COLORS.minLine}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.minTemp', { value: fmt(thresholds.temperature.min) }), fill: CHART_COLORS.minLine, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.temperature.max}
                    stroke={CHART_COLORS.warningLine}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.fever', { value: fmt(thresholds.temperature.max) }), fill: CHART_COLORS.warningLine, fontSize: 11 }}
                  />
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

        {(selectedFilter === 'all' || selectedFilter === 'heart_rate') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.heart_rate}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.heart_rate : null}
            thresholdDisplay={t('health.threshold.range', {
              min: fmt(thresholds.heart_rate.min),
              max: fmt(thresholds.heart_rate.max),
              unit: thresholds.heart_rate.unit,
            })}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={HEART_DOMAIN}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={` ${thresholds.heart_rate.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${fmt(val)} ${thresholds.heart_rate.unit}`, t('health.tooltip.heart')]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.heart_rate.min}
                    stroke={CHART_COLORS.minLine}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.minBpm', { value: fmt(thresholds.heart_rate.min) }), fill: CHART_COLORS.minLine, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.heart_rate.max}
                    stroke={CHART_COLORS.alertLine}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.maxBpm', { value: fmt(thresholds.heart_rate.max) }), fill: CHART_COLORS.alertLine, fontSize: 11 }}
                  />
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

        {(selectedFilter === 'all' || selectedFilter === 'blood_pressure') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.blood_pressure}
            dataLength={data.length}
            latestValue={latestRecord ? `${fmt(latestRecord.bp_systolic)}/${fmt(latestRecord.bp_diastolic)}` : null}
            thresholdDisplay={t('health.threshold.pressure', {
              sys: fmt(thresholds.blood_pressure.sys_max),
              dia: fmt(thresholds.blood_pressure.dia_max),
              unit: thresholds.blood_pressure.unit,
            })}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis {...xAxisProps} />
                  <YAxis
                    domain={PRESSURE_DOMAIN}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    tickFormatter={fmt}
                    unit={` ${thresholds.blood_pressure.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown, name: unknown) => [
                      `${fmt(val)} ${thresholds.blood_pressure.unit}`,
                      String(name),
                    ]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.blood_pressure.sys_max}
                    stroke={SENSOR_COLORS.pressure}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.limitSys', { value: fmt(thresholds.blood_pressure.sys_max) }), fill: SENSOR_COLORS.pressure, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.blood_pressure.dia_max}
                    stroke={CHART_COLORS.diastolic}
                    strokeDasharray="4 4"
                    label={{ value: t('health.chart.limitDia', { value: fmt(thresholds.blood_pressure.dia_max) }), fill: CHART_COLORS.diastolic, fontSize: 11 }}
                  />
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
    </section>
  );
}

interface MetricTrendCardProps {
  config: MetricConfig;
  dataLength: number;
  latestValue: number | string | null;
  thresholdDisplay: string;
  chartComponent: React.ReactNode;
}

function MetricTrendCard({
  config,
  dataLength,
  latestValue,
  thresholdDisplay,
  chartComponent,
}: MetricTrendCardProps) {
  return (
    <article className="min-w-0 rounded-2xl bg-white border border-slate-200/90 shadow-sm p-4 md:p-6 flex flex-col gap-5">
      {/* Cabecera del parámetro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{t(config.title)}</h3>
            <p className="text-xs text-slate-500">{t(config.description)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 md:flex-row md:items-center md:gap-4">
          <div>
            <span className="text-xs text-slate-500 block">{t('health.card.latest')}</span>
            <span className="text-base font-extrabold text-slate-800">
              {latestValue !== null ? `${latestValue} ${config.unit}` : t('health.card.noData')}
            </span>
          </div>
          <div className="hidden h-7 w-[1px] bg-slate-200 md:block" />
          <div>
            <span className="text-xs text-slate-500 block">{t('health.card.reference')}</span>
            <span className="text-xs font-semibold text-slate-700">{thresholdDisplay}</span>
          </div>
        </div>
      </div>

      {/* Gráfico de Líneas Rectas: Evolución temporal histórica a ancho completo */}
      <div className="w-full min-w-0 flex flex-col justify-between p-3 md:p-4 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {t('health.card.trendTitle')}
            </h4>
          </div>
          <span className="text-xs text-slate-400">{t('health.card.records', { count: dataLength })}</span>
        </div>

        <div className="w-full min-w-0">{chartComponent}</div>
        <p className="text-[11px] text-slate-500 text-center mt-2">
          {t('health.card.caption')}
        </p>
      </div>
    </article>
  );
}
