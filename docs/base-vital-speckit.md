# Base Vital — Bloques listos para Spec Kit

Orden: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada bloque se pega tal cual en el agente.
Funcionalidad núcleo del demo: **chequeo diario por voz + cuerpo 3D**. Ruta completa (con clarify y analyze).

---

## 1 · Constitución (`/speckit.constitution`)

```
/speckit.constitution

Crea los principios que gobiernan Base Vital, un prototipo para el reto 04 "Create Health Monitoring
Software for Astronauts on Space Missions" de NASA Space Apps Guayaquil 2026. Principios:

1. Simplicidad ante todo: ante dos soluciones, la más simple que siga funcionando sin internet.
   Es un prototipo de un fin de semana; nada de complejidad anticipada.
2. Idioma: la interfaz y la voz en español. El código, los comentarios y los documentos técnicos en
   inglés. El videopitch va en inglés, subtitulado al español.
3. Cero alcance fantasma: NO implementar nada que no esté en la spec. Una idea nueva se propone,
   no se construye.
4. Verificable por una persona no técnica: cada criterio de éxito se comprueba usando la app.
5. Datos con respeto: solo datos abiertos y anonimizados (WESAD, PhysioNet, NASA), con la fuente de
   cada dato; sin claves ni secretos en el código; nada de datos de personas identificables.
6. No diagnostica: la app ayuda a decidir; la última palabra es del cirujano de vuelo. Ningún mensaje
   afirma un diagnóstico.
7. Sin internet: todo lo que el astronauta usa funciona sin conexión.
8. Cada umbral tiene fuente: un umbral sin fuente citada no entra.
9. Nada se registra sin confirmar: todo número dicho en voz alta se repite y se confirma antes de usarse.

Mantén la constitution corta y en lenguaje claro.
```

---

## 2 · Spec v0 (pegar en `/speckit.specify`)

