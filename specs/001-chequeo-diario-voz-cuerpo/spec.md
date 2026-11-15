# Feature Specification: Base Vital — Chequeo diario por voz con cuerpo 3D v0

**Feature Branch**: `001-chequeo-diario-voz-cuerpo`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Usa la sección 2 de base-vital-speckit.md (Spec v0: Chequeo diario por voz con cuerpo 3D) como especificación completa, sin cambiar sus reglas de negocio, criterios de aceptación ni preguntas abiertas. Nombre corto de la funcionalidad: 001-chequeo-diario-voz-cuerpo. Escribe spec.md en español (es un documento de producto, no técnico)."

## Objetivo y contexto de negocio

En una base lunar, la ayuda médica está a unos tres días de viaje. La pregunta diaria no es "¿cómo
estoy?", sino "¿esto puede esperar?". Cada mañana, Ana toca "Vita" en la tablet de la base y, en menos
de un minuto y sin escribir nada, responde por voz cuánto durmió y cómo se siente; la app toma sus
signos de los equipos de la estación, le muestra en un cuerpo 3D qué zona está alterada y le dice qué
hacer hoy.

**Éxito**: el chequeo se completa en 60 segundos o menos y la persona entiende su estado sin leer
números.

### Usuarios

- **Astronauta (Ana)**: usa la app a diario, cansada o con prisa; no es médica; quiere saber qué hacer.
- **Cirujano de vuelo (en la Tierra)**: no usa la pantalla del astronauta; recibe después el resumen y
  decide si hay que consultar o preparar el regreso.
- **Jurado del reto**: ve el demo y necesita entender en segundos qué hace y por qué es confiable.

"Vita" es el nombre provisional del asistente de voz.

## Clarifications

### Session 2026-11-14

- Q: ¿Qué fuente tiene el umbral de oxígeno? (PA1) → A: Guía de oximetría de pulso de la OMS (WHO
  Pulse Oximetry Training Manual): ≥ 95 % bien, 90–94 % atención, < 90 % alerta; fuente por verificar
  contra el documento original antes del demo.
- Q: ¿La cámara forma parte de esta funcionalidad? → A: No. Se quita "cámara" de las fuentes de RF11
  y CL4 pasa a usar el pulso fuera de "tu normal" en lugar de la cámara.
- Q: ¿Qué síntomas cuentan para la alerta de pulso "< 50 con síntomas"? → A: Mareo, desmayo, dolor de
  pecho o falta de aire, dichos por voz en la pregunta de síntomas. Pulso < 50 sin esos síntomas =
  atención.
- Q: ¿El chequeo se inicia solo a una hora fija o con un toque? (PA2) → A: Siempre con un toque; la
  agenda lo muestra como "Lo próximo" a su hora.
- Q: ¿"Vita" es el nombre final del asistente? (PA3) → A: Es el nombre provisional.
- Q: ¿La temperatura es corporal simulada o de piel del brazalete? (PA4) → A: Temperatura corporal
  simulada; la temperatura de piel del brazalete no se usa en esta versión.
- Q: ¿Se pregunta la calidad del sueño o solo las horas? (PA5) → A: Solo las horas de sueño.
- Q: ¿Qué fuente citamos para los umbrales de temperatura y de ánimo? (RN1) → A: Temperatura: fuentes
  por umbral (ver la pregunta "¿Qué fuente tiene cada umbral de temperatura?"). Ánimo: "criterio del
  equipo, no clínico", declarado en la app (admitido por la constitución v1.1.0, principio VIII).
- Q: Si un sensor queda "sin dato" y todo lo demás está en verde, ¿qué veredicto da la app? (CL2) →
  A: Atención, con la acción "Falta el dato de [sensor]: repite la medida".
- Q: En el demo, ¿de dónde salen los 14 días que necesita "tu normal"? (RN3) → A: 14 días de historia
  simulada precargada a partir de datos abiertos, marcada como simulada en el historial.
- Q: ¿Cómo queda un ánimo ≤ 2 en un solo día o un sueño < 6 h dos noches seguidas? (RN1, RN2) → A:
  Atención, hasta que se cumplan los días seguidos que exige la alerta (3 noches de sueño, 2 días de
  ánimo).
