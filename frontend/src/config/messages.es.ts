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
  'confirm.sleep.one': 'Escuché 1 hora. ¿Correcto?',
  'ask.mood': 'Del uno al cinco, ¿cómo te sientes?',
  'confirm.mood': 'Escuché {mood}. ¿Correcto?',
  'ask.symptoms': '¿Tienes algún síntoma?',
  measure: 'Ahora tomo tus signos.',
  'retry.sleep': 'No te entendí bien, ¿me lo repites? Dime un número entre 0 y 16.',
  'retry.mood': 'No te entendí bien, ¿me lo repites? Dime un número del 1 al 5.',
  next: 'Lo próximo: {title} a las {time}.',
  'next.none': 'No hay más actividades hoy.',

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

  // Display value of a sensor reading (SensorReading.value), units included
  'value.sleep_hours': '{value} h',
  'value.resting_heart_rate': '{value} lpm',
  'value.oxygen_saturation': '{value} %',
  'value.body_temperature': '{value} °C',
  'value.blood_pressure': '{systolic}/{diastolic}',
  'value.mood': '{value}',
  'value.missing': '—',

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
  'home.history': 'Ver historial →',
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

  // Demo agenda titles (src/config/agenda.ts)
  'agenda.breakfast': 'Desayuno',
  'agenda.dailyCheckin': 'Chequeo diario',
  'agenda.eva': 'Salida extravehicular',
  'agenda.eva.solarPanel': 'Revisión del panel solar',
  'agenda.bioExperiment': 'Experimento de biología',
  'agenda.bioExperiment.lab': 'Laboratorio',
  'agenda.exercise': 'Ejercicio',

  // Screen headings (placeholders until the screens are implemented)
  'screen.home': 'Base Vital',
  'screen.checkin': 'Chequeo diario',
  'screen.history': 'Historial',

  // Check-in screen (T056): step labels, status indicators, controls, demo answer input
  'checkin.title': 'Chequeo diario',
  'checkin.listening': 'Te escucho…',
  'checkin.paused': 'En pausa',
  'checkin.pause': 'Pausa',
  'checkin.resume': 'Sigue',
  'checkin.repeat': 'Repite',
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
  'checkin.backHome': 'Volver a Inicio',
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
  'status.mood': 'Ánimo {value}/{of}',
  'status.verdict.ok': 'Bien',
  'status.verdict.attention': 'Atención',
  'status.verdict.alert': 'Alerta',

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
};

/** Spanish number format: decimal comma, at most one decimal ("7,5", "16"). */
const NUMBER_FORMAT = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });

/** Formats a number for Spanish speech and text: 7.5 → "7,5". */
export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/**
 * Looks up a message and replaces each `{name}` placeholder with `params[name]`.
 * Numeric params use `formatNumber`. Placeholders without a matching param are left as they are.
 * Unknown keys return the key.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return match;
    const value = params[name];
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}
