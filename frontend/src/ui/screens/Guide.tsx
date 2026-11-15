import { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  Droplet,
  Heart,
  Moon,
  ShieldAlert,
  Thermometer,
  Wrench,
} from 'lucide-react';

import { CHECKIN_PATH, HOME_PATH } from '../../config/constants';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';

interface ProtocolDef {
  id: string;
  code: string;
  title: string;
  role: string;
  icon: typeof Moon;
  duration: string;
  objective: string;
  equipment: string[];
  restrictions: {
    rule: string;
    isNoGo: boolean;
  }[];
  sop: {
    step: number;
    phase: string;
    time?: string;
    action: string;
  }[];
  dataClosure: {
    samples?: string;
    hardware: string;
    data: string;
  };
}

const CLINICAL_PROTOCOLS: readonly ProtocolDef[] = [
  {
    id: 'sleep',
    code: 'SOP-MED-ACT01',
    title: 'Horas y Calidad de Sueño (Actigrafía)',
    role: 'Astronauta (Autónomo)',
    icon: Moon,
    duration: 'Continuo durante misión',
    objective:
      'Registro autónomo y continuo de los patrones de sueño y vigilia, y evaluación longitudinal de los ritmos circadianos del tripulante en microgravedad.',
    equipment: [
      'Dispositivo de pulsera Actiwatch Plus (resistente al agua, acelerómetro triaxial, fotocélula de luz ambiental integrada).',
      'Cable de interfaz USB de datos Actiwatch.',
      'Computadora de Soporte de la Estación (SSC) con software Actiware instalado.',
    ],
    restrictions: [
      { rule: 'Sin restricciones metabólicas, dietéticas ni de ejercicio.', isNoGo: false },
      { rule: 'No requiere configuraciones previas ni calibración en órbita antes de cada ciclo.', isNoGo: false },
    ],
    sop: [
      {
        step: 1,
        phase: 'Fijación del Dispositivo',
        action:
          'El astronauta debe colocarse y ajustar el monitor Actiwatch Plus en la muñeca (preferentemente no dominante). El equipo permanece en la muñeca de forma continua durante la vigilia y el descanso.',
      },
      {
        step: 2,
        phase: 'Marcador de Evento: Inicio del Sueño',
        action:
          'Al momento de ingresar al saco de dormir y disponerse a iniciar el reposo, presionar firmemente el botón integrado en el reloj hasta que el marcador confirme el evento de inicio del intento de sueño.',
      },
      {
        step: 3,
        phase: 'Marcador de Evento: Fin del Sueño',
        action:
          'Inmediatamente al despertar y comenzar la rutina matutina, volver a presionar el botón integrado para asentar el marcador correspondiente al final del periodo de sueño.',
      },
      {
        step: 4,
        phase: 'Descarga y Sincronización',
        action:
          'Periódicamente, conectar el dispositivo mediante su cable USB a la computadora SSC. Iniciar el software Actiware y ejecutar la descarga completa de telemetría de movimiento e iluminación ambiental.',
      },
    ],
    dataClosure: {
      hardware: 'Desconectar con cuidado el cable USB tras verificar la descarga. Mantener el dispositivo colocado.',
      data: 'El software Actiware almacena el archivo para procesamiento automático y telemetría al cirujano de vuelo.',
    },
  },
  {
    id: 'temperature',
    code: 'SOP-MED-PHS02',
    title: 'Temperatura Corporal (Evaluación PHS)',
    role: 'Oficial Médico (CMO) + Astronauta',
    icon: Thermometer,
    duration: '35 min bloque total (15 min por tripulante)',
    objective:
      'Monitoreo periódico de la temperatura central basal del astronauta como parte integral de las Evaluaciones del Estado de Salud Periódicas (Periodic Health Status - PHS).',
    equipment: [
      'Termómetro clínico del Paquete de Diagnóstico Médico (Medical Diagnostic Pack - MDP).',
      'Fundas protectoras higiénicas desechables para sensor.',
      'Computadora de Soporte de la Estación (SSC).',
      'Software Data Collection Tool (DCT).',
      'Toallitas desinfectantes biocidas.',
    ],
    restrictions: [
      {
        rule: 'NO realizar actividad física extenuante que induzca dolor muscular tardío (DOMS) durante las 24 horas previas al examen.',
        isNoGo: true,
      },
      {
        rule: 'Ventana de tiempo obligatoria: 10 min setup CMO, 15 min examen por astronauta, 10 min guardado.',
        isNoGo: false,
      },
    ],
    sop: [
      {
        step: 1,
        phase: 'Configuración Inicial (CMO)',
        time: 'T-0 a T+10 min',
        action:
          'El CMO dedica 10 minutos para encender la computadora SSC, autenticarse, abrir la aplicación Data Collection Tool (DCT) y desplegar el termómetro del Medical Diagnostic Pack.',
      },
      {
        step: 2,
        phase: 'Medición Clínica (CMO y Tripulante)',
        time: 'Ventana de 15 min',
        action:
          'Instalar una funda desechable estéril en la sonda. Proceder a la toma de la temperatura corporal asegurando contacto adecuado hasta la señal acústica de estabilización.',
      },
      {
        step: 3,
        phase: 'Registro de Datos',
        time: 'Inmediato',
        action:
          'El CMO introduce manualmente los valores discretos leídos en °C directamente en los campos de la sesión PHS dentro del software DCT en la SSC.',
      },
      {
        step: 4,
        phase: 'Cierre y Guardado (Stow)',
        time: '10 min dedicados',
        action:
          'El CMO dedica 10 minutos para sanitizar el termómetro, desechar la funda y guardar (stow) el Paquete de Diagnóstico Médico de forma segura.',
      },
    ],
    dataClosure: {
      samples: 'Funda desechable descartada en bolsa de residuos biohazard.',
      hardware: 'Estiba completa y aseguramiento de correas del Medical Diagnostic Pack en rack correspondiente.',
      data: 'Confirmar el guardado de la sesión en DCT para downlink en la siguiente ventana de comunicaciones.',
    },
  },
  {
    id: 'blood_pressure',
    code: 'SOP-MED-BP03',
    title: 'Presión Arterial (PHS / Esfuerzo CEVIS)',
    role: 'Oficial Médico (CMO) + Astronauta',
    icon: Activity,
    duration: 'Variable: PHS (15 min) | CEVIS (15 a 90 min setup)',
    objective:
      'Determinación de la tensión arterial sistólica y diastólica en reposo basal y respuesta hemodinámica durante la prueba de esfuerzo escalonado en el cicloergómetro CEVIS.',
    equipment: [
      'Esfigmomanómetro clínico del Paquete de Diagnóstico Médico (Medical Diagnostic Pack).',
      'Brazalete de presión de tamaño adecuado para microgravedad.',
      'Cicloergómetro CEVIS (Cycle Ergometer with Vibration Isolation and Stabilization System) si aplica.',
      'Estación SSC con software de registro médico.',
    ],
    restrictions: [
      { rule: 'CERO ejercicio máximo en las 24 horas previas a la prueba formal.', isNoGo: true },
      { rule: 'CERO ejercicio de cualquier intensidad en las 8 horas previas.', isNoGo: true },
      { rule: 'Ayuno de comidas abundantes durante las 2 horas anteriores.', isNoGo: true },
      {
        rule: 'Prohibición de cafeína, alcohol y nicotina en las últimas 8 horas (tolerancia: máx. 1 taza de café hasta 60 min antes).',
        isNoGo: true,
      },
    ],
    sop: [
      {
        step: 1,
        phase: 'Configuración del Dispositivo',
        time: '15 a 90 min según prueba',
        action:
          'El CMO prepara y calibra el esfigmomanómetro. Si la sesión incluye la prueba en bicicleta CEVIS, la configuración mecánica, eléctrica y telemétrica toma de 15 a 90 minutos.',
      },
      {
        step: 2,
        phase: 'Línea Base en Reposo',
        time: '5 min supino + 3 min sentado',
        action:
          'El astronauta se recuesta en posición supina durante 5 minutos; al final se mide la PA basal supina. Luego pasa a posición sentada durante 3 minutos y se registra la PA basal sentada.',
      },
      {
        step: 3,
        phase: 'Medición Activa (CEVIS)',
        time: 'Durante protocolo de pedaleo',
        action:
          'El CMO o el sistema automatizado toma lecturas periódicas de presión arterial en cada escalón de carga mientras el tripulante pedalea en el cicloergómetro.',
      },
      {
        step: 4,
        phase: 'Fase de Recuperación',
        time: 'Mínimo primeros 5 min post-esfuerzo',
        action:
          'Tras concluir el pedaleo, se debe continuar tomando la presión arterial de forma obligatoria durante al menos los primeros 5 minutos de la fase de enfriamiento.',
      },
    ],
    dataClosure: {
      hardware: 'Retirar brazalete, sanitizar con toallitas biocidas y reempacar en el Medical Diagnostic Pack.',
      data: 'Cargar curvas de presión arterial (sistólica/diastólica) en la sesión del software médico en la SSC.',
    },
  },
  {
    id: 'ecg',
    code: 'SOP-MED-ECG04',
    title: 'Frecuencia Cardíaca (ECG 12 Derivaciones en Reposo)',
    role: 'CMO / Técnico Médico',
    icon: Heart,
    duration: '15 min de registro ininterrumpido',
    objective:
      'Registro electrocardiográfico de 12 derivaciones en reposo para análisis electrofisiológico cardíaco de alta fidelidad, detección de arritmias y monitoreo de remodelado cardiovascular.',
    equipment: [
      'Electrocardiógrafo clínico de 12 derivaciones para uso espacial.',
      'Cable troncal de paciente y latiguillos numerados.',
      '10 electrodos adhesivos de cloruro de plata/gel conductivo para microgravedad.',
      'Suministros de preparación dérmica (toallitas abrasivas y desengrasantes).',
      'Computadora SSC conectada a enlace satelital Ku-Band.',
    ],
    restrictions: [
      {
        rule: 'PROHIBICIÓN ESTRICTA: Cero consumo de cafeína y alcohol durante las 12 horas previas a la prueba de ECG en reposo.',
        isNoGo: true,
      },
      {
        rule: 'No aplicar lociones, emolientes ni cremas corporales en el torso ese día (afecta la adherencia de electrodos).',
        isNoGo: true,
      },
    ],
    sop: [
      {
        step: 1,
        phase: 'Preparación Cutánea y Colocación',
        action:
          'El CMO o técnico limpia y desengrasa la piel del torso y extremidades con suministros de preparación. Coloca los 10 electrodos (4 miembros y 6 precordiales V1-V6) y conecta los latiguillos.',
      },
      {
        step: 2,
        phase: 'Posicionamiento del Astronauta',
        action:
          'El astronauta debe adoptar y mantener una posición supina (recostado) completamente inmóvil, evitando hablar o tensar extremidades para prevenir artefactos musculares.',
      },
      {
        step: 3,
        phase: 'Registro Continuo',
        time: '15 minutos exactos',
        action:
          'La máquina de electrocardiograma adquiere y graba de manera continua el trazado de la actividad cardíaca de 12 derivaciones durante un periodo cronometrado de 15 minutos exactos.',
      },
      {
        step: 4,
        phase: 'Transmisión Telemétrica a Tierra',
        time: 'Ventana máxima de 24 horas',
        action:
          'Exportar los datos crudos (raw data) generados en la SSC y transmitirlos vía enlace Ku-Band para su ingestión en el sistema PACS de los cirujanos y cardiólogos de la NASA en un lapso no mayor a 24 horas.',
      },
    ],
    dataClosure: {
      samples: 'Desprender los 10 electrodos y desecharlos en bolsa de biohazard.',
      hardware: 'Enrollar con cuidado los cables sin torceduras. Guardar electrocardiógrafo en su contenedor acolchado.',
      data: 'Confirmación de paquete transmitido e ingestión exitosa en el PACS del centro de control en Tierra.',
    },
  },
  {
    id: 'glucose',
    code: 'SOP-MED-BLD05',
    title: 'Glucosa y Química Sanguínea (Blood Chemistry / MO-10)',
    role: 'Oficial Médico (CMO)',
    icon: Droplet,
    duration: '10 min para flebotomía de rutina',
    objective:
      'Extracción venosa y análisis metabólico cuantitativo de glucosa, electrolitos (sodio, potasio) y equilibrio ácido-base, ya sea de forma inmediata a bordo o preservado para análisis en Tierra.',
    equipment: [
      'HRF Supply Kit (Human Research Facility - kits morado y verde).',
      'Tubos colectores de sangre al vacío (Vacutainers: EDTA, Heparina, Suero).',
      'Agujas mariposa con sistema de seguridad venosa.',
      'Torniquete elástico para microgravedad, gasas y toallitas biocidas.',
      'Analizador clínico portátil i-Stat y cartuchos multiparámetro.',
      'Centrífuga de investigación humana (HRF Centrifuge) con adaptadores de tubos (Vial Adapters).',
      'Bolsas de biocontención para fluidos biológicos.',
      'Armarios congeladores científicos MELFI (-80 °C).',
    ],
    restrictions: [
      {
        rule: 'Para analíticas estándar programadas (Blood Chemistry / MO-10), cumplir estrictamente las horas de ayuno dictaminadas por el cirujano de vuelo.',
        isNoGo: true,
      },
      {
        rule: 'En situaciones críticas o pruebas inmediatas post-aterrizaje no se exige ayuno previo.',
        isNoGo: false,
      },
    ],
    sop: [
      {
        step: 1,
        phase: 'Alistamiento de Suministros (CMO)',
        action:
          'El CMO extrae del HRF Supply Kit (kits morado y verde) los tubos Vacutainer prescritos (EDTA, Heparina o Suero), agujas mariposa, torniquete, toallitas biocidas y gasas.',
      },
      {
        step: 2,
        phase: 'Flebotomía y Extracción',
        time: 'Máximo 10 minutos',
        action:
          'El CMO ubica la vena antecubital, aplica el torniquete, desinfecta con toallita biocida y realiza la punción. El protocolo oficial destina exactamente 10 minutos para la recolección de sangre de rutina.',
      },
      {
        step: 3,
        phase: 'Análisis Inmediato en Vuelo (i-Stat)',
        action:
          'Para obtención de lecturas instantáneas o en situaciones de emergencia, inocular una alícuota en el analizador clínico compacto portátil i-Stat para leer glucosa, sodio, potasio y pH de inmediato.',
      },
      {
        step: 4,
        phase: 'Centrifugación y Congelación (Muestras Terrestres)',
        action:
          'Si las muestras son para evaluación histórica en Tierra, colocar los tubos en los adaptadores porta-tubos (Vial Adapters) y centrifugarlos en la HRF Centrifuge. Luego empacar en bolsas de biocontención.',
      },
    ],
    dataClosure: {
      samples:
        'Transferir de inmediato las muestras centrifugadas a los congeladores MELFI (-80 °C) manteniendo la cadena de frío hasta el retorno a la Tierra. Desechar agujas en Sharps Container.',
      hardware: 'Limpiar la centrífuga y desinfectar el área de trabajo con toallitas biocidas.',
      data: 'Registrar valores del i-Stat en la SSC y asentar números de lote de tubos y ubicación de alícuotas en el inventario MELFI.',
    },
  },
];

