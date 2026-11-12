# Debtors App

Panel de seguimiento de deudas por agente para el equipo de ventas.

## CMP sync (Andres / localhost)

1. Crea el esquema base con `supabase/cmp_invoices.sql` y aplica las migraciones de `supabase/migrations/` en orden.
2. Configura `SUPABASE_SERVICE_ROLE_KEY` y `CMP_INGEST_SECRET` en el server local.
3. `cd server && npm start` y `npm run dev`.
4. **Sync All** recarga Zoho, corre el scraper (Chrome Profile 8) y hace upsert de las facturas CMP. Solo un scrape completo, no truncado, no vacio y sobre el umbral de cobertura puede marcar filas fuera del snapshot como no vigentes; nunca elimina filas.

Ver `automation/README.md`.

Para previsualizar una reconciliacion sin modificar Supabase, configura `CMP_INGEST_DRY_RUN=true` en el entorno local antes de iniciar el backend y ejecuta un scrape autorizado. El endpoint devuelve `rowsThatWouldClose`; no hace upsert ni crea un registro de corrida. El valor por defecto es `false`.

## Funciones clave

- Sincronizacion de datos desde Zoho WorkDrive (CSV publico).
- Facturas CMP abiertas de cualquier antiguedad y facturas pagadas dentro de la ventana seleccionada (fast 15, normal 120, deep 365 dias) para empresas de `Client BY agent`.
- Fallback automatico a datos locales cuando la fuente remota no responde.
- Dashboard con metricas automáticas (deuda activa, vencida, recaudado, efectividad).
- Listado editable de deudores con filtros y ordenamiento.

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy a GitHub Pages

El repo incluye workflow en `.github/workflows/deploy-pages.yml`.

1. En GitHub, abre `Settings > Pages`.
2. En `Build and deployment`, selecciona `GitHub Actions`.
3. Haz push a `main` y espera la ejecucion del workflow.

URL esperada:

`https://copernic0s.github.io/Debors/`
