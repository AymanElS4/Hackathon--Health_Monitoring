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
  title: string;
  unit: string;
  color: string;
  secondaryColor?: string;
  icon: React.ReactNode;
  description: string;
}

const METRIC_CONFIGS: Record<Exclude<MetricKey, 'all'>, MetricConfig> = {
  sleep_hours: {
    key: 'sleep_hours',
    title: 'Horas de Sueño',
    unit: 'h',
    color: SENSOR_COLORS.sleep,
    icon: <Moon className="h-5 w-5 text-indigo-500" />,
    description: 'Tiempo total de reposo registrado por noche.',
  },
  temperature: {
    key: 'temperature',
    title: 'Temperatura Corporal',
    unit: '°C',
    color: SENSOR_COLORS.temperature,
    icon: <Thermometer className="h-5 w-5 text-teal-500" />,
    description: 'Temperatura central basal registrada en cabina.',
  },
  heart_rate: {
    key: 'heart_rate',
    title: 'Frecuencia Cardíaca',
    unit: 'BPM',
    color: SENSOR_COLORS.pulse,
    icon: <Heart className="h-5 w-5 text-pink-500" />,
    description: 'Pulsaciones por minuto en reposo.',
  },
  blood_pressure: {
    key: 'blood_pressure',
    title: 'Presión Arterial',
    unit: 'mmHg',
    color: SENSOR_COLORS.pressure,
    secondaryColor: CHART_COLORS.diastolic,
    icon: <Activity className="h-5 w-5 text-purple-500" />,
    description: 'Presión sistólica y diastólica en reposo.',
  },
};