```
/speckit.specify

# Especificación: Base Vital — Chequeo diario por voz con cuerpo 3D v0

## 1. Objetivo y contexto de negocio
En una base lunar, la ayuda médica está a unos tres días de viaje. La pregunta diaria no es "¿cómo
estoy?", sino "¿esto puede esperar?". Cada mañana, Ana toca "Vita" en la tablet de la base y, en menos
de un minuto y sin escribir nada, responde por voz cuánto durmió y cómo se siente; la app toma sus
signos de los equipos de la estación, le muestra en un cuerpo 3D qué zona está alterada y le dice qué
hacer hoy. Éxito: el chequeo se completa en 60 segundos o menos y la persona entiende su estado sin
leer números.

## 2. Usuarios
- Astronauta (Ana): usa la app a diario, cansada o con prisa; no es médica; quiere saber qué hacer.
- Cirujano de vuelo (en la Tierra): no usa la pantalla del astronauta; recibe después el resumen y
  decide si hay que consultar o preparar el regreso.
- Jurado del reto: ve el demo y necesita entender en segundos qué hace y por qué es confiable.

## 3. Escenarios de usuario (historias)
- HU1 — Como astronauta, quiero hacer mi chequeo diario hablando, para no tener que escribir nada.
- HU2 — Como astronauta, quiero que la app repita lo que entendió antes de guardarlo, para no registrar
  un dato equivocado.
- HU3 — Como astronauta, quiero ver en un cuerpo 3D qué sensor corresponde a cada parte del cuerpo y
  cuál está alterado, para entender mi estado de un vistazo.
- HU4 — Como astronauta, quiero ver cada medida contra su rango permitido y contra mi normal, para saber
  si algo es raro para mí aunque esté dentro de la guía.
- HU5 — Como astronauta, quiero que al final me digan qué hacer hoy y qué sigue en mi día, para actuar
  sin pensar de más.
- HU6 — Como cirujano de vuelo, quiero que cada chequeo quede guardado con su origen, para revisar la
  historia de la persona.

## 4. Requisitos funcionales
- RF1. El sistema debe permitir iniciar el chequeo diario con un solo toque.
- RF2. El sistema debe hacer las preguntas en voz alta, una a la vez: horas de sueño, ánimo del 1 al 5
  y síntomas.
- RF3. El sistema debe entender respuestas habladas en español, incluidos números dichos con palabras.
- RF4. El sistema debe repetir cada número entendido y pedir confirmación antes de guardarlo.
- RF5. El sistema debe tomar presión arterial, pulso en reposo, saturación de oxígeno y temperatura
  corporal de los equipos de la estación, sin que la persona los escriba.
- RF6. El sistema debe mostrar un cuerpo humano en 3D que se puede girar, con un punto de color en la
  zona de cada sensor: sueño en la frente, pulso en el pecho, presión en el brazo, temperatura en el
  abdomen y oxígeno en la punta del dedo.
- RF7. El sistema debe resaltar en el cuerpo el sensor del que se está hablando en cada momento.
- RF8. El sistema debe mostrar cada medida con su valor, una barra con su rango permitido y la marca
  de "tu normal".
- RF9. El sistema debe dar un veredicto del día (bien / atención / alerta) con una sola acción concreta.
- RF10. El sistema debe mostrar la próxima actividad del día al terminar.
- RF11. El sistema debe guardar cada chequeo con la fuente de cada dato (voz, equipo, cámara).
- RF12. El sistema debe permitir detener o repetir la pregunta en cualquier momento por voz, y ofrecer
  botones grandes si no entiende la voz.

## 5. Reglas de negocio (con ejemplos)
- RN1. Rangos (bien / atención / alerta):
  presión < 120/80 · 120–139 u 80–89 · ≥ 140 o ≥ 90 (AHA/ACC 2025).
  pulso en reposo 60–100 · 50–59 o 101–110 · < 50 con síntomas o > 110 (AHA).
  temperatura 36,1–37,2 · 37,3–37,9 · ≥ 38,0 °C.
  oxígeno ≥ 95 % · 90–94 % · < 90 % (fuente por confirmar).
  sueño ≥ 7 h · 6–6,9 h · < 6 h durante 3 noches seguidas (AASM/SRS).
  ánimo 4–5 · 3 · ≤ 2 durante 2 días seguidos.
  Ejemplo: presión 128/76 → atención.
- RN2. Una sola noche con menos de 6 h es atención, no alerta.
  Ejemplo: Ana durmió 5 h hoy y 7 h ayer → atención.
- RN3. "Tu normal" = el promedio de los primeros 14 días de la persona. Si un valor se aleja más de
  2 desviaciones estándar durante 3 lecturas seguidas, pasa a atención aunque esté en rango.
  Ejemplo: pulso habitual 62 ± 3; tres lecturas de 72 → atención.
- RN4. Valores imposibles no alarman: se piden de nuevo. Ejemplo: "dormí 20 horas" → la app pregunta otra vez.
- RN5. Veredicto: bien = todo en verde y dentro de tu normal; atención = un ámbar, un valor fuera de tu
  normal o un dato en duda; alerta = un rojo confirmado, fiebre o dos ámbar a la vez.
  Ejemplo: sueño 5 h y todo lo demás bien → atención: "Dormiste poco: tómalo con calma".
- RN6. El color de un punto dice qué sensor es; la etiqueta (bien / atención / alerta) dice si está bien.
  Un mismo color nunca significa las dos cosas.

## 6. Criterios de aceptación (verificables sin código)
- CA1. Con un toque en Vita, el chequeo diario termina en 60 segundos o menos.
- CA2. Al decir "cinco horas", la app responde "Escuché 5 horas. ¿Correcto?" antes de guardar.
- CA3. Mientras Vita pregunta por el sueño, el punto de la frente está resaltado.
- CA4. Con sueño de 5 h, el punto de sueño queda en atención y el veredicto es "atención".
- CA5. Al girar el cuerpo, cada punto sigue sobre su zona.
- CA6. Con el wifi apagado, el chequeo completo funciona igual.
- CA7. Cada medida muestra su rango permitido y dónde cae el valor de hoy.
- CA8. El chequeo aparece guardado en el historial al terminar.

## 7. Casos límite
- CL1. ¿Y si no entiende la voz dos veces seguidas? → muestra botones grandes con las opciones.
- CL2. ¿Y si un equipo no envía su dato? → ese sensor queda "sin dato" en gris y no cuenta para el veredicto,
  pero el veredicto nunca puede ser "bien" con un sensor sin dato.
- CL3. ¿Y si es uno de los primeros 14 días? → no hay "tu normal" todavía; se usan solo los rangos y se
  dice "Aún aprendo tu normal".
- CL4. ¿Y si dice "me siento bien" pero la cámara ve cansancio y el pulso está alto? → el dato queda
  "en duda" y Vita pregunta otra vez.
- CL5. ¿Y si el 3D no carga? → se muestra una imagen del mismo cuerpo con los mismos puntos.

## 8. Fuera de alcance
- No diagnostica ni recomienda medicamentos.
- No envía nada al cirujano de vuelo en esta versión (va en otra funcionalidad).
- No incluye el chequeo de salida al exterior, los gestos con la mano ni el cansancio por cámara (otra funcionalidad).
- No mide radiación.
- No usa datos reales de astronautas: los equipos se simulan con datos abiertos de personas en la Tierra.

## 9. Preguntas abiertas
- PA1. ¿Fuente oficial del umbral de oxígeno? (revisar NASA-STD-3001).
- PA2. ¿El chequeo se inicia solo a una hora fija o siempre con un toque?
- PA3. ¿"Vita" es el nombre final del asistente?
- PA4. ¿La temperatura se simula como corporal o se muestra la de piel del brazalete como tendencia?
- PA5. ¿Se pregunta también por la calidad del sueño ("bien / mal") o solo por las horas?
```

