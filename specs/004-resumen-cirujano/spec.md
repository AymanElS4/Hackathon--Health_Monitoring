# Feature Specification: Resumen para el cirujano de vuelo — sincronización y vista del cirujano

**Feature Branch**: `004-resumen-cirujano`

**Created**: 2026-11-15

**Status**: Draft

**Input**: User description: "004-resumen-cirujano — backend de sincronización y vista del cirujano de
vuelo, usando docs/base-vital-db-schema.md. Decisiones: M1 veredicto con nombres de libs/contracts;
M4 la tablet genera un UUID por chequeo como clave de idempotencia; M7 la vista del cirujano usa un
código de acceso compartido desde .env, sin tabla de usuarios ni tokens; M2, M3, M5, M6, M8, M9, M10
según la propuesta de §6 del esquema."

Fuentes: `docs/base-vital-db-schema.md` (esquema propuesto y §6), issue #5, `specs/005-despliegue/spec.md`,
constitución 1.2.0. El documento `docs/base-vital-backend-spec.md` citado en la petición no existe en el
repositorio; esta spec se basa en las otras fuentes.

## Clarifications

### Session 2026-11-15

Modo autónomo (el usuario pidió no preguntar): se tomó la opción recomendada en cada caso.

- Q: ¿Cuánto tiempo recuerda el navegador el código de acceso del cirujano? → A: Solo mientras la
  pestaña esté abierta; al cerrarla hay que escribirlo otra vez. Nada se guarda en el servidor.
- Q: ¿Qué es "el historial de los últimos 14 días" del resumen? → A: Los chequeos de los 14 días de
  calendario que terminan en el día del último chequeo del tripulante, uno por fila, del más nuevo al
  más viejo.
- Q: ¿Quién fija la unidad de cada valor, si el contrato no la trae? → A: El servidor, por indicador:
  horas (sueño), 1–5 (ánimo), lpm (pulso), mmHg (presión), °C (temperatura), % (oxígeno).
- Q: ¿Acepta el servidor chequeos simulados enviados por la tablet (el historial sembrado)? → A: Sí,
  igual que los reales; quedan marcados "simulado".
- Q: ¿Se limita el número de intentos con un código equivocado? → A: Sí: más de 10 intentos fallidos
  en un minuto desde la misma dirección se rechazan hasta que pase el minuto.

## Decisiones de entrada (§6 del esquema)

| # | Decisión |
|---|---|
| M1 | El veredicto usa los valores del contrato compartido: `ok` / `attention` / `alert`. |
| M2 | En el servidor, "sin acción" se guarda como vacío (nulo); la frontera traduce: `''` del contrato ⇔ nulo. La regla estricta se mantiene: `ok` ⇔ sin acción; `attention`/`alert` ⇔ exactamente una acción. |
| M3 | El origen de un valor es solo `voice` o `device` (como en el contrato). Una respuesta con botón grande llega como `voice` confirmada. Se quita `button`. |
| M4 | La tablet genera un identificador único (UUID) por chequeo; es la clave de idempotencia. |
| M5 | Cada chequeo y cada valor guardan si es simulado; la vista del cirujano lo muestra ("simulado"). |
| M6 | Los síntomas declarados se guardan con el chequeo y se muestran al cirujano. |
| M7 | La vista del cirujano se protege con un código de acceso compartido definido en la configuración del servidor. Sin cuentas, sin tabla de usuarios, sin tokens. |
| M8 | Solo existe el tipo de chequeo `daily`; `exit` queda reservado para 002 y no se acepta. |
| M9 | El servidor no recalcula niveles: guarda tal cual la foto de lecturas por sensor que la tablet mostró (nivel, "criterio del equipo") como registro histórico de lo que vio el astronauta. Los umbrales siguen viviendo solo en las reglas compartidas. |
| M10 | El arranque con un solo comando incluye también el frontend, solo accesible desde la misma máquina. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Levantar el servidor y comprobar su estado (Priority: P1)

Una persona del equipo copia el archivo de ejemplo de configuración, pone sus valores y ejecuta un solo
comando. Se levantan el servidor, la base de datos (con datos que sobreviven a un reinicio), el frontend
y el túnel. Al abrir la dirección de estado del servidor ve si está en marcha y si alcanza la base de
datos.

**Why this priority**: Es la base de todo lo demás y la primera entrega pedida: sin servidor y base de
datos en marcha no hay sincronización ni vista del cirujano.

**Independent Test**: Con solo Docker instalado, ejecutar el comando de arranque y abrir la dirección de
estado del servidor (en la misma máquina y por la dirección pública del túnel).