export function Guide() {
  const history = useHistory();
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const startCheckin = () => {
    history.push({ pathname: CHECKIN_PATH, state: { autostart: true } });
  };

  const filteredProtocols = CLINICAL_PROTOCOLS.filter((proto) => {
    const matchesFilter = selectedProtocolId === 'all' || proto.id === selectedProtocolId;
    const matchesSearch =
      searchQuery.trim() === '' ||
      proto.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proto.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proto.objective.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-content flex-col gap-xl px-page pb-dockClearance pt-xl">
        {/* Cabecera de la Guía Oficial */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                <BookOpen className="h-3.5 w-3.5" />
                NASA / ISS MEDICAL OPERATIONS MANUAL
              </span>
              <span className="text-xs text-slate-400">Rev. 2026.4</span>
            </div>
            <h1 className="text-title font-bold text-ink mt-1">Guía Operativa Médica Oficial (CMO)</h1>
            <p className="text-small text-ink-secondary">
              Procedimientos Operativos Estandarizados (SOP) y Criterios Go / No-Go a bordo de la Estación Espacial Internacional.
            </p>
          </div>

          <Link to={HOME_PATH} className="inline-flex items-center gap-1.5 text-small font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Volver a Hoy
          </Link>
        </header>

        {/* Buscador y Pestañas de Selección */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Selector de Protocolo */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedProtocolId('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedProtocolId === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({CLINICAL_PROTOCOLS.length})
            </button>
            {CLINICAL_PROTOCOLS.map((proto) => {
              const Icon = proto.icon;
              return (
                <button
                  key={proto.id}
                  onClick={() => setSelectedProtocolId(proto.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    selectedProtocolId === proto.id
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {proto.title.split('(')[0].trim()}
                </button>
              );
            })}
          </div>

          {/* Campo de búsqueda rápida */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el manual..."
              className="w-full px-3 py-1.5 pl-9 rounded-xl text-xs bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <BookOpen className="h-4 w-4 text-slate-400 absolute left-3 top-2 pointer-events-none" />
          </div>
        </div>

        {/* Lista de Protocolos Operativos */}
        <div className="flex flex-col gap-8">
          {filteredProtocols.map((proto) => {
            const Icon = proto.icon;
            return (
              <Card key={proto.id} className="flex flex-col gap-6 p-6">
                {/* Encabezado del Parámetro */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 shrink-0 mt-0.5">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {proto.code}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          Responsable: <strong className="text-slate-700">{proto.role}</strong>
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-800 mt-1">{proto.title}</h2>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600 shrink-0">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>{proto.duration}</span>
                  </div>
                </div>

                {/* 1. Objetivo de la Medición */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Objetivo de la Medición
                  </h3>
                  <p className="text-small text-slate-700 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                    {proto.objective}
                  </p>
                </section>

                {/* 2. Equipamiento Requerido */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-indigo-600" />
                    Equipamiento Requerido
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-small text-slate-700">
                    {proto.equipment.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                        <span className="text-xs">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* 3. Restricciones y Preparación Previa (Puntos de control Go/No-Go) */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                    Restricciones y Preparación Previa (Puntos de Control Go / No-Go)
                  </h3>
                  <div className="flex flex-col gap-2">
                    {proto.restrictions.map((restr, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                          restr.isNoGo
                            ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                            : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                            restr.isNoGo ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {restr.isNoGo ? 'NO-GO' : 'GO'}
                        </span>
                        <span className="leading-relaxed font-medium">{restr.rule}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 4. Procedimiento Operativo Estandarizado (SOP) */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Procedimiento Operativo Estandarizado (SOP) Paso a Paso
                  </h3>
                  <ol className="flex flex-col gap-2.5 mt-1">
                    {proto.sop.map((sopStep) => (
                      <li
                        key={sopStep.step}
                        className="flex flex-col sm:flex-row sm:items-start gap-3 p-3.5 rounded-xl bg-slate-50/90 border border-slate-100"
                      >
                        <div className="flex items-center gap-2 sm:w-48 shrink-0">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                            {sopStep.step}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{sopStep.phase}</span>
                          {sopStep.time && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                              {sopStep.time}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed flex-1">{sopStep.action}</p>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* 5. Manejo de Datos y Cierre */}
                <section className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-purple-600" />
                    Manejo de Datos y Cierre Operativo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {proto.dataClosure.samples && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
                        <strong className="text-slate-800 font-semibold flex items-center gap-1">
                          <Droplet className="h-3.5 w-3.5 text-rose-500" /> Muestras / Desechos:
                        </strong>
                        <span className="text-slate-600 leading-relaxed">{proto.dataClosure.samples}</span>
                      </div>
                    )}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
                      <strong className="text-slate-800 font-semibold flex items-center gap-1">
                        <Wrench className="h-3.5 w-3.5 text-blue-500" /> Hardware y Estiba:
                      </strong>
                      <span className="text-slate-600 leading-relaxed">{proto.dataClosure.hardware}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
                      <strong className="text-slate-800 font-semibold flex items-center gap-1">
                        <Database className="h-3.5 w-3.5 text-purple-500" /> Telemetría y Downlink:
                      </strong>
                      <span className="text-slate-600 leading-relaxed">{proto.dataClosure.data}</span>
                    </div>
                  </div>
                </section>
              </Card>
            );
          })}
        </div>
      </div>

      <BottomNav active="guide" onVita={startCheckin} />
    </main>
  );
}