---

## 3 · Clarify (`/speckit.clarify`)

```
/speckit.clarify

Foco: las preguntas abiertas PA1–PA5, el caso límite CL2 (sensor sin dato) y la regla RN3 (tu normal
durante los primeros 14 días).
```

---

## 4 · Plan (`/speckit.plan`)

```
/speckit.plan

Usa TypeScript con React (React Router v5.3.4) y Vite. Validación con Zod, con los contratos y las
constantes definidos una sola vez y compartidos. Arquitectura hexagonal ligera: domain sin
dependencias, application con puertos, adapters con todo lo demás; cada adaptador tiene su versión
simulada para correr el demo sin micrófono ni modelo.
Voz: reconocimiento con Vosk en el navegador (modelo pequeño en español, en un Web Worker, con
gramática por pregunta) y respuesta con speechSynthesis. La interpretación de lo dicho es
determinista, sin IA.
3D: modelo hecho en Blender y exportado a .glb con Draco, con un mesh "body" y 5 empties
"sensor_sleep", "sensor_pulse", "sensor_pressure", "sensor_temperature", "sensor_oxygen";
se muestra con React Three Fiber y drei, con un punto HTML anclado a cada empty.
Datos: pulso desde WESAD (UCI) reproducido como si viniera de un equipo; sueño desde PhysioNet;
presión, oxígeno y temperatura corporal simulados dentro de rangos realistas, y así se declara.
Almacenamiento local en IndexedDB.
Restricciones: sin cuentas, sin servidor, sin internet después de la primera carga, sin costo por
usuario. Presupuestos: transcripción final ≤ 800 ms, inicio de voz ≤ 300 ms, 3D ≥ 30 fps.
Respeta la constitution.
```

Después del plan, adjunta como contexto `base-vital-voice-blender-integration-spec.md`: ya trae los contratos,
el guion del chequeo, el contrato del modelo de Blender y los presupuestos. Si el plan lo contradice, el error
está en el plan.

---

## 5 · Tareas, análisis e implementación

```
/speckit.tasks
```
Revisa que cada RF tenga al menos una tarea y que existan tareas para: el script de Blender que crea los
5 empties, el script que verifica el .glb y el script de medición sobre WESAD.

```
/speckit.analyze
```
Repetir hasta que no reporte requisitos sin tarea ni contradicciones.

```
/speckit.implement
```
Si usan Haiku, que implemente solo las tareas de domain y contratos (con pruebas escritas primero); el visor
3D y la integración de Vosk, con un modelo más fuerte.

---

## 6 · CLAUDE.md (cuando exista el plan)
Usar el bloque de la guía tal cual. Agregar a las convenciones: nombres de nodos del .glb fijos, dos tablas de
colores separadas (sensor y estado) y textos de interfaz solo en `messages.es.ts`.

---

## Funcionalidades siguientes (una carpeta cada una en `specs/`)
- `002-chequeo-de-salida`: veredicto SALE / ESPERA / NO SALE, gestos 👍 ✋ ☝️, cansancio por cámara.
- `003-medicion-wesad`: aciertos, falsas alarmas evitadas y aviso temprano (el número del pitch).
- `004-resumen-cirujano`: sincronización y vista del médico.