**Acceptance Scenarios**:

1. **Given** el archivo de configuración con valores, **When** la persona ejecuta el comando de arranque,
   **Then** los cuatro servicios quedan en marcha y la dirección de estado responde "en marcha" y "base de
   datos alcanzable".
2. **Given** los servicios en marcha, **When** se detiene solo la base de datos, **Then** la dirección de
   estado sigue respondiendo y dice "base de datos no alcanzable" (no se cae).
3. **Given** una base de datos vacía, **When** el servidor arranca, **Then** crea su estructura sola, y al
   volver a arrancar no la repite ni la rompe.
4. **Given** el archivo de configuración sin el código de acceso o sin la contraseña de la base, **When**
   se ejecuta el comando, **Then** el servicio afectado no arranca y su registro dice qué valor falta.

---

### User Story 2 - La tablet envía chequeos al servidor (Priority: P1)

Cuando la tablet tiene conexión, envía al servidor cada chequeo diario terminado (valores confirmados,
síntomas, lecturas por sensor, veredicto y acción). Si el mismo chequeo se envía dos veces (reintento,
conexión intermitente), el servidor lo guarda una sola vez. Sin conexión o con el servidor apagado, la
tablet funciona igual y no pierde nada.

**Why this priority**: Sin datos en el servidor no hay nada que mostrar al cirujano.

**Independent Test**: Enviar un chequeo de ejemplo al servidor dos veces con el mismo identificador y
comprobar en la vista del cirujano que aparece una sola vez.

**Acceptance Scenarios**:

1. **Given** un chequeo válido con su identificador único, **When** la tablet lo envía, **Then** el
   servidor lo guarda y responde que lo recibió.
2. **Given** un chequeo ya recibido, **When** la tablet lo reenvía con el mismo identificador, **Then**
   el servidor responde que ya lo tenía y no crea un duplicado.
3. **Given** un chequeo con un valor de voz no confirmado, o con veredicto `ok` y una acción, o
   `attention` sin acción, **When** la tablet lo envía, **Then** el servidor lo rechaza y no guarda nada.
4. **Given** un envío sin el código de la tablet o con un código equivocado, **When** llega al servidor,
   **Then** se rechaza sin guardar nada.
5. **Given** el servidor apagado, **When** el astronauta hace su chequeo, **Then** la app del astronauta
   funciona igual (constitución 1.2.0); el reintento es trabajo de la tablet (ver Dependencias).

---

### User Story 3 - El cirujano ve el resumen de cada tripulante (Priority: P2)

El cirujano de vuelo abre la vista del cirujano en el navegador, escribe el código de acceso compartido
y ve, por tripulante (seudónimo, sin nombre): el último chequeo con su día de misión, el veredicto, la
acción indicada, el estado de cada sensor tal como lo vio el astronauta, los síntomas declarados, y el
historial reciente. Los chequeos simulados se marcan "simulado" y los resultados de un criterio del
equipo se marcan "criterio del equipo, no clínico". Todo el texto está en español.

**Why this priority**: Es el valor de la funcionalidad para el cirujano, pero necesita US1 y US2.

**Independent Test**: Con chequeos de ejemplo cargados, abrir la vista del cirujano desde otra red por
la dirección pública, escribir el código y leer el resumen.

**Acceptance Scenarios**:

1. **Given** el código correcto, **When** el cirujano entra, **Then** ve la lista de tripulantes con el
   veredicto de su último chequeo, primero los que necesitan atención.
2. **Given** un código equivocado o vacío, **When** intenta entrar, **Then** ve un aviso en español y
   ningún dato.
3. **Given** un tripulante con chequeos, **When** el cirujano abre su resumen, **Then** ve el último
   chequeo completo (sensores, síntomas, veredicto, acción) y el historial de los últimos 14 días, cada
   día marcado "simulado" cuando lo es.
4. **Given** un sensor cuyo nivel vino de un criterio del equipo, **When** se muestra, **Then** aparece
   la marca "criterio del equipo, no clínico".
5. **Given** cualquier pantalla de la vista, **When** se lee, **Then** ningún texto da un diagnóstico ni
   recomienda medicación (Principio VI).

---

### User Story 4 - Cola de avisos y decisión del cirujano (Priority: P3)

Cada chequeo con veredicto `attention` o `alert` abre un aviso para el cirujano: `alert` es "ahora",
`attention` es "pronto". El cirujano ve la cola de avisos abiertos (primero "ahora", luego los más
antiguos) y registra una decisión: "manejar en la base", "consultar con el cirujano" o "preparar
regreso". Al decidir, el aviso queda cerrado con la hora de la decisión.

