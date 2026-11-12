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
- [ ] P1: activar acceso por agente en remoto requiere provisionar scopes reales y decision del owner. RLS agente/manager/sin scope pasa en baseline local `codex/db-baseline`.
- [x] P1: F4 snapshot SQL, dry-run, esquema limpio y contratos de reconciliacion pasan en Supabase local aislado (`codex/db-baseline`); no aplicar a remoto sin aprobacion.
- [x] P1: reflejar en SQL las columnas financieras usadas por ingest (migracion creada; no aplicada a Supabase remoto).
- [x] P1: hacer que ingest falle cerrado si falta `CMP_INGEST_SECRET` (backend requiere secreto de 32 bytes o mas al reiniciar).
- [x] P1: D1 confirmado: conservar todos los saldos abiertos y limitar por fecha solo invoices pagadas; F4 cambia el filtro del extractor y agrega tests.
- [x] P2: T9 perfil por fecha desc y CMP excluido del filtro semanal; pruebas agregadas.
- [ ] P2: T10 status/log por run_id, reset al inicio, status stale/huérfano ignorado, historial de ultimo exito/error separado (implementado, commit pendiente).
- [ ] P2: F6 pruebas faltantes no-DB, contratos DB separados en `codex/db-baseline`, CI y docs de persistencia/recuperacion actualizados (implementado, commits pendientes).

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
| 2026-11-12 | F3 preparado: nueva RLS por `agent_scopes`, lectura de PDF con mismo alcance y `agent_id` propagado desde `Client BY agent` al ingest; asignaciones conflictivas quedan nulas. No aplicar hasta provisionar scopes y probar RLS en Postgres local. | Python `unittest` 3/3; `npm run test:run` 27/27; `cd server && npm test` 5/5; ESLint focalizado y build pasan (warning de chunk >500 kB). No hay Supabase CLI; no se aplico SQL remoto ni se ejecuto CMP. |
| 2026-11-12 | F4 implementado en codigo: migracion idempotente `cmp_sync_runs` + RPC transaccional, run id en runner, complete/pages/truncated, ventana de abiertos, upsert/reconciliacion, dry-run y lectura `is_current`. | Baseline: frontend 27/27, server 5/5, build OK con warning de chunk. Ahora `cd server && npm test` 13/13; Python `unittest discover -s automation -p 'test_cmp_*.py'` 10/10; `py_compile` y lint focalizado OK. Prueba SQL de integracion escrita pero pendiente de correr: no hay `psql`, Supabase CLI ni Docker engine. No se aplico SQL remoto ni se ejecuto CMP. |
| 2026-11-12 | DB baseline separada en rama `codex/db-baseline`: config Supabase local, bootstrap antes de F1-F4 y contratos SQL de esquema, RLS y reconciliacion. | `npx supabase db reset` limpio y los tres contratos pasan en Docker local. No existe linked project; SQL solo local. Commit `dd7d374` publicado; crear PR separado. |
| 2026-11-12 | T9: perfil CMP inmune al filtro semanal y orden de fechas por parseo con pruebas de regresion. | `npm run test:run` 30/30. |