- Q: ¿Cómo se evita que un color de sensor se confunda con un color de estado? (RN6) → A: Los colores
  de sensor se eligen lejos de ámbar, rojo y verde; "bien" no lleva anillo; solo el sensor alterado
  lleva anillo de color de estado (atención = ámbar, alerta = rojo), siempre con su etiqueta.
- Q: ¿Qué pasa con una temperatura menor de 36,1 °C? (RN1) → A: Entre 35,0 y 36,0 °C el dato queda
  "en duda" y se vuelve a medir; bajo 35,0 °C = alerta (hipotermia; fuente por verificar antes del
  demo).
- Q: ¿Se aceptan las reglas por defecto del plan (R10)? → A: Sí: "dos ámbar" solo cuenta valores en
  ámbar (no "en duda" ni "sin dato"); "tu normal" queda fija tras el día 14; en CL4 se vuelve a
  preguntar el ánimo una sola vez.
- Q: ¿Qué fuente tiene cada umbral de temperatura? (RN1) → A: Fiebre ≥ 38,0 °C → CDC; normal
  36,1–37,2 °C → MedlinePlus; hipotermia < 35,0 °C → definición clínica estándar (Mayo Clinic). Todas
  por verificar; si la fuente verificada da otro valor, se corrige el valor en la spec.
- Q: ¿Los síntomas cambian el veredicto por sí solos? (RN5) → A: Sí: cualquiera de los 4 síntomas
  (mareo, desmayo, dolor de pecho, falta de aire) da como mínimo "atención".
- Q: ¿"Dos ámbar a la vez" cuenta valores o sensores? (RN5) → A: Valores. Sueño 5 h y ánimo 3 son dos
  ámbar aunque estén en el mismo punto.
- Q: ¿Qué dice la etiqueta de un punto alterado? (RN6) → A: El motivo y el estado, por ejemplo
  "Ánimo · atención" o "Sueño · atención".
- Q: ¿Cómo se prueban los casos límite sin conocimientos técnicos? → A: Con un selector visible
  "Escenario de demo" (normal, CA4, sensor sin dato, temperatura baja, voz no entendida).
- Q: ¿Cómo se garantiza que CA4 salga igual en cada demo? → A: Escenario determinista: signos
  simulados dentro del verde y las dos noches anteriores precargadas con 7 h o más.
- Q: ¿Cómo se muestra "criterio del equipo, no clínico" donde aparece el ánimo? → A: En la etiqueta
  del punto y en el historial, una marca corta ("Ánimo · atención*") con la nota "* criterio del
  equipo, no clínico" una sola vez por pantalla. En el panel de veredicto, la nota completa cuando la
  acción viene del ánimo.
- Q: ¿Puede "tu normal" tener desviación 0? → A: No. La historia precargada tiene una variación
  pequeña y realista, y cada medida tiene una desviación mínima.
- Q: ¿Qué pasa con el historial al cambiar de escenario de demo? → A: Se reinicia, y el selector lo
  avisa antes de cambiar.

### Session 2026-11-15

- Q: ¿Qué muestra la pantalla de inicio? → A: La de `docs/base-vital-ui-build-spec.md` con los datos
  de `docs/base-vital-home-data-mapping.md`: saludo con día de misión y fase de luz, estado de
  conexión, "Ahora" y "Después" de la agenda, el estado del último chequeo (veredicto, ánimo, cuerpo
  3D y una fila por medida con barra de rango) y la leyenda al pie (FR-014 a FR-019).
- Q: ¿Se usa un servidor en esta funcionalidad? → A: No. La constitución 1.2.0 admite un servidor
  solo fuera del camino crítico del astronauta; la sincronización y la vista del cirujano quedan
  para `004-resumen-cirujano`.
- Q: ¿Qué valores usa cada escenario de demo? → A: Los de la sección 4 del mapeo de datos; en
  "Sensor sin dato" falta la presión.
- Q: ¿Qué actividad va a las 13:00 en la agenda de demo? → A: "Experimento de biología ·
  laboratorio" (no "Vitamina D": la app no muestra ni recomienda medicamentos).