**Why this priority**: Cierra el ciclo, pero el resumen (US3) ya da valor sin ella.

**Independent Test**: Enviar un chequeo `alert`, ver el aviso en la cola, registrar una decisión y ver
que el aviso sale de la cola y la decisión queda en el resumen.

**Acceptance Scenarios**:

1. **Given** un chequeo `alert` recibido, **When** el cirujano abre la cola, **Then** el aviso aparece
   como "ahora" antes que los "pronto".
2. **Given** un chequeo `ok`, **When** se recibe, **Then** no se abre ningún aviso.
3. **Given** un aviso abierto, **When** el cirujano registra una decisión, **Then** el aviso se cierra y
   muestra la decisión y su hora; no se puede decidir dos veces.
4. **Given** un chequeo reenviado (US2.2), **When** llega, **Then** no se abre un segundo aviso.

---

### Edge Cases

- La base de datos se cae con el servidor en marcha: el estado lo dice; los envíos de la tablet reciben
  un error temporal (pueden reintentarse) y nada queda guardado a medias.
- Un chequeo llega con un tripulante que el servidor no conoce: se registra el tripulante (seudónimo)
  con la fecha de inicio de misión que se deduce del chequeo.
- Dos envíos simultáneos del mismo chequeo: se guarda uno solo.
- Alguien prueba códigos al azar: tras 10 intentos fallidos en un minuto, se le rechaza hasta que pase
  el minuto.
- Un chequeo con un indicador repetido o con un tipo distinto de `daily`: se rechaza entero.
- Un valor "sin dato" (sensor sin lectura): se guarda como sin dato, no como cero.
- El túnel no puede conectarse (sin internet): el servidor y la base siguen funcionando en local.
- Cualquier dato con nombre, foto, audio o transcripción: el servidor no tiene dónde guardarlo y lo
  descarta (solo acepta los campos del contrato).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Un solo comando debe levantar el servidor, la base de datos, el frontend y el túnel; la
  base de datos conserva sus datos entre reinicios.
- **FR-002**: Solo el servidor puede ser alcanzable desde fuera, y solo por el túnel con una dirección
  pública temporal; la base de datos, el servidor y el frontend quedan accesibles solo desde la misma
  máquina.
- **FR-003**: El servidor debe ofrecer una dirección de estado que diga si está en marcha y si alcanza
  la base de datos, sin pedir código, y que responda aunque la base de datos esté caída.
- **FR-004**: El servidor crea y actualiza la estructura de la base de datos al arrancar, con pasos
  versionados que se aplican una sola vez y en orden.
- **FR-005**: Ninguna credencial ni código de acceso va en el repositorio; el repositorio trae un
  archivo de ejemplo sin valores. Si falta un valor obligatorio, el servicio no arranca y dice cuál falta.
- **FR-006**: El servidor debe aceptar chequeos diarios de la tablet con el formato del contrato
  compartido más un identificador único por chequeo (M4) y el seudónimo del tripulante.
- **FR-007**: Reenviar un chequeo con el mismo identificador no debe crear duplicados (ni avisos
  duplicados) y debe responder que ya estaba guardado.
- **FR-008**: El servidor debe rechazar entero un chequeo que incumpla el contrato: valor de voz no
  confirmado (Principio IX), veredicto y acción incoherentes (M2), indicador repetido, tipo distinto de
  `daily` (M8), origen distinto de `voice`/`device` (M3), o campos desconocidos en el sobre del envío
  (los campos desconocidos dentro del chequeo se descartan).
- **FR-009**: El envío de chequeos se protege con un código de tablet compartido de la configuración; la
  vista del cirujano, con un código de acceso compartido distinto (M7). No hay cuentas ni tokens. Más
  de 10 intentos fallidos en un minuto desde la misma dirección se rechazan hasta que pase el minuto.
- **FR-010**: El servidor guarda por chequeo: tripulante, día de misión, hora del chequeo (de la tablet)
  y de recepción, veredicto, acción, síntomas (M6), si es simulado (M5), cada valor con su indicador,
  origen, confirmación, si es simulado y hora, y la foto de lecturas por sensor (M9).
- **FR-011**: La vista del cirujano debe mostrar, en español, la lista de tripulantes con su último
  veredicto (primero `alert`, luego `attention`, luego `ok`) y el resumen de cada tripulante: último
  chequeo completo e historial de los últimos 14 días, con "simulado" y "criterio del equipo, no
  clínico" donde corresponda. El historial son los chequeos de los 14 días de calendario que terminan
  en el día del último chequeo, del más nuevo al más viejo. El código se recuerda solo mientras la
  pestaña siga abierta.
