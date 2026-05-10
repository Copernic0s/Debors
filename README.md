# Debtors App

Panel de seguimiento de deudas por agente para el equipo de ventas.

## Funciones clave

- Sincronizacion de datos desde Zoho WorkDrive (CSV publico).
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