- Q: ¿Qué fuente tienen los rangos de pulso fuera de 60–100 y la regla de sueño de 3 noches? → A: Se
  declaran "criterio del equipo, no clínico". Un resultado que sale de esos rangos lleva la marca
  "*" y la nota, como el ánimo.

## User Scenarios & Testing *(mandatory)*

Las historias conservan su identificador original (HU1–HU6). La prioridad indica el orden en que
aportan valor al demo; cada una se puede probar por separado.

### User Story 1 - Chequeo diario hablando (HU1) (Priority: P1)

Como astronauta, quiero hacer mi chequeo diario hablando, para no tener que escribir nada.

**Why this priority**: es el núcleo del demo; sin el chequeo por voz no hay funcionalidad.

**Independent Test**: tocar "Vita", responder las tres preguntas en voz alta y llegar al final del
chequeo sin tocar el teclado.

**Acceptance Scenarios**:

1. **Given** la app abierta, **When** Ana toca "Vita" una vez, **Then** comienza el chequeo y Vita
   hace en voz alta la primera pregunta (horas de sueño).
2. **Given** el chequeo en curso, **When** Ana responde cada pregunta por voz, **Then** Vita pasa a
   la siguiente, una a la vez: sueño, ánimo del 1 al 5 y síntomas.
3. **Given** el chequeo en curso, **When** Ana pide por voz detener o repetir la pregunta, **Then**
   Vita se detiene o la repite.
4. **Given** el wifi apagado, **When** Ana hace el chequeo completo, **Then** funciona igual (CA6).

---

### User Story 2 - Confirmar lo que entendió (HU2) (Priority: P1)

Como astronauta, quiero que la app repita lo que entendió antes de guardarlo, para no registrar un
dato equivocado.

**Why this priority**: lo exige el principio IX de la constitución; sin confirmación no se registra
nada.

**Independent Test**: decir "cinco horas" y comprobar que la app pide confirmación antes de guardar.

**Acceptance Scenarios**:

1. **Given** la pregunta de sueño, **When** Ana dice "cinco horas", **Then** la app responde
   "Escuché 5 horas. ¿Correcto?" antes de guardar (CA2).
2. **Given** la pregunta de sueño, **When** Ana dice "dormí 20 horas", **Then** la app no alarma y
   pregunta otra vez (RN4).
3. **Given** cualquier pregunta, **When** la app no entiende la voz dos veces seguidas, **Then**
   muestra botones grandes con las opciones (CL1).

---

### User Story 3 - Cuerpo 3D con sensores (HU3) (Priority: P2)

Como astronauta, quiero ver en un cuerpo 3D qué sensor corresponde a cada parte del cuerpo y cuál
está alterado, para entender mi estado de un vistazo.

**Why this priority**: es lo que hace entendible el estado sin leer números; es la parte visual del
demo.

**Independent Test**: abrir el cuerpo 3D, girarlo y comprobar que cada punto sigue sobre su zona y
que el sensor del que se habla está resaltado.

**Acceptance Scenarios**:

1. **Given** el cuerpo 3D visible, **When** Ana lo gira, **Then** cada punto sigue sobre su zona
   (CA5).
2. **Given** el chequeo en curso, **When** Vita pregunta por el sueño, **Then** el punto de la frente
   está resaltado (CA3).
3. **Given** sueño de 5 h, **When** termina el chequeo, **Then** el punto de sueño queda en atención
   y el veredicto es "atención" (CA4).
4. **Given** que el 3D no carga, **When** se muestra el estado, **Then** aparece una imagen del mismo
   cuerpo con los mismos puntos (CL5).

---

### User Story 4 - Medida contra rango y contra "tu normal" (HU4) (Priority: P2)

Como astronauta, quiero ver cada medida contra su rango permitido y contra mi normal, para saber si
algo es raro para mí aunque esté dentro de la guía.

**Why this priority**: da el contexto personal que distingue a Base Vital de una lectura aislada.

**Independent Test**: revisar cualquier medida y comprobar que muestra su valor, la barra del rango
permitido y la marca de "tu normal".

**Acceptance Scenarios**:

1. **Given** un chequeo terminado, **When** Ana mira una medida, **Then** ve su rango permitido y
   dónde cae el valor de hoy (CA7).
