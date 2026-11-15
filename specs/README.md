# Estado del producto — Base Vital

| Funcionalidad | Qué es | Estado |
|---|---|---|
| `001-chequeo-diario-voz-cuerpo` | Chequeo diario por voz con cuerpo 3D | Implementada; falta probarla en la tableta (T097) y WESAD (T020) |
| `002-chequeo-de-salida` | Veredicto SALE / ESPERA / NO SALE, gestos 👍 ✋ ☝️, cansancio por cámara | Pendiente |
| `003-medicion-wesad` | Aciertos, falsas alarmas evitadas y aviso temprano sobre WESAD (el número del pitch) | Pendiente |
| `004-resumen-cirujano` | Backend de sincronización y vista del cirujano de vuelo (servidor fuera del camino crítico, constitución 1.2.0) | Pendiente — [issue #5](https://github.com/AymanElS4/Hackathon--Health_Monitoring/issues/5) |
| `005-despliegue` | Enlace público para el jurado (Cloudflare Pages, sin internet tras la primera carga) y todo el proyecto en local con un comando (frontend, backend, base de datos, túnel solo al backend) | Especificada; empieza después de 004 |

Cada funcionalidad tiene su carpeta en `specs/` con `spec.md`, `plan.md` y `tasks.md` cuando se
especifica. Las reglas de producto están en `.specify/memory/constitution.md`.
