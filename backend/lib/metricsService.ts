/**
 * Servicio de métricas fisiológicas - Capa de abstracción de datos.
 *
 * Desacoplado de cualquier motor de base de datos específico (PostgreSQL, SQLite, MongoDB, etc.).
 * Cuando se decida el ORM o driver final (Prisma, Drizzle, pg, etc.), únicamente se
 * reemplaza la implementación interna de getHistoricalMetrics().
 */

export interface MetricRecord {
  /** Fecha en formato ISO o YYYY-MM-DD */
  date: string;
  /** Horas de sueño (float) */
  sleep_hours: number;
  /** Temperatura corporal en °C (float) */
  temperature: number;
  /** Frecuencia cardíaca en BPM (int) */
  heart_rate: number;
  /** Presión arterial sistólica en mmHg (int) */
  bp_systolic: number;
  /** Presión arterial diastólica en mmHg (int) */
  bp_diastolic: number;
}

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
 * Umbrales clínicos de referencia estáticos
 */
export const CLINICAL_THRESHOLDS: MetricThresholds = {
  sleep_hours: { min: 7, max: 9, unit: 'h' },
  temperature: { min: 36.1, max: 37.2, unit: '°C' },
  heart_rate: { min: 60, max: 80, unit: 'BPM' },
  blood_pressure: { sys_max: 120, dia_max: 80, unit: 'mmHg' },
};

/**
 * Obtiene el historial de métricas fisiológicas.
 *
 * Actualmente provee un conjunto inicial de datos representativos y coherentes.
 * Para conectar a base de datos (ej. Prisma o Drizzle):
 * ```ts
 * // Ejemplo con Prisma:
 * // return await prisma.dailyCheck.findMany({ select: { date: true, sleep_hours: true, ... } });
 * ```
 */
export async function getHistoricalMetrics(): Promise<MetricRecord[]> {
  // Capa desacoplada: Simulación de consulta a base de datos
  return [
    {
      date: '2023-10-01',
      sleep_hours: 6.5,
      temperature: 36.8,
      heart_rate: 72,
      bp_systolic: 115,
      bp_diastolic: 75,
    },
    {
      date: '2023-10-02',
      sleep_hours: 7.2,
      temperature: 36.6,
      heart_rate: 68,
      bp_systolic: 118,
      bp_diastolic: 76,
    },
    {
      date: '2023-10-03',
      sleep_hours: 8.0,
      temperature: 36.7,
      heart_rate: 65,
      bp_systolic: 112,
      bp_diastolic: 74,
    },
    {
      date: '2023-10-04',
      sleep_hours: 5.8,
      temperature: 37.1,
      heart_rate: 78,
      bp_systolic: 124,
      bp_diastolic: 82,
    },
    {
      date: '2023-10-05',
      sleep_hours: 7.5,
      temperature: 36.5,
      heart_rate: 70,
      bp_systolic: 116,
      bp_diastolic: 77,
    },
    {
      date: '2023-10-06',
      sleep_hours: 7.0,
      temperature: 36.9,
      heart_rate: 74,
      bp_systolic: 119,
      bp_diastolic: 78,
    },
    {
      date: '2023-10-07',
      sleep_hours: 8.2,
      temperature: 36.6,
      heart_rate: 66,
      bp_systolic: 114,
      bp_diastolic: 73,
    },
  ];
}