2. **Given** pulso habitual 62 ± 3, **When** hay tres lecturas seguidas de 72, **Then** el pulso pasa
   a atención aunque esté en rango (RN3).
3. **Given** uno de los primeros 14 días, **When** Ana mira sus medidas, **Then** solo se usan los
   rangos y la app dice "Aún aprendo tu normal" (CL3).

---

### User Story 5 - Qué hacer hoy (HU5) (Priority: P1)

Como astronauta, quiero que al final me digan qué hacer hoy y qué sigue en mi día, para actuar sin
pensar de más.

**Why this priority**: responde la pregunta central ("¿esto puede esperar?").

**Independent Test**: terminar un chequeo y comprobar que aparece un veredicto con una sola acción y
la próxima actividad del día.

**Acceptance Scenarios**:

1. **Given** sueño 5 h y todo lo demás bien, **When** termina el chequeo, **Then** el veredicto es
   atención con la acción "Dormiste poco: tómalo con calma" (RN5).
2. **Given** un chequeo terminado, **When** se muestra el veredicto, **Then** se muestra también la
   próxima actividad del día.

---

### User Story 6 - Historial con origen (HU6) (Priority: P3)

Como cirujano de vuelo, quiero que cada chequeo quede guardado con su origen, para revisar la
historia de la persona.

**Why this priority**: necesario para la trazabilidad, pero el envío al cirujano queda fuera de esta
versión.

**Independent Test**: terminar un chequeo y abrir el historial.

**Acceptance Scenarios**:

1. **Given** un chequeo terminado, **When** se abre el historial, **Then** el chequeo aparece
   guardado (CA8) con la fuente de cada dato (voz, equipo).

---

### Edge Cases

- **CL1.** ¿Y si no entiende la voz dos veces seguidas? → muestra botones grandes con las opciones.
- **CL2.** ¿Y si un equipo no envía su dato? → ese sensor queda "sin dato" en gris y no cuenta para el
  veredicto, pero el veredicto nunca puede ser "bien" con un sensor sin dato. Si todo lo demás está
  en verde, el veredicto es atención con la acción "Falta el dato de [sensor]: repite la medida".
- **CL3.** ¿Y si es uno de los primeros 14 días? → no hay "tu normal" todavía; se usan solo los rangos
  y se dice "Aún aprendo tu normal".
- **CL4.** ¿Y si dice "me siento bien" pero su pulso está fuera de su normal? → el dato queda
  "en duda" y Vita pregunta otra vez.
- **CL5.** ¿Y si el 3D no carga? → se muestra una imagen del mismo cuerpo con los mismos puntos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (RF1)**: El sistema debe permitir iniciar el chequeo diario con un solo toque. El chequeo
  siempre se inicia con un toque, nunca solo; la agenda lo muestra como "Lo próximo" a su hora.
- **FR-002 (RF2)**: El sistema debe hacer las preguntas en voz alta, una a la vez: horas de sueño
  (solo las horas, no la calidad), ánimo del 1 al 5 y síntomas.
- **FR-003 (RF3)**: El sistema debe entender respuestas habladas en español, incluidos números dichos
  con palabras.
- **FR-004 (RF4)**: El sistema debe repetir cada número entendido y pedir confirmación antes de
  guardarlo.
- **FR-005 (RF5)**: El sistema debe tomar presión arterial, pulso en reposo, saturación de oxígeno y
  temperatura corporal de los equipos de la estación, sin que la persona los escriba. La temperatura
  corporal es simulada.
- **FR-006 (RF6)**: El sistema debe mostrar un cuerpo humano en 3D que se puede girar, con un punto de
  color en la zona de cada sensor: sueño en la frente, pulso en el pecho, presión en el brazo,
  temperatura en el abdomen y oxígeno en la punta del dedo.
- **FR-007 (RF7)**: El sistema debe resaltar en el cuerpo el sensor del que se está hablando en cada
  momento.
- **FR-008 (RF8)**: El sistema debe mostrar cada medida con su valor, una barra con su rango permitido
  y la marca de "tu normal".
