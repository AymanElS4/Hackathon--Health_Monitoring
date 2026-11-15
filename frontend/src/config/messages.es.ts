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
  'agenda.experiment': 'Experimento de biología',
  'agenda.exercise': 'Ejercicio',

  // Home dashboard
  'screen.home': 'Base Vital',
  'screen.checkin': 'Chequeo diario',
  'screen.history': 'Historial',
  'home.greeting': 'Hola, {name}',
  'home.missionDay': 'Día 23 · Luz 9/14',
  'home.connectivity.online': 'Conectado',
  'home.connectivity.offline': 'Sin internet · todo funciona',
  'home.demoLabel': 'Demostración',
  'home.demoDisclaimer': 'Datos simulados · no son mediciones reales',
  'home.dashboardTitle': 'Tu día, de un vistazo',
  'home.crewName': 'Ana',
  'home.brandBase': 'base',
  'home.brandVital': 'vital',
  'home.greetingGlyph': '✳',
  'home.now': 'Ahora',
  'home.next': 'Después',
  'home.checkinTitle': 'Chequeo diario',
  'home.checkinDescription': 'Un minuto para saber cómo va tu día.',
  'home.duration': '1 min',
  'home.progress': 'Progreso del día',
  'home.progressValue': '1 de 5',
  'home.checkinTime': '09:30',
  'home.nextCount': '2',
  'home.start': 'Empezar',
  'home.pending': '{count} actividades pendientes hoy',
  'home.pending.one': '1 actividad pendiente hoy',
  'home.status.title': 'Estado de {name}',
  'home.status.none': 'Sin chequeo hoy',
  'home.status.today': 'Hoy: {verdict}',
  'home.status.ok': 'Bien',
  'home.mood': 'Ánimo {value}/5*',
  'home.sensorLabel': '{sensor} · {level}',
  'home.sensorLabelReason': '{reason} · {level}',
  'home.metric.pressure': 'Presión',
  'home.metric.pulse': 'Pulso',
  'home.metric.oxygen': 'Oxígeno',
  'home.metric.temperature': 'Temperatura',
  'home.metric.sleep': 'Sueño',
  'home.metric.mood': 'Ánimo',
  'home.source.simulated': 'equipo simulado',
  'home.source.voice': 'respuesta de demo',
  'home.allowed': 'Rango permitido',
  'home.allowed.pressure': '< 120/80',
  'home.allowed.pulse': '60–100',
  'home.allowed.oxygen': '≥ 95 %',
  'home.allowed.temperature': '36,1–37,2 °C',
  'home.allowed.sleep': '≥ 7 h',
  'home.baseline': 'Aún aprendo tu normal',
  'home.metricNote': '* criterio del equipo, no clínico',
  'home.sensorHint': 'Toca un sensor para ver su medida',
  'home.bodyLabel': 'Vista frontal del cuerpo y ubicación de sensores',
  'home.afterMission': 'Misión lunar · Día 23',
  'home.phaseLabel': 'Fase de luz',
  'home.phaseValue': 'Luz · día 9 de 14',
  'home.nextAction': 'Lo próximo',
  'home.nav.home': 'Inicio',
  'home.nav.health': 'Salud',
  'home.nav.agenda': 'Agenda',
  'home.nav.guide': 'Guía',
  'home.nav.history': 'Historial',
  'home.nav.disabled': '{name}, {status}',
  'home.comingSoon': 'Próximamente',
  'home.onlineLabel': 'Estado de conexión',
  'home.todayLabel': 'Hoy',
  'home.temperatureCelsius': '{value} °C',
  'home.pressureValue': '{systolic}/{diastolic}',
  'home.metricValue': '{value} {unit}',
  'home.unit.pulse': 'bpm',
  'home.unit.oxygen': '%',
  'home.unit.temperature': '°C',
  'home.unit.sleep': 'h',
  'home.moodValue': '{value}/5',
  'home.bodyDot': 'Ver medida de {sensor}: {level}',
  'home.selectedMetric': 'Medida seleccionada',
  'home.scenario.badge': 'Escenario: {scenario}',
  'home.reading.simulated': 'Valor de demostración',
  'home.level.none': 'sin chequeo hoy',
  'home.lunarCycle': 'Ciclo de luz de la misión',
  'home.upcoming.location': 'Laboratorio',
  'home.upcoming.eva': 'Paneles solares',
  'history.empty.title': 'Aún no hay chequeos guardados',
  'history.empty.description': 'Cuando completes un chequeo, aparecerá aquí con el origen de cada dato.',
  'history.back': 'Volver al inicio',
  'history.simulation': 'Registro simulado',
  'history.source.voice': 'voz',
  'history.source.device': 'equipo',
  'history.loadError': 'No se pudo cargar el historial. Inténtalo de nuevo.',
  'history.valueWithSource': '{value} · {source}',
  'checkin.preview.title': 'Tu chequeo empieza aquí',
  'checkin.preview.description': 'Vita te preguntará por el sueño, el ánimo y cómo te sientes. La conexión con la voz estará disponible en la siguiente etapa.',
  'checkin.preview.step1': 'Horas de sueño',
  'checkin.preview.step2': 'Ánimo del 1 al 5',
  'checkin.preview.step3': 'Síntomas',
  'checkin.preview.status': 'Preparando el chequeo',
  'checkin.preview.back': 'Volver al inicio',

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
  'scenario.changeError': 'No se pudo completar el cambio de escenario. Revisa el historial antes de volver a intentarlo.',
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
