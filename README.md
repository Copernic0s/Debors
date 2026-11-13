# Debtors App

Panel de seguimiento de deudas por agente. Combina el portafolio de Zoho (`Client BY agent`) con facturas de CMP persistidas en Supabase.

## Persistencia CMP

`cmp_invoices` es historial: las facturas observadas se hacen upsert y nunca se borran. `is_current=true` identifica el snapshot que lee el dashboard; las filas que dejan de estar vigentes conservan su historial con `closed_at` y `last_seen_sync_run_id`. `cmp_sync_runs` registra estado, cobertura y resultado de reconciliación.

El extractor conserva **todos los saldos abiertos, sin límite de antigüedad**, y limita por fecha de factura solo las facturas pagadas/cerradas. Los modos definen esa ventana de pagadas: fast 15 días, normal 120 y deep 365.

Los resultados se envían al ingest al terminar el scrape. Si el extractor devuelve filas con estado incompleto, esas observaciones se upsert; un error que interrumpe el scrape reporta una corrida fallida sin reconciliar. Corridas incompletas, vacías, fallidas o truncadas no cierran filas ausentes. Solo una corrida `complete`, no truncada, no vacía y con cobertura suficiente reconcilia el alcance observado. Un scrape posterior completo recupera la reconciliación sin borrar el historial.

Pasos de sync desde este equipo:

1. Iniciar el API local con `cd server && npm start`.
2. Iniciar Vite con `npm run dev`.
3. Desde la app local, usar Sync All o el nivel de profundidad deseado. CMP requiere el Chrome del operador y su sesión existente.
4. Consultar en el panel `Last successful sync` y `Last run error`. Status y logs se asocian al `run_id`; el status activo se oculta si no coincide con la corrida o supera `STATUS_MAX_AGE_MIN`.

Para previsualizar la reconciliación, establecer `CMP_INGEST_DRY_RUN=true` en el entorno local y enviar un scrape autorizado. El RPC calcula `rowsThatWouldClose` sin escribir facturas ni registrar la corrida. El preview necesita el payload extraído de CMP; no se debe usar un run normal para validar el número antes de revisar el resultado.

Ver [automation/README.md](automation/README.md) para variables, instalación, migraciones y recuperación de scrapes parciales.

## Esquema y acceso

El bootstrap limpio, config de Supabase local y contratos SQL están separados en la rama `codex/db-baseline`. Las cuatro migraciones aditivas ya se aplicaron al proyecto de producción; el estado y las comprobaciones están en [supabase/README.md](supabase/README.md). Ejecutar los fixtures SQL solo contra una base local desechable.

El roster de agentes activos está en [config/active-agents.json](config/active-agents.json); el extractor y los filtros de Overview usan la misma lista. Los agentes fuera del roster quedan fuera de los filtros y no se usan para asignar nuevas filas CMP. Los registros existentes no se borran ni se reasignan automáticamente.

La cuenta `guidiana.puentes@theunitedtransports.com` tiene perfil de billing de solo lectura en la UI: puede ver Overview y Companies para todos los agentes, pero no Analytics, edición, borrado ni acciones de PDF. La cuenta debe existir en Supabase Auth. Estas restricciones visuales no son una frontera de seguridad de datos: las políticas abiertas de lectura siguen activas hasta que estén completos el backfill de `agent_id` y los scopes verificados. Antes de activar RLS, provisionar y probar para ella el alcance de lectura de todos los agentes; no marcarla manager solo para ampliar visibilidad. No retirar las políticas abiertas todavía.

Provisionar `agent_scopes` con usuarios y `agent_id` verificados; usar [supabase/agent_scopes.seed.example.sql](supabase/agent_scopes.seed.example.sql) solo como plantilla, nunca con datos de usuarios reales en Git.

## Variables de entorno

- `CMP_INGEST_SECRET`: requerido; mínimo 32 bytes aleatorios. Solo el backend y el extractor local lo usan.
- `BIND_HOST`: `127.0.0.1` por defecto para el API local.
- `CMP_RECONCILE_MIN_RATIO`: umbral de cobertura de reconciliación; default `0.5`.
- `CMP_INGEST_DRY_RUN`: preview sin escrituras; default `false`.
- `STATUS_MAX_AGE_MIN`: edad máxima del progreso activo; default `60` minutos.

Los placeholders están en `.env.example` y `server/.env.example`. Nunca se versionan `.env` o `server/.env`.

## Desarrollo y verificación

```powershell
npm ci
npm run test:run
npm run build
cd server
npm ci
npm test
cd ..
python -m unittest discover -s automation -p 'test_cmp_*.py'
```

GitHub Actions ejecuta tests de frontend, build, server y helpers CMP. Los tests SQL de migraciones/RLS requieren una instancia Supabase/Postgres local.