- **FR-009 (RF9)**: El sistema debe dar un veredicto del día (bien / atención / alerta) con una sola
  acción concreta.
- **FR-010 (RF10)**: El sistema debe mostrar la próxima actividad del día al terminar.
- **FR-011 (RF11)**: El sistema debe guardar cada chequeo con la fuente de cada dato (voz, equipo).
- **FR-012 (RF12)**: El sistema debe permitir detener o repetir la pregunta en cualquier momento por
  voz, y ofrecer botones grandes si no entiende la voz.
- **FR-013**: El sistema debe ofrecer un selector visible "Escenario de demo" (normal, CA4, sensor sin
  dato, temperatura baja, voz no entendida) que fija valores deterministas, para probar los casos
  límite sin URL ni configuración técnica. En los escenarios "normal" y "CA4", los signos simulados
  están dentro del verde y las dos noches anteriores tienen 7 h o más. Cambiar de escenario reinicia
  el historial (vuelve a precargar los 14 días simulados), y el selector lo avisa antes de cambiar.
  En "Sensor sin dato" falta la presión arterial.
- **FR-014**: La pantalla de inicio debe mostrar "Hola, {nombre}", el día de misión y la fase de luz
  lunar (por ejemplo "Día 23 · Luz 9/14", calculados a partir de la fecha de inicio de la misión), el
  estado de conexión ("Sin internet · todo funciona" sin conexión, "Conectado" con conexión) y un
  avatar genérico (sin rostro real).
- **FR-015**: La pantalla de inicio debe mostrar "Ahora" (la actividad actual de la agenda con su
  hora, su duración, el progreso del día y un botón "Empezar" que inicia el chequeo) y "Después"
  (como máximo 2 actividades siguientes), junto con el número de actividades pendientes hoy.
- **FR-016**: La pantalla de inicio debe mostrar el estado del último chequeo: un encabezado "Estado
  de {nombre}" con "Hoy: {veredicto}" (o "Sin chequeo hoy") y "Ánimo {n}/5*", el cuerpo 3D y una
  fila por medida con su barra de rango. El estado ("Atención", por ejemplo) aparece una sola vez en
  el encabezado; la leyenda y la nota "* Ánimo: criterio del equipo, no clínico" van al pie de la
  tarjeta.
- **FR-017**: Tocar un punto del cuerpo debe resaltar la fila de su medida.
- **FR-018**: Las pestañas Salud, Agenda y Guía deben verse pero estar desactivadas, con el texto
  "Próximamente".
- **FR-019**: Las fuentes, los íconos, el logo, el avatar y las imágenes deben estar dentro de la
  app; ningún recurso se carga de internet.

### Business Rules (Reglas de negocio)

- **RN1. Rangos (bien / atención / alerta):**
  - presión < 120/80 · 120–139 u 80–89 · ≥ 140 o ≥ 90 (AHA/ACC 2025).
  - pulso en reposo 60–100 · 50–59 o 101–110 · < 50 con síntomas o > 110 (60–100: AHA; los rangos
    50–59, 101–110, > 110 y < 50 con síntomas: criterio del equipo, no clínico).
    Síntomas que cuentan: mareo, desmayo, dolor de pecho o falta de aire, dichos por voz en la
    pregunta de síntomas. Pulso < 50 sin esos síntomas = atención.
  - temperatura 36,1–37,2 (normal: MedlinePlus) · 37,3–37,9 (entre el normal de MedlinePlus y la
    fiebre de CDC) · ≥ 38,0 °C (fiebre: CDC). Temperatura baja: 35,0–36,0 °C → "en duda" y se vuelve
    a medir (probable error de medición, como RN4); < 35,0 °C → alerta (hipotermia: definición
    clínica estándar, Mayo Clinic). Todas por verificar; si la fuente verificada da otro valor, se
    corrige el valor aquí.
  - oxígeno ≥ 95 % · 90–94 % · < 90 % (OMS, WHO Pulse Oximetry Training Manual; por verificar
    contra el documento original antes del demo).
  - sueño ≥ 7 h · 6–6,9 h · < 6 h durante 3 noches seguidas (≥ 7 h: AASM/SRS; la regla de < 6 h
    durante 3 noches seguidas: criterio del equipo, no clínico).
  - ánimo 4–5 · 3 · ≤ 2 durante 2 días seguidos (criterio del equipo, no clínico; la app lo
    declara).
  - Ejemplo: presión 128/76 → atención.
