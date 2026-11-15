# Feature Specification: Despliegue — enlace público para el jurado y proyecto completo en local con un comando

**Feature Branch**: `005-despliegue`

**Created**: 2026-11-15

**Status**: Draft

## Clarifications

### Session 2026-11-15

- Q: ¿La publicación del enlace público es manual o automática? → A: Automática en cada cambio de la
  rama principal (repositorio en GitHub conectado al servicio de publicación).
- Q: ¿Qué dirección pública usa el túnel del backend? → A: Temporal, sin cuenta ni dominio; cambia en
  cada arranque.
- Q: El modelo de voz (~38 MiB) supera el límite de 25 MiB por archivo; ¿R2 o trozos? → A: Trozos
  menores a 25 MiB servidos desde el mismo enlace y unidos por la app (lo más simple: sin servicio
  ni configuración extra, mismo origen, la caché sin internet los guarda como cualquier archivo).
- Q: ¿Qué hace el backend en 005 si 004 no existe? → A: 005 espera a que 004 esté hecha y despliega
  el backend real.

**Input**: User description: "005-despliegue: El frontend se publica en Cloudflare Pages con un enlace público HTTPS para el jurado y sigue funcionando sin internet después de la primera carga. Todo el proyecto se levanta en local con un solo comando (docker compose up): frontend, backend, base de datos PostgreSQL y un túnel de Cloudflare que expone solo el backend, sin abrir puertos en la máquina. Las credenciales nunca van en el código. Fuera de alcance: Cloudflare Workers."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El jurado abre la app con un enlace (Priority: P1)

Una persona del jurado recibe un enlace público y seguro (https), lo abre en su navegador
(computadora o tableta) y usa Base Vital igual que en la demo: inicio, chequeo por voz, cuerpo 3D
e historial. Después de esa primera visita, la app sigue funcionando aunque se apague el wifi.

**Why this priority**: Es lo que el jurado ve. Sin un enlace que funcione, el proyecto no se puede
evaluar fuera de la sala.

**Independent Test**: Abrir el enlace en un navegador nuevo con internet, recorrer la app, apagar el
wifi, recargar y repetir el chequeo diario.

**Acceptance Scenarios**:

1. **Given** el enlace público, **When** el jurado lo abre en Chrome o Edge, **Then** la página
   carga por https, sin avisos de seguridad, y muestra la pantalla de inicio.
2. **Given** que el jurado ya abrió el enlace una vez, **When** apaga el wifi y recarga, **Then** la
   app carga y el chequeo diario, el cuerpo 3D y el historial funcionan igual (Principio VII).
3. **Given** que el servidor del proyecto está apagado o no se puede alcanzar, **When** el jurado
   usa la app desde el enlace, **Then** todo lo del astronauta funciona igual (Restricciones del
   prototipo, constitución 1.2.0).
4. **Given** el enlace público, **When** el jurado da permiso de micrófono, **Then** el chequeo por
   voz funciona (el enlace es un contexto seguro).

---

### User Story 2 - Levantar todo el proyecto en local con un comando (Priority: P1)

Una persona del equipo (o del jurado técnico) clona el repositorio, copia el archivo de ejemplo de
credenciales, pone sus valores y ejecuta un solo comando. Se levantan el frontend, el backend, la
base de datos y el túnel. La persona abre el frontend en su navegador en la misma máquina.

**Why this priority**: Es la forma de mostrar el proyecto completo (no solo la app del astronauta)
y de que cualquiera del equipo trabaje igual.

**Independent Test**: En una máquina con solo Docker instalado, seguir el README: copiar el archivo
de ejemplo, rellenar valores, ejecutar el comando y abrir el frontend.

**Acceptance Scenarios**:

1. **Given** una máquina con Docker y el repositorio clonado, **When** se ejecuta el comando único,
   **Then** los cuatro servicios (frontend, backend, base de datos, túnel) quedan en marcha sin otro
   paso manual.
2. **Given** los servicios en marcha, **When** se detienen y se vuelven a levantar, **Then** los
   datos guardados en la base de datos siguen ahí.
3. **Given** que falta una credencial obligatoria, **When** se ejecuta el comando, **Then** el
   servicio que la necesita no arranca y dice en un mensaje claro cuál falta; ninguna credencial se
   muestra en pantalla.

---

### User Story 3 - El backend se alcanza desde fuera sin abrir puertos (Priority: P2)

