/**
 * All Spanish UI and voice text lives in this file (constitution, principle II).
 * Flat dotted keys; `{name}` placeholders are filled by `t()`.
 * Verdict and action texts describe the reading and one everyday action; they
 * never name a diagnosis or a medication (principle VI).
 */
export const messages: Record<string, string> = {
  // Check-in script (contracts/checkin-script.md)
  greet: 'Buenos días, Ana. Chequeo diario.',
  'ask.sleep': '¿Cuántas horas dormiste?',
  'confirm.sleep': 'Escuché {hours} horas. ¿Correcto?',
  'ask.mood': 'Del uno al cinco, ¿cómo te sientes?',
  'confirm.mood': 'Escuché {mood}. ¿Correcto?',
  'ask.symptoms': '¿Tienes algún síntoma?',
  measure: 'Ahora tomo tus signos.',
  'retry.sleep': 'No te entendí bien, ¿me lo repites? Dime un número entre 0 y 16.',
  'retry.mood': 'No te entendí bien, ¿me lo repites? Dime un número del 1 al 5.',
  next: 'Lo próximo: {title} a las {time}.',

  // Verdict headlines (RN5)
  'verdict.ok': 'Estás bien',
  'verdict.attention': 'Atención',
  'verdict.alert': 'Alerta',

  // One everyday action per verdict (RN5 priority order)
  'action.symptom': 'Mencionaste un síntoma: avisa al cirujano de vuelo en tu próximo contacto',
  'action.red': 'Un valor está en alerta: avisa al cirujano de vuelo ahora',
  'action.fever': 'Temperatura alta: avisa al cirujano de vuelo ahora',
  'action.two_amber': 'Dos valores están en atención: descansa y avisa al cirujano de vuelo',
  'action.slept_little': 'Dormiste poco: tómalo con calma',
  'action.missing_data': 'Falta el dato de {sensor}: repite la medida',
  'action.in_doubt': 'Un dato quedó en duda: repite la medida',
  'action.outside_normal': 'Un valor está fuera de tu normal: tómalo con calma y mídelo más tarde',
  'action.single_amber': 'Un valor está en atención: tómalo con calma y mídelo más tarde',

  // Levels (RN6)
  'level.green': 'bien',
  'level.amber': 'atención',
  'level.red': 'alerta',
  'level.in_doubt': 'en duda',
  'level.unknown': 'sin dato',

  // Indicator labels, keyed by the Indicator enum value
  'indicator.sleep_hours': 'Sueño',
  'indicator.mood': 'Ánimo',
  'indicator.resting_heart_rate': 'Pulso',
  'indicator.blood_pressure': 'Presión',
  'indicator.body_temperature': 'Temperatura',
  'indicator.oxygen_saturation': 'Oxígeno',

  // Sensor labels, keyed by the SensorKey enum value
  'sensor.sleep': 'Sueño',
  'sensor.pulse': 'Pulso',
  'sensor.pressure': 'Presión',
  'sensor.temperature': 'Temperatura',
  'sensor.oxygen': 'Oxígeno',

  // Dot label: "Ánimo · atención*" (RN6)
  'dot.label': '{reason} · {level}',

  // Team criterion (principle VIII)
  'team.criterion': 'criterio del equipo, no clínico',
  'team.criterion.mark': '*',
  'team.criterion.note': '* criterio del equipo, no clínico',

  // Baseline, simulation and navigation
  'baseline.learning': 'Aún aprendo tu normal',
  'device.simulated': 'equipo simulado',
  'history.simulated': 'simulado',
  'home.vita': 'Vita',

  // Demo agenda titles (src/config/agenda.ts)
  'agenda.daily_check': 'Chequeo diario',
  'agenda.breakfast': 'Desayuno',
  'agenda.maintenance': 'Mantenimiento de equipos',
  'agenda.lunch': 'Almuerzo',
  'agenda.experiment': 'Experimento',
  'agenda.exercise': 'Ejercicio',

  // Screen headings (placeholders until the screens are implemented)
  'screen.home': 'Base Vital',
  'screen.checkin': 'Chequeo diario',
  'screen.history': 'Historial',

  // Demo scenario selector (FR-013)
  'scenario.title': 'Escenario de demo',
  'scenario.normal': 'Normal',
  'scenario.ca4': 'CA4',
  'scenario.missing_sensor': 'Sensor sin dato',
  'scenario.low_temp': 'Temperatura baja',
  'scenario.voice_not_understood': 'Voz no entendida',
  'scenario.resetWarning': 'Cambiar de escenario reinicia el historial',
  'scenario.confirm': 'Cambiar y reiniciar',
  'scenario.cancel': 'Cancelar',
};

/**
 * Looks up a message and replaces each `{name}` placeholder with `params[name]`.
 * Placeholders without a matching param are left as they are. Unknown keys return the key.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}