- **RN2.** Una sola noche con menos de 6 h es atención, no alerta.
  Ejemplo: Ana durmió 5 h hoy y 7 h ayer → atención.
  Lo mismo vale mientras no se cumplan los días seguidos que exige la alerta: sueño < 6 h en 1 o 2
  noches seguidas → atención; ánimo ≤ 2 en un solo día → atención.
- **RN3.** "Tu normal" = el promedio de los primeros 14 días de la persona. Si un valor se aleja más
  de 2 desviaciones estándar durante 3 lecturas seguidas, pasa a atención aunque esté en rango.
  Ejemplo: pulso habitual 62 ± 3; tres lecturas de 72 → atención.
  La desviación nunca es 0: cada medida tiene una desviación mínima, y se usa la mayor entre la
  calculada y la mínima.
  En el demo, los 14 días salen de una historia simulada precargada a partir de datos abiertos,
  marcada como simulada en el historial.
- **RN4.** Valores imposibles no alarman: se piden de nuevo.
  Ejemplo: "dormí 20 horas" → la app pregunta otra vez.
- **RN5.** Veredicto: bien = todo en verde y dentro de tu normal; atención = un ámbar, un valor fuera
  de tu normal, un dato en duda, un sensor sin dato o cualquiera de los 4 síntomas (mareo, desmayo,
  dolor de pecho, falta de aire); alerta = un rojo confirmado, fiebre o dos valores en ámbar a la vez
  (se cuentan valores, no sensores: sueño 5 h y ánimo 3 son dos ámbar).
  Ejemplo: sueño 5 h y todo lo demás bien → atención: "Dormiste poco: tómalo con calma".
- **RN6.** El color de un punto dice qué sensor es; la etiqueta (bien / atención / alerta) dice si
  está bien. Un mismo color nunca significa las dos cosas. Los colores de sensor no se parecen a
  ámbar, rojo ni verde. "Bien" no lleva anillo; solo el sensor alterado lleva un anillo de color de
  estado (atención = ámbar, alerta = rojo), siempre acompañado de su etiqueta. La etiqueta dice el
  motivo y el estado, por ejemplo "Ánimo · atención*" o "Sueño · atención". El asterisco marca un
  criterio del equipo; la nota "* criterio del equipo, no clínico" aparece una vez por pantalla.
  El número de una medida se escribe siempre en color neutro; solo la etiqueta, el anillo y la zona
  de la barra llevan color de estado. La etiqueta "Bien" va en gris azulado, sin color de alarma.

### Key Entities *(include if feature involves data)*

- **Chequeo diario**: un registro por sesión; fecha y hora, respuestas confirmadas, medidas tomadas,
  veredicto, acción del día y próxima actividad.
- **Medida**: un valor de un sensor (sueño, ánimo, pulso, presión, temperatura, oxígeno); incluye su
  fuente (voz, equipo), su estado (bien / atención / alerta / sin dato / en duda) y si fue
  confirmada.
- **Sensor**: la zona del cuerpo a la que pertenece (frente, pecho, brazo, abdomen, punta del dedo) y
  su color de identificación (distinto de los colores de estado, RN6).
- **Rango**: los límites bien / atención / alerta de una medida, con su fuente citada o declarado
  como "criterio del equipo, no clínico" (ánimo).
- **Tu normal**: promedio y desviación de los primeros 14 días de la persona para cada medida.
- **Veredicto**: bien / atención / alerta, con una sola acción concreta.
- **Escenario de demo**: un conjunto fijo de valores de equipo, historia previa y comportamiento de la
  voz, elegido desde el selector (FR-013).
- **Perfil de misión**: nombre de la tripulante, fecha de inicio de la misión y avatar genérico; de
  ahí salen el día de misión y la fase de luz (FR-014).
- **Vista de inicio**: todo lo que muestra la pantalla de inicio en un solo objeto (encabezado,
  ahora, después, pendientes y estado del último chequeo), armado a partir de la agenda, el último
  chequeo y la conexión.

