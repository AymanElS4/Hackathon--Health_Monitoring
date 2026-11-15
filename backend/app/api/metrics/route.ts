import { NextResponse } from 'next/server';
import { getHistoricalMetrics, CLINICAL_THRESHOLDS, type MetricsApiResponse } from '../../lib/metricsService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/metrics
 *
 * Retorna las métricas fisiológicas históricas y los umbrales clínicos de referencia.
 */
export async function GET() {
  try {
    const data = await getHistoricalMetrics();

    const responsePayload: MetricsApiResponse = {
      data,
      thresholds: CLINICAL_THRESHOLDS,
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    console.error('[API /api/metrics] Error al obtener métricas históricas:', error);
    return NextResponse.json(
      {
        error: 'Error al consultar las métricas fisiológicas',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
