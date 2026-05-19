# Debtors App

Panel de seguimiento de deudas por agente para el equipo de ventas.

## CMP sync (Andres / localhost)

1. Ejecuta `supabase/cmp_invoices.sql` en Supabase.
2. Configura `SUPABASE_SERVICE_ROLE_KEY` y `CMP_INGEST_SECRET` en el server local.
3. `cd server && npm start` y `npm run dev`.
4. **Sync All** recarga Zoho, corre el scraper (Chrome Profile 8) y reemplaza `cmp_invoices` en Supabase (visible en Vercel para todos).

Ver `automation/README.md`.

## Funciones clave

- Sincronizacion de datos desde Zoho WorkDrive (CSV publico).
- Facturas CMP (ultimos 60 dias, incl. paid) para empresas en `Client BY agent`.
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