## Success Criteria *(mandatory)*

Criterios de aceptación originales (CA1–CA8), verificables sin código usando la app.

### Measurable Outcomes

- **SC-001 (CA1)**: Con un toque en Vita, el chequeo diario termina en 60 segundos o menos.
- **SC-002 (CA2)**: Al decir "cinco horas", la app responde "Escuché 5 horas. ¿Correcto?" antes de
  guardar.
- **SC-003 (CA3)**: Mientras Vita pregunta por el sueño, el punto de la frente está resaltado.
- **SC-004 (CA4)**: Con sueño de 5 h, el punto de sueño queda en atención y el veredicto es
  "atención".
- **SC-005 (CA5)**: Al girar el cuerpo, cada punto sigue sobre su zona.
- **SC-006 (CA6)**: Con el wifi apagado, el chequeo completo funciona igual.
- **SC-007 (CA7)**: Cada medida muestra su rango permitido y dónde cae el valor de hoy.
- **SC-008 (CA8)**: El chequeo aparece guardado en el historial al terminar.
- **SC-009**: Con el cable de red desconectado, la pantalla de inicio carga con el logo, el cuerpo y
  los íconos, sin imágenes rotas.
- **SC-010**: En el encabezado del estado, "Atención" aparece una sola vez; la leyenda está al pie.
- **SC-011**: Con el escenario "CA4", la pantalla de inicio muestra "Sueño 5 h · Atención" y
  "Hoy: Atención".
- **SC-012**: Tocar un punto del cuerpo resalta su fila de medida.
- **SC-013**: Cada marca de las barras de rango está sobre su valor (por ejemplo, 118 entre 90 y
  120).

## Out of Scope (Fuera de alcance)

- No diagnostica ni recomienda medicamentos.
- No envía nada al cirujano de vuelo en esta versión (va en otra funcionalidad).
- No incluye el chequeo de salida al exterior, los gestos con la mano ni el cansancio por cámara
  (otra funcionalidad).
- No mide radiación.
- No usa la temperatura de piel del brazalete.
- No pregunta por la calidad del sueño, solo por las horas.
- No usa datos reales de astronautas: los equipos se simulan con datos abiertos de personas en la
  Tierra.
- No usa servidor: la sincronización y la vista del cirujano son de `004-resumen-cirujano`.
- No construye las pantallas Salud, Agenda ni Guía (sus pestañas se ven desactivadas).

## Open Questions (Preguntas abiertas)

Resueltas el 2026-11-14 (ver Clarifications).

- **PA1.** ¿Fuente oficial del umbral de oxígeno? → OMS (WHO Pulse Oximetry Training Manual), por
  verificar contra el documento original antes del demo.
- **PA2.** ¿El chequeo se inicia solo a una hora fija o siempre con un toque? → Siempre con un toque;
  la agenda lo muestra como "Lo próximo" a su hora.
- **PA3.** ¿"Vita" es el nombre final del asistente? → Nombre provisional.
- **PA4.** ¿La temperatura se simula como corporal o se muestra la de piel del brazalete como
  tendencia? → Corporal simulada; la de piel no se usa en esta versión.
- **PA5.** ¿Se pregunta también por la calidad del sueño ("bien / mal") o solo por las horas? → Solo
  las horas.

## Assumptions

- El demo usa un solo perfil de astronauta (Ana) en la tablet, con 14 días de historia simulada
  precargada; no hay cuentas.
- La agenda del día, la próxima actividad y el progreso salen de una agenda precargada de la base.
- La fecha de inicio de la misión y el nombre de la tripulante son datos fijos de configuración.
- Los equipos de la estación se simulan con datos abiertos y anonimizados, y la app lo declara
  (constitución, principios V y Prototipo).
- Las fuentes de los umbrales de oxígeno (OMS), de temperatura (MedlinePlus, CDC) y de hipotermia
  (Mayo Clinic) se verifican contra el documento original antes de programar los umbrales
  (principio VIII).
- La respuesta de síntomas se acota a una lista corta (o "ninguno") que se define en el plan e incluye
  al menos mareo, desmayo, dolor de pecho y falta de aire.
