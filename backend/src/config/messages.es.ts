/**
 * The only place for surgeon-page text (constitution, principle II).
 * Flat dotted keys with Spanish values. The `verdict.*`, `level.*`, `indicator.*`,
 * `sensor.*` and `action.*` keys mirror the tablet's messages (frontend/src/config/messages.es.ts)
 * so that a key sent by the tablet renders the same text on the surgeon page.
 * No value names a diagnosis or a medication (principle VI).
 */
export const MESSAGES_ES = {
  // Page
  'page.title': 'Base Vital — Cirujano de vuelo',
  'page.subtitle': 'Resumen de chequeos diarios. La decisión final es del cirujano de vuelo.',
  'code.label': 'Código de acceso',
  'code.submit': 'Entrar',
  'code.invalid': 'Código incorrecto.',
  'code.too_many': 'Demasiados intentos. Espera un minuto.',
  'code.logout': 'Salir',
  'error.unavailable': 'El servidor no puede leer los datos ahora. Intenta de nuevo en un momento.',
  'error.not_found': 'No hay chequeos de este tripulante.',

  // Crew list
  'crew.title': 'Tripulantes',
  'crew.empty': 'Aún no llegan chequeos.',
  'crew.day': 'Día {day}',
  'crew.last_check': 'Último chequeo',
  'crew.open_alert': 'Aviso abierto',
  'crew.back': 'Volver a la lista',

  // Crew summary
  'summary.latest': 'Último chequeo',
  'summary.history': 'Últimos 14 días',
  'summary.sensors': 'Sensores',
  'summary.symptoms': 'Síntomas',
  'summary.no_symptoms': 'Ninguno',
  'summary.action': 'Acción indicada en la tableta',
  'summary.mission_start': 'Inicio de misión',
  'summary.values': 'Valores',
  'summary.source.voice': 'voz (confirmado)',
  'summary.source.device': 'equipo',

  // Verdict headlines (same as the tablet)
  'verdict.ok': 'Bien',
  'verdict.attention': 'Atención',
  'verdict.alert': 'Alerta',

  // One everyday action per verdict (same as the tablet)
  'action.symptom': 'Mencionaste un síntoma: avisa al cirujano de vuelo en tu próximo contacto',
  'action.red': 'Un valor está en alerta: avisa al cirujano de vuelo ahora',
  'action.fever': 'Temperatura alta: avisa al cirujano de vuelo ahora',
  'action.two_amber': 'Dos valores están en atención: descansa y avisa al cirujano de vuelo',
  'action.slept_little': 'Dormiste poco: tómalo con calma',
  'action.missing_data': 'Falta el dato de {sensor}: repite la medida',
  'action.in_doubt': 'Un dato quedó en duda: repite la medida',
  'action.outside_normal': 'Un valor está fuera de tu normal: tómalo con calma y mídelo más tarde',
  'action.single_amber': 'Un valor está en atención: tómalo con calma y mídelo más tarde',

  // Levels (same as the tablet)
  'level.green': 'bien',
  'level.amber': 'atención',
  'level.red': 'alerta',
  'level.in_doubt': 'en duda',
  'level.unknown': 'sin dato',

  // Indicator labels, keyed by the Indicator enum value (same as the tablet)
  'indicator.sleep_hours': 'Sueño',
  'indicator.mood': 'Ánimo',
  'indicator.resting_heart_rate': 'Pulso',
  'indicator.blood_pressure': 'Presión',
  'indicator.body_temperature': 'Temperatura',
  'indicator.oxygen_saturation': 'Oxígeno',

  // Sensor labels, keyed by the SensorKey enum value (same as the tablet)
  'sensor.sleep': 'Sueño',
  'sensor.pulse': 'Pulso',
  'sensor.pressure': 'Presión',
  'sensor.temperature': 'Temperatura',
  'sensor.oxygen': 'Oxígeno',

  // Symptoms, keyed by the Symptom enum value
  'symptom.dizziness': 'Mareo',
  'symptom.fainting': 'Desmayo',
  'symptom.chest_pain': 'Dolor de pecho',
  'symptom.shortness_of_breath': 'Falta de aire',
  'symptom.none': 'Ninguno',

  // Team criterion and simulation marks (principle VIII)
  'team.criterion': 'criterio del equipo, no clínico',
  'history.simulated': 'simulado',

  // Open alerts (US4)
  'alerts.title': 'Avisos abiertos',
  'alerts.empty': 'No hay avisos abiertos.',
  'urgency.now': 'Ahora',
  'urgency.soon': 'Pronto',
  'decision.manage_on_base': 'Manejar en la base',
  'decision.consult_surgeon': 'Consultar con el cirujano',
  'decision.prepare_return': 'Preparar regreso',
  'decision.made': 'Decisión: {decision} · {time}',
  'decision.prompt': 'Registrar decisión',
  'decision.already': 'Este aviso ya tenía una decisión.',
} as const;

export type MessageKey = keyof typeof MESSAGES_ES;