- **FR-012**: Un chequeo `attention` o `alert` abre un aviso ("pronto" o "ahora"); el cirujano registra
  una sola decisión entre "manejar en la base", "consultar con el cirujano" y "preparar regreso", que
  cierra el aviso con su hora.
- **FR-013**: El servidor no guarda nombres, fotos, audio ni transcripciones; los tripulantes son
  seudónimos `crew-` más 6 letras o números.
- **FR-014**: Ningún texto del servidor ni de la vista del cirujano da un diagnóstico ni recomienda
  medicación (Principio VI).
- **FR-015**: Las listas de valores permitidos del servidor (veredicto, indicador, origen, síntoma;
  el nivel vive solo en la foto de lecturas, M9) deben coincidir con las del contrato compartido; una prueba lo comprueba.
- **FR-016**: Para la demo, un paso opcional carga 14 días simulados del tripulante de ejemplo
  `crew-a1b2c3` (inicio de misión 2026-10-24), marcados "simulado".
- **FR-017**: La vista del cirujano debe poder abrirse desde un navegador en otra red usando la
  dirección pública del túnel; el servidor acepta llamadas de la app publicada del astronauta.

### Key Entities

- **Tripulante**: seudónimo `crew-xxxxxx` y fecha de inicio de misión. Sin nombre.
- **Chequeo recibido**: identificador único de la tablet, tripulante, tipo (`daily`), día de misión,
  veredicto, acción, síntomas, simulado, hora en la tablet, hora de recepción, foto de lecturas por
  sensor.
- **Valor**: uno por indicador dentro de un chequeo: indicador, valor (o par sistólica/diastólica, o
  sin dato), unidad, origen, confirmado, simulado, hora.
- **Aviso**: uno como máximo por chequeo `attention`/`alert`: urgencia, estado (abierto/decidido),
  decisión y hora de la decisión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una máquina con solo Docker, siguiendo el README, una persona del equipo tiene los
  cuatro servicios en marcha y ve el estado "en marcha / base de datos alcanzable" en menos de 10
  minutos.
- **SC-002**: Al detener y volver a levantar los servicios, un chequeo guardado antes sigue en la vista
  del cirujano.
- **SC-003**: Enviar el mismo chequeo 5 veces deja exactamente 1 chequeo y como mucho 1 aviso en la vista
  del cirujano.
- **SC-004**: Desde otra red, el cirujano abre la vista por la dirección pública, entra con el código y
  encuentra el veredicto del último chequeo de un tripulante en menos de 30 segundos.
- **SC-005**: Con un código equivocado no se ve ningún dato de ningún tripulante.
- **SC-006**: Una búsqueda en el repositorio no encuentra ningún valor de credencial ni de código de
  acceso; solo nombres de variables en el archivo de ejemplo.
- **SC-007**: Con el servidor apagado, la app del astronauta completa un chequeo igual que antes.

## Assumptions

- La tablet aún no envía chequeos: ese trabajo (identificador único por chequeo, seudónimo del
  tripulante, código de tablet, reintento sin conexión) es del frontend y de los contratos compartidos y
  se anota en `specs/004-resumen-cirujano/pendientes-frontend.md`. Hasta entonces, US2 se prueba con
  chequeos de ejemplo enviados al servidor y la demo usa la carga de FR-016.
- Mientras el identificador único y el seudónimo no estén en el contrato compartido, el servidor usa el
  contrato del chequeo tal cual y añade esos dos campos en su frontera, sin redefinir nada del contrato.
- La vista del cirujano la sirve el propio servidor (la única puerta desde fuera es el túnel), así no
  depende de la app del astronauta.
- La hora del chequeo es la de la tablet; la hora de recepción, la del servidor.
- El tripulante desconocido se crea con fecha de inicio = fecha del chequeo − (día de misión − 1).
- La carga de demo (FR-016) usa su propia variación fija; compartir el generador de historial con la
  tablet queda como pendiente.

## Dependencies

- `libs/contracts` (sin cambios en esta funcionalidad; los cambios propuestos van en pendientes).
- `specs/005-despliegue` (FR-006 a FR-012) comparte el arranque con un comando y el túnel.

## Out of Scope

- Chequeo de salida `exit` (002), medición WESAD (003), publicación en Cloudflare Pages (005).
- Cuentas de usuario, contraseñas por persona, tokens, recuperación de acceso.
- Recalcular niveles o umbrales en el servidor.
- Notificaciones (correo, push) al cirujano.
