/**
 * All Spanish UI and voice text lives in this file (constitution, principle II).
 * Flat dotted keys; `{name}` placeholders are filled by `t()`.
 * Verdict and action texts describe the reading and one everyday action; they
 * never name a diagnosis or a medication (principle VI).
 */
import { getLocale, type Locale } from './i18n';
import { MESSAGES_EN } from './messages.en';
import { GUIDE_ES } from './catalogs/guide.es';
import { HEALTH_ES } from './catalogs/health.es';
import { HISTORY_ES } from './catalogs/history.es';

export const messages: Record<string, string> = {
  ...GUIDE_ES,
  ...HEALTH_ES,
  ...HISTORY_ES,
  // Check-in script (contracts/checkin-script.md)
  greet: 'Buenos días, Ana. Chequeo diario.',
  'ask.sleep': '¿Cuántas horas dormiste?',
  'confirm.sleep': 'Escuché que dormiste {hours} horas. ¿Es correcto?',
  'confirm.sleep.one': 'Escuché que dormiste 1 hora. ¿Es correcto?',
  'ask.mood': 'Del uno al cinco, ¿cómo te sientes?',
  'confirm.mood': 'Escuché que tu ánimo es {mood} de 5. ¿Es correcto?',
  'ask.mood.again': 'Antes de seguir, ¿cómo te sientes? Dime un número del uno al cinco.',
  'ask.symptoms': '¿Tienes algún síntoma?',
  measure: 'Ahora tomo tus signos.',
  // RN1: the single extra thermometer read after a temperature in doubt
  'measure.temperature.again': 'Vuelvo a medir la temperatura.',
  'retry.sleep': 'No te entendí bien, ¿me lo repites? Dime un número entre 0 y 16.',
  'retry.mood': 'No te entendí bien, ¿me lo repites? Dime un número del 1 al 5.',
  next: 'Lo próximo: {title} a las {time}.',
  'next.none': 'No hay más actividades hoy.',

  // Chat transcript: Ana's answers as they appear in the conversation (T080a)
  'answer.sleep': '{hours} horas',
  'answer.sleep.one': '1 hora',
  'answer.mood': '{mood} de 5',
  'chat.partial': '{text}…',

  'language.toggle': 'Cambiar idioma de la pantalla y de la voz',

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
  // Metric row badge when the level comes from another indicator than the row's own: "Ánimo: atención*"
  'metric.reasonBadge': '{reason}: {level}',

  // Display value of a sensor reading (SensorReading.value), units included
  'value.sleep_hours': '{value} h',
  'value.resting_heart_rate': '{value} lpm',
  'value.oxygen_saturation': '{value} %',
  'value.body_temperature': '{value} °C',
  'value.blood_pressure': '{systolic}/{diastolic} mmHg',
  'value.mood': '{value}',
  'value.missing': '—',

  // Unit shown next to a range bar scale (UI_SCALES, config/constants.ts)
  'unit.pressure': 'mmHg',
  'unit.pulse': 'lpm',
  'unit.oxygen': '%',
  'unit.temperature': '°C',
  'unit.sleep': 'h',

  // Sensor names inside a sentence, e.g. "Falta el dato de la presión" (action.missing_data)
  'sensor.lower.sleep': 'el sueño',
  'sensor.lower.pulse': 'el pulso',
  'sensor.lower.pressure': 'la presión',
  'sensor.lower.temperature': 'la temperatura',
  'sensor.lower.oxygen': 'el oxígeno',

  // Team criterion (principle VIII)
  'team.criterion': 'criterio del equipo, no clínico',
  'team.criterion.mark': '*',
  'team.criterion.note': '* criterio del equipo, no clínico',

  // Baseline, simulation and navigation
  'baseline.learning': 'Aún aprendo tu normal',
  'device.simulated': 'equipo simulado',
  'device.simulated.short': 'simulado',
  'meta.separator': '·',
  'history.simulated': 'simulado',
  'history.source.voice': 'voz',
  'history.source.device': 'equipo',
  'history.empty': 'Aún no hay chequeos guardados.',
  'history.load_failed': 'No se pudo leer el historial.',
  'history.link': 'Historial',
  'history.backHome': 'Volver a Hoy',
  'home.vita': 'Vita',

  // Home screen (FR-014, FR-015, FR-018)
  'home.greeting': 'Hola, {name}',
  'home.missionDay': 'Día {day} · {phase} {phaseDay}/{phaseOf}',
  'home.phase.light': 'Luz',
  'home.phase.dark': 'Oscuridad',
  'connectivity.offline': 'Sin internet · todo funciona',
  'connectivity.online': 'Conectado',
  'home.now': 'Ahora',
  'home.next': 'Después',
  'home.duration': '{min} min',
  'home.progress': 'Progreso diario: {done} de {total}',
  'home.start': 'Empezar',
  'home.estimated': 'Tiempo estimado {min} min',
  'home.pending': '{n} actividades pendientes hoy',
  'home.pending.one': '1 actividad pendiente hoy',
  'home.history': 'Ver historial',
  'home.avatarAlt': 'Avatar de la tripulante',
  'home.howAreYou': 'Cómo estás',
  'home.timeChip': '{time} · {min} min',
  'body.tapSensor': 'Toca un sensor',
  'body.fallbackAlt': 'Silueta del cuerpo con los sensores',
  'nav.home': 'Hoy',
  'nav.health': 'Salud',
  'nav.agenda': 'Agenda',
  'nav.guide': 'Guía',
  'nav.soon': 'Próximamente',

  // Calendar screen
  'screen.agenda': 'Agenda',
  'calendar.eyebrow': 'Planificación diaria',
  'calendar.description': 'Consulta las actividades programadas para cada fecha.',
  'calendar.today': 'Volver a hoy',
  'calendar.previousMonth': 'Mes anterior',
  'calendar.nextMonth': 'Mes siguiente',
  'calendar.monthView': 'Calendario mensual',
  'calendar.weekday.mon': 'Lu',
  'calendar.weekday.tue': 'Ma',
  'calendar.weekday.wed': 'Mi',
  'calendar.weekday.thu': 'Ju',
  'calendar.weekday.fri': 'Vi',
  'calendar.weekday.sat': 'Sá',
  'calendar.weekday.sun': 'Do',
  'calendar.hasEvents': 'Fechas con actividades',
  'calendar.daySchedule': 'Actividades del día',
  'calendar.eventCount.one': '1 actividad programada',
  'calendar.eventCount.other': '{n} actividades programadas',
  'calendar.empty': 'No hay actividades registradas para esta fecha.',
  'calendar.backHome': 'Volver a Inicio',

  // Demo agenda titles (src/config/agenda.ts)
  'agenda.breakfast': 'Desayuno',
  'agenda.dailyCheckin': 'Chequeo diario',
  'agenda.eva': 'Salida extravehicular',
  'agenda.eva.solarPanel': 'Revisión del panel solar',
  'agenda.bioExperiment': 'Experimento de biología',
  'agenda.bioExperiment.lab': 'Laboratorio',
  'agenda.exercise': 'Ejercicio',

  // Screen headings
  'screen.home': 'Base Vital',
  'screen.checkin': 'Chequeo diario',
  'screen.history': 'Historial',

  // Check-in screen (T056): step labels, status indicators, controls, demo answer input
  'checkin.title': 'Chequeo diario',
  'checkin.listening': 'Te escucho…',
  'checkin.paused': 'En pausa',
  'checkin.pause': 'Pausa',
  'checkin.resume': 'Seguir',
  'checkin.repeat': 'Repetir',
  'checkin.controlsHint': 'También puedes decir «para» o «repite»',
  'checkin.confirmHint': 'Di «sí» o «no»',
  'checkin.hint.finish': 'Di «sí» para terminar',
  'checkin.progress': 'Pregunta {n} de {of} · {topic}',
  'checkin.progressLabel': 'Progreso de las preguntas',
  'checkin.speaking': 'Vita está hablando…',
  // Icons of the controls and chips (decorative; kept here with the other texts)
  'checkin.pause.icon': '✋',
  'checkin.resume.icon': '▶️',
  'checkin.repeat.icon': '☝️',
  'checkin.yes.icon': '👍',
  'checkin.no.icon': '👎',
  'checkin.step.greeting': 'Saludo',
  'checkin.step.sleep': 'Sueño',
  'checkin.step.mood': 'Ánimo',
  'checkin.step.symptoms': 'Síntomas',
  'checkin.step.measuring': 'Medidas',
  'checkin.step.summary': 'Resumen',
  'checkin.step.next': 'Siguiente actividad',
  'checkin.answerLabel': 'Respuesta',
  'checkin.answerSend': 'Enviar',
  'checkin.done': 'Chequeo guardado',
  'checkin.save_failed': 'No se pudo guardar el chequeo.',
  'checkin.backHome': 'Volver al inicio',
  'checkin.details.show': 'Ver detalle',
  'checkin.details.hide': 'Ocultar detalle',
  'checkin.buttonsHint': 'No te entendí. Toca una opción.',
  'checkin.hoursOption': '{h} h',
  'checkin.moodOption.1': 'muy mal',
  'checkin.moodOption.2': 'mal',
  'checkin.moodOption.3': 'regular',
  'checkin.moodOption.4': 'bien',
  'checkin.moodOption.5': 'muy bien',
  'checkin.yes': 'Sí',
  'checkin.no': 'No',
  // Symptom buttons: the label is also the phrase sent to the parser (it matches case-insensitively).
  'checkin.symptom.mareo': 'Mareo',
  'checkin.symptom.desmayo': 'Desmayo',
  'checkin.symptom.chestPain': 'Dolor de pecho',
  'checkin.symptom.breathless': 'Falta de aire',
  'checkin.symptom.none': 'Ninguno',

  // Status header on Home (FR-016, SC-010). The verdict word appears once, in "Hoy: {verdict}".
  'status.title': 'Estado de {name}',
  'status.today': 'Hoy: {verdict}',
  'status.noCheck': 'Sin chequeo hoy',
  'status.previous': 'Ayer: {verdict}',
  'status.previousDated': '{when}: {verdict}',
  'status.lastCheck': 'Último chequeo: {when}',
  'status.lastCheckSimulated': 'Último chequeo: {when} · simulado',
  'status.yesterday': 'ayer',
  'status.mood': 'Ánimo {value}/{of}',
  'status.verdict.ok': 'Bien',
  'status.verdict.attention': 'Atención',
  'status.verdict.alert': 'Alerta',

  // Allowed range of a metric row, derived from the green band of the thresholds (CA7)
  'allowed.range': '{min}–{max}',
  'allowed.atLeast': '≥ {value}',
  'allowed.atLeastHours': '≥ {value} h',
  'allowed.below': '< {value}',
  'allowed.bloodPressure': '< {systolic}/{diastolic}',
  'allowed.shown': 'Permitido {range}',

  // Legend under "Estado de Ana" (docs/design/README.md)
  'legend.allowed': 'Permitido',
  'legend.attention': 'Atención',
  'legend.alert': 'Alerta',
  'legend.baseline': 'Tu normal',

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

  // Dev-only metrics overlay (T095): shown in development or with ?dev=metrics, never in the demo
  'dev.title': 'Métricas de desarrollo',
  'dev.checkin': 'Chequeo completo (toque a guardado)',
  'dev.voiceStart': 'Micrófono abierto tras la pregunta',
  'dev.finalTranscript': 'Fin de voz a transcripción final',
  'dev.fps': 'Cuadros por segundo del 3D',
  'dev.targetMax': 'objetivo ≤ {value}',
  'dev.targetMin': 'objetivo ≥ {value}',
  'dev.met': 'cumple',
  'dev.notMet': 'no cumple',
  'dev.notMeasured': 'sin medir',
  'dev.samples': '{count} muestras',
  'dev.unit.ms': '{value} ms',
  'dev.unit.s': '{value} s',
  'dev.unit.fps': '{value} fps',
  'dev.note': 'Tiempos: la muestra más lenta de la última pasada. FPS: última ventana de 1 s. La voz y la transcripción solo se miden con el reconocedor real.',
};