export function PhysiologicalMetricsDashboard() {
  const [data, setData] = useState<MetricRecord[]>([]);
  const [thresholds, setThresholds] = useState<MetricThresholds>(DEFAULT_THRESHOLDS);
  const [loading, setLoading] = useState<boolean>(true);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<MetricKey>('all');

  const fetchMetrics = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      // Intento de conexión al backend de Next.js
      const response = await fetch('/api/metrics');

      if (!response.ok) {
        throw new Error(`Respuesta HTTP fallida: ${response.status} ${response.statusText}`);
      }

      const json: MetricsApiResponse = await response.json();

      if (!json || !Array.isArray(json.data) || !json.thresholds) {
        throw new Error('Formato de respuesta del endpoint inesperado.');
      }

      setData(json.data);
      setThresholds(json.thresholds);
      setIsFallback(false);
    } catch (err) {
      // Mecanismo de Fallback robusto en caso de caída, backend apagado o error de red
      console.warn('API /api/metrics no disponible o con error. Activando dummy data de respaldo:', err);
      setData(DUMMY_METRICS_DATA);
      setThresholds(DEFAULT_THRESHOLDS);
      setIsFallback(true);
      setErrorMessage(
        err instanceof Error ? err.message : 'Error al conectar con el servidor de métricas.'
      );
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

  return (
    <section className="flex flex-col gap-6 w-full" aria-label="Panel de Métricas Fisiológicas">
      {/* Header del Panel con estado de conexión */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Panel de Métricas Fisiológicas</h2>
            {isFallback ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Modo Demostración (Fallback)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                API Conectada
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tendencia temporal histórica continua y calibración frente a umbrales clínicos de referencia.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Consultando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Banner explicativo de Fallback si la API falló */}
      {isFallback && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Respaldo activo con datos simulados:</span> No se pudo establecer
            comunicación directa con <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">/api/metrics</code>
            {errorMessage ? ` (${errorMessage})` : ''}. Se han cargado datos sintéticos coherentes para garantizar
            la operatividad continua de los gráficos clínicos.
          </div>
        </div>
      )}

      {/* Selector de métrica o vista general */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedFilter === 'all'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todas las métricas
        </button>
        {(['sleep_hours', 'temperature', 'heart_rate', 'blood_pressure'] as const).map((key) => {
          const cfg = METRIC_CONFIGS[key];
          return (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedFilter === key
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cfg.title}
            </button>
          );
        })}
      </div>

      {/* Gráficos de tendencias lineales para cada parámetro */}
      <div className="flex flex-col gap-8">
        {(selectedFilter === 'all' || selectedFilter === 'sleep_hours') && (
          <MetricTrendCard
            config={METRIC_CONFIGS.sleep_hours}
            dataLength={data.length}
            latestValue={latestRecord ? latestRecord.sleep_hours : null}
            thresholdDisplay={`Objetivo: ${thresholds.sleep_hours.min} - ${thresholds.sleep_hours.max} ${thresholds.sleep_hours.unit}`}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" stroke={CHART_COLORS.text} fontSize={12} tickLine={false} />
                  <YAxis
                    domain={[4, 11]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    unit={` ${thresholds.sleep_hours.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${val} ${thresholds.sleep_hours.unit}`, 'Horas']}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.sleep_hours.min}
                    stroke={CHART_COLORS.minLine}
                    strokeDasharray="4 4"
                    label={{ value: `Mín (${thresholds.sleep_hours.min}h)`, fill: CHART_COLORS.minLine, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.sleep_hours.max}
                    stroke={CHART_COLORS.maxLine}
                    strokeDasharray="4 4"
                    label={{ value: `Máx (${thresholds.sleep_hours.max}h)`, fill: CHART_COLORS.maxLine, fontSize: 11 }}
                  />
                  <Line
                    type="linear"
                    dataKey="sleep_hours"
                    name="Horas de sueño"
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
            thresholdDisplay={`Rango Normal: ${thresholds.temperature.min} - ${thresholds.temperature.max} ${thresholds.temperature.unit}`}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" stroke={CHART_COLORS.text} fontSize={12} tickLine={false} />
                  <YAxis
                    domain={[35.5, 38]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    unit={thresholds.temperature.unit}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${val} ${thresholds.temperature.unit}`, 'Temperatura']}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.temperature.min}
                    stroke={CHART_COLORS.minLine}
                    strokeDasharray="4 4"
                    label={{ value: `Mín (${thresholds.temperature.min}°C)`, fill: CHART_COLORS.minLine, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.temperature.max}
                    stroke={CHART_COLORS.warningLine}
                    strokeDasharray="4 4"
                    label={{ value: `Fiebre (${thresholds.temperature.max}°C)`, fill: CHART_COLORS.warningLine, fontSize: 11 }}
                  />
                  <Line
                    type="linear"
                    dataKey="temperature"
                    name="Temperatura (°C)"
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
            thresholdDisplay={`Rango Normal: ${thresholds.heart_rate.min} - ${thresholds.heart_rate.max} ${thresholds.heart_rate.unit}`}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" stroke={CHART_COLORS.text} fontSize={12} tickLine={false} />
                  <YAxis
                    domain={[50, 95]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    unit={` ${thresholds.heart_rate.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown) => [`${val} ${thresholds.heart_rate.unit}`, 'Ritmo']}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.heart_rate.min}
                    stroke={CHART_COLORS.minLine}
                    strokeDasharray="4 4"
                    label={{ value: `Mín (${thresholds.heart_rate.min})`, fill: CHART_COLORS.minLine, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.heart_rate.max}
                    stroke={CHART_COLORS.alertLine}
                    strokeDasharray="4 4"
                    label={{ value: `Máx (${thresholds.heart_rate.max})`, fill: CHART_COLORS.alertLine, fontSize: 11 }}
                  />
                  <Line
                    type="linear"
                    dataKey="heart_rate"
                    name="Pulsaciones (BPM)"
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
            latestValue={latestRecord ? `${latestRecord.bp_systolic}/${latestRecord.bp_diastolic}` : null}
            thresholdDisplay={`Límites Máximos: Sistólica < ${thresholds.blood_pressure.sys_max} / Diastólica < ${thresholds.blood_pressure.dia_max} ${thresholds.blood_pressure.unit}`}
            chartComponent={
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" stroke={CHART_COLORS.text} fontSize={12} tickLine={false} />
                  <YAxis
                    domain={[60, 140]}
                    stroke={CHART_COLORS.text}
                    fontSize={12}
                    unit={` ${thresholds.blood_pressure.unit}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: CHART_COLORS.tooltipBg, color: CHART_COLORS.tooltipText, borderRadius: '8px' }}
                    formatter={(val: unknown, name: unknown) => [
                      `${val} ${thresholds.blood_pressure.unit}`,
                      String(name),
                    ]}
                  />
                  <Legend />
                  <ReferenceLine
                    y={thresholds.blood_pressure.sys_max}
                    stroke={SENSOR_COLORS.pressure}
                    strokeDasharray="4 4"
                    label={{ value: `Límite Sis (${thresholds.blood_pressure.sys_max})`, fill: SENSOR_COLORS.pressure, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={thresholds.blood_pressure.dia_max}
                    stroke={CHART_COLORS.diastolic}
                    strokeDasharray="4 4"
                    label={{ value: `Límite Dia (${thresholds.blood_pressure.dia_max})`, fill: CHART_COLORS.diastolic, fontSize: 11 }}
                  />
                  <Line
                    type="linear"
                    dataKey="bp_systolic"
                    name="Sistólica (mmHg)"
                    stroke={SENSOR_COLORS.pressure}
                    strokeWidth={3}
                    dot={{ r: 5, fill: SENSOR_COLORS.pressure }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="linear"
                    dataKey="bp_diastolic"
                    name="Diastólica (mmHg)"
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
    <article className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6 flex flex-col gap-5">
      {/* Cabecera del parámetro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            {config.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{config.title}</h3>
            <p className="text-xs text-slate-500">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">Último Valor:</span>
            <span className="text-base font-extrabold text-slate-800">
              {latestValue !== null ? `${latestValue} ${config.unit}` : 'Sin datos'}
            </span>
          </div>
          <div className="h-7 w-[1px] bg-slate-200" />
          <div>
            <span className="text-xs text-slate-500 block">Referencia Clínica:</span>
            <span className="text-xs font-semibold text-slate-700">{thresholdDisplay}</span>
          </div>
        </div>
      </div>

      {/* Gráfico de Líneas Rectas: Evolución temporal histórica a ancho completo */}
      <div className="w-full flex flex-col justify-between p-4 rounded-xl bg-slate-50/70 border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Tendencia Histórica Temporal (Líneas Rectas)
            </h4>
          </div>
          <span className="text-xs text-slate-400">{dataLength} registros evaluados</span>
        </div>

        <div className="w-full">{chartComponent}</div>
        <p className="text-[11px] text-slate-500 text-center mt-2">
          Monitoreo continuo de tendencia a lo largo del tiempo conectado con líneas rectas de punto a punto y umbrales clínicos de referencia.
        </p>
      </div>
    </article>
  );
}