El backend del proyecto (sincronización y vista del cirujano, feature 004) es alcanzable desde
internet por una dirección https a través del túnel, sin abrir ni redirigir puertos en el router o
en el cortafuegos de la máquina. La base de datos y el frontend local no quedan expuestos a internet.

**Why this priority**: Permite mostrar el lado del cirujano de vuelo desde otro dispositivo, pero
la app del astronauta no depende de esto.

**Independent Test**: Con los servicios en marcha, abrir la dirección pública del backend desde
otra red (por ejemplo, un teléfono con datos móviles) y ver su respuesta de estado; comprobar desde
esa misma red que la base de datos no responde.

**Acceptance Scenarios**:

1. **Given** los servicios en marcha, **When** alguien abre la dirección pública del backend desde
   otra red, **Then** recibe la respuesta de estado del backend por https.
2. **Given** los servicios en marcha, **When** alguien intenta llegar a la base de datos o al
   frontend local desde otra red, **Then** no hay respuesta.
3. **Given** la máquina del equipo, **When** se revisan las reglas del router y del cortafuegos,
   **Then** no hay ningún puerto abierto ni redirigido para el proyecto.

---

### Edge Cases

- El túnel no puede conectarse (sin internet): el frontend, el backend y la
  base de datos siguen funcionando en local; solo falla el acceso externo, con un mensaje claro en
  los registros del túnel.
- Un cambio en la rama principal no se puede construir: el enlace público sigue con la última
  versión buena y el equipo ve el error en el estado de la publicación.
- Se publica una versión nueva en el enlace público mientras el jurado tiene la app abierta: la
  versión anterior sigue funcionando y la nueva se usa al recargar; nunca queda una mezcla rota.
- El jurado abre el enlace por primera vez sin internet: no puede cargar (es la única condición sin
  la que no funciona); esto se explica en el README.
- La máquina local ya usa el puerto que el frontend necesita: el comando falla con un mensaje claro
  y el README dice cómo cambiarlo.
- Falta un trozo del modelo de voz o llega dañado: la app no usa un modelo incompleto; el chequeo
  sigue con subtítulos y botones grandes, como cuando el modelo no carga.
- Alguien intenta guardar un archivo con credenciales reales en el repositorio: el archivo está
  ignorado por control de versiones y solo existe el archivo de ejemplo sin valores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El frontend debe estar publicado en un enlace público https estable, que se pueda
  compartir con el jurado.
- **FR-002**: Después de la primera carga desde el enlace público, la app del astronauta debe
  funcionar sin conexión, igual que en local (Principio VII).
- **FR-003**: La app publicada no debe depender del backend: con el backend apagado o inalcanzable,
  todo lo del astronauta funciona igual (constitución 1.2.0).
- **FR-004**: La app publicada no debe hacer ninguna petición a servicios externos durante su uso
  (fuentes, íconos, modelos y voz van incluidos), salvo la primera carga desde el propio enlace.
- **FR-005**: Cada cambio que llega a la rama principal del repositorio debe publicarse solo en el
  enlace público, sin un paso manual del equipo; si la construcción falla, el enlace sigue sirviendo
  la última versión buena. El README explica cómo ver el estado de la última publicación.
- **FR-006**: Un solo comando debe levantar en local, a la vez, el frontend, el backend, la base de
  datos y el túnel.
- **FR-007**: Los datos de la base de datos deben conservarse al detener y volver a levantar los
  servicios.
- **FR-008**: Desde internet solo debe ser alcanzable el backend, y solo a través del túnel, por
  https. Ni la base de datos ni el frontend local deben quedar expuestos a internet, y no se debe
  abrir ni redirigir ningún puerto en el router ni en el cortafuegos.
- **FR-009**: El túnel debe dar al backend una dirección pública temporal, sin cuenta ni dominio
  propio; la dirección cambia cada vez que se levanta el túnel y debe poder leerse fácilmente
  (por ejemplo, en los registros del túnel), como explica el README.
- **FR-010**: Esta funcionalidad despliega el backend real de 004 (sincronización y vista del
  cirujano); por eso 005 empieza cuando 004 esté terminada. El backend debe responder además una
  comprobación de estado: si está en marcha y si alcanza la base de datos.
- **FR-011**: Ninguna credencial (contraseña de la base de datos, credenciales de publicación) debe
  estar en el código ni en el repositorio; las de publicación viven solo en la configuración del
  servicio de publicación. Se leen de un archivo local ignorado
  por control de versiones o de variables del entorno; el repositorio incluye solo un archivo de
  ejemplo con los nombres y sin valores (Principio V).
