# Debors Project Progress

Ultima actualizacion: 2026-11-12

## Estado

- La app React/Vite y el backend local CMP estan configurados para ejecutarse en `localhost:5173` y `localhost:3001`.
- Zoho entrega 475 filas de `Client BY agent`, equivalentes a 443 nombres de compania distintos en la lectura de esta sesion.
- CMP se scrapea desde Chrome local, se filtra por el portafolio de Zoho y se persiste en Supabase al terminar el recorrido.
- En la ultima comprobacion de esta sesion el scraper seguia activo en pagina 56 con 1,360 facturas extraidas; ese progreso no confirma que el run haya terminado o se haya persistido.
- La revision tecnica completa y el backlog con criterios de aceptacion estan en [docs/debors-project-flow-and-findings.md](docs/debors-project-flow-and-findings.md).

## Prioridad inmediata

- [x] P1: leer todas las facturas CMP; paginacion Supabase de hasta 1,000 por peticion, conteo exacto y rechazo de lecturas incompletas.
- [x] P1: conciliar importe original, total pagado y saldo restante en agregados y detalle (aritmetica en centavos y aviso de discrepancias).
- [x] P1: ordenar invoices por fecha y asegurar que el perfil no esconda CMP por el filtro de semana.
- [ ] P1: aplicar el acceso por agente en RLS/API, no solo en filtros del navegador.
- [ ] P1: definir reconciliacion de snapshot vigente sin perder historial ni aceptar crawls parciales.
- [x] P1: reflejar en SQL las columnas financieras usadas por ingest (migracion creada; no aplicada a Supabase remoto).
- [x] P1: hacer que ingest falle cerrado si falta `CMP_INGEST_SECRET` (backend requiere secreto de 32 bytes o mas al reiniciar).
- [ ] P1: acordar como cubrir todos los saldos abiertos, incluso invoices anteriores a la ventana temporal normal.
- [ ] P2: corregir estado obsoleto del runner y documentacion operativa.
- [ ] P2: agregar pruebas de RLS e ingest.

## Forma de trabajo

- Antes de implementar, acordar alcance y criterio de aceptacion con Andres.
- Por cada cambio funcional, actualizar este archivo con estado y evidencia de pruebas.
- Crear commits pequenos y enfocados; nunca incluir archivos locales, secretos, datos de Chrome ni cambios preexistentes no relacionados.
- Publicar cada commit a la rama remota de trabajo despues de verificar que el push no sobrescriba trabajo remoto.
- Si un cambio no puede publicarse o una prueba falla, registrar el motivo aqui y no declarar la tarea completa.

## Registro

| Fecha | Cambio | Verificacion |
|---|---|---|
| 2026-11-12 | Revision tecnica de datos Zoho/CMP, dashboard, esquema y permisos; se agrego el informe detallado. | Vite y API local HTTP 200; conteo Supabase 2,520 vs lectura default 1,000; CMP seguia scrapeando en pagina 56/1,360 al ultimo chequeo. |
| 2026-11-12 | F1: migracion versionada para campos financieros/snapshot; ingest fail-closed con comparacion timing-safe, CORS local y bind loopback. | `cd server && npm test` 3/3; `npm run test:run` 17/17; `npm run build` pasa (warning de chunk >500 kB). Migracion no aplicada remotamente; no se reinicio el backend activo. |
| 2026-11-12 | F2: lectura paginada y completa de CMP; totales financieros en centavos; perfil con fechas, ultimo invoice, total/paid/balance y subtotal overdue; retencion del ultimo snapshot al fallar una lectura parcial. | `npm run test:run` 25/25; `cd server && npm test` 3/3; `npm run build` pasa (warning de chunk >500 kB); ESLint focalizado sin errores (3 warnings preexistentes de dependencias React). SQL remoto y backend activo no tocados. |