/** Spanish number format: decimal comma, at most one decimal ("7,5", "16"). */
const NUMBER_FORMAT_ES = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });
/** English number format: decimal point, at most one decimal ("7.5", "16"). */
const NUMBER_FORMAT_EN = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

/** Formats a number for speech and text in `language`: 7.5 → "7,5" (es) or "7.5" (en). */
export function formatNumber(value: number, language: Locale = 'es'): string {
  return (language === 'en' ? NUMBER_FORMAT_EN : NUMBER_FORMAT_ES).format(value);
}

/**
 * Looks up a message and replaces each `{name}` placeholder with `params[name]`.
 * Numeric params use `formatNumber` in `language`, the language of the catalog the
 * template came from. Placeholders without a matching param are left as they are.
 * Unknown keys return the key.
 */
function fill(
  template: string,
  language: Locale,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return match;
    const value = params[name];
    return typeof value === 'number' ? formatNumber(value, language) : value;
  });
}

/**
 * Looks up `key` in the catalog of `language`. English falls back to Spanish, then to the key;
 * the returned language is the catalog the template came from, used for number formatting.
 */
function lookup(key: string, language: Locale): { template: string; language: Locale } {
  if (language === 'en' && MESSAGES_EN[key] !== undefined) {
    return { template: MESSAGES_EN[key], language: 'en' };
  }
  return { template: messages[key] ?? key, language: 'es' };
}

/** On-screen text in the current locale (es or en); falls back to Spanish, then to the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const entry = lookup(key, getLocale());
  return fill(entry.template, entry.language, params);
}

/**
 * Text that is SPOKEN by Vita, in `language` (the voice language chosen at check-in start).
 * Defaults to Spanish. English falls back to Spanish, then to the key, like `t`.
 * Numbers are formatted in the language of the catalog used.
 */
export function tVoice(
  key: string,
  params?: Record<string, string | number>,
  language: Locale = 'es',
): string {
  const entry = lookup(key, language);
  return fill(entry.template, entry.language, params);
}