- **FR-012**: Si falta una credencial obligatoria, el servicio que la necesita no debe arrancar y
  debe decir cuál falta, sin mostrar el valor de ninguna credencial.
- **FR-013**: El README debe explicar, para una persona que solo tiene Docker instalado: requisitos,
  cómo preparar las credenciales, el comando único, cómo abrir el frontend, cómo ver la dirección
  pública temporal del backend, cómo detener todo, y cómo funciona la publicación automática.
- **FR-015**: Ningún archivo publicado puede superar el límite por archivo del servicio de
  publicación (25 MiB). Los archivos más grandes (hoy el modelo de voz, ~38 MiB) se publican partidos
  en trozos menores al límite, desde el mismo enlace; la app los descarga la primera vez, los guarda
  para usarlos sin internet y los une al cargar. El resultado unido debe ser idéntico al original
  (se verifica con una huella), y la voz funciona igual que con el archivo entero.
- **FR-014**: Fuera de alcance: Cloudflare Workers, cuentas de usuario, dominios de pago
  adicionales, escalado y monitoreo de producción.

### Key Entities

- **Enlace público**: dirección https donde el jurado abre la app del astronauta; sirve archivos
  estáticos, sin servidor propio.
- **Entorno local**: los cuatro servicios levantados por el comando único en la máquina del equipo.
- **Túnel**: conexión de salida desde la máquina del equipo que da al backend una dirección https
  pública temporal sin abrir puertos ni usar cuenta.
- **Credenciales**: valores secretos (base de datos, publicación), siempre fuera del
  repositorio; el repositorio solo describe sus nombres.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona del jurado abre el enlace en un navegador nuevo y ve la pantalla de inicio
  en menos de 10 segundos con una conexión normal, sin avisos de seguridad.
- **SC-002**: Tras la primera visita, con el wifi apagado, la persona recarga el enlace y termina un
  chequeo diario completo, igual que con internet.
- **SC-003**: Con el backend apagado, la app desde el enlace público funciona igual (mismo chequeo,
  mismo veredicto, mismo historial).
- **SC-004**: En una máquina con solo Docker, una persona del equipo que sigue el README tiene los
  cuatro servicios en marcha con un solo comando, en menos de 10 minutos la primera vez (incluida
  la descarga) y en menos de 1 minuto las siguientes.
- **SC-009**: Con el enlace público, en un navegador nuevo, tras la primera carga y sin wifi, Vita
  entiende "cinco horas" igual que en local.
- **SC-008**: Un cambio que llega a la rama principal está visible en el enlace público en menos de
  10 minutos, sin que nadie ejecute nada.
- **SC-005**: Desde otra red, la dirección pública temporal del backend responde su estado por https; la
  base de datos y el frontend local no responden desde esa red.
- **SC-006**: Una búsqueda en todo el repositorio no encuentra ningún valor de credencial; solo el
  archivo de ejemplo con nombres sin valores.
- **SC-007**: Después de detener y volver a levantar los servicios, un registro guardado antes sigue
  disponible.

## Assumptions

- El enlace público usa el plan gratuito de Cloudflare Pages (sin coste por usuario, constitución).
- El frontend local del comando único se abre solo desde la misma máquina (escucha solo en la
  propia máquina, no en la red); "sin abrir puertos" se refiere a no exponer nada a internet ni a
  la red local, no a que el navegador local no pueda abrirlo.
- En 001 la app del astronauta no habla con el backend; la conexión app → backend (sincronización)
  llega con 004 y siempre será opcional.
- El enlace público usa la misma versión de la app que se construye en local; no hay una versión
  distinta para el jurado.
- Dependencia: 005 se implementa después de `004-resumen-cirujano`; el enlace público del frontend
  (US1) no depende del backend, pero se entrega junto con el resto de 005.
- El repositorio estará en GitHub, conectado al servicio de publicación, antes de publicar (hoy no
  está en control de versiones).
- La dirección temporal del backend es suficiente para la demo: el jurado no necesita un enlace fijo
  al backend; si hiciera falta, se comparte la dirección del día.
- El equipo tiene una cuenta de Cloudflare para el enlace público.
- La base de datos solo contiene datos simulados o anónimos (Principio V); no se hace copia de
  seguridad.
