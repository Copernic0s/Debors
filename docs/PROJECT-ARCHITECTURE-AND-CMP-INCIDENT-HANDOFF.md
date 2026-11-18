# Debors: arquitectura y estado del incidente CMP

**Corte:** 18 de noviembre de 2026  
**Propósito:** entregar a otro agente el mapa técnico del proyecto y la cronología correcta del problema de frescura.  
**Conclusión ejecutiva:** el primer run truncado reportado fue ayer, antes del cambio que limitó Fast a 20 páginas. Ayer el run llegó a 100 páginas y quedó incompleto. Hoy, además, el nuevo límite de Fast agravó la cobertura. La aplicación conserva intencionalmente las filas no vistas en runs parciales; por eso el dashboard puede mostrar facturas viejas aunque el run haya guardado algunas nuevas.

## Estado en una mirada

| Área | Estado conocido |
|---|---|
| Dashboard de producción | El frontend ya puede leer CMP aunque falle Zoho. Los indicadores de frescura son informativos; no sincronizan datos. |
| Datos CMP | La última lectura de producción documentada encontró 4,260 filas `is_current`, 2,022 con más de 72 h desde su último sync. |
| Scraper | CMP informa 433,812 registros y acepta 500 filas por página en los logs comprobados: unas 868 páginas para inventario completo. |
| Run de ayer | La captura de las 5:02 PM muestra 100 páginas, 2,234 facturas almacenadas, `complete=false`, `truncated=true`. No fue un snapshot completo. |
| Run Fast de hoy | El log más reciente documentado muestra 20 páginas, 351 facturas de cartera, `truncated=true`. Solo cubrió una fracción pequeña del inventario. |
| Código actual | Commit `1b5c36b` restaura `maxPages=1000` para Fast en `server/cmpRunner.js`; suite backend 30/30. |
| API local | El proceso existente en `127.0.0.1:3001` respondió saludable y conectado al Supabase de producción, pero retiene el código cargado cuando arrancó. No se confirmó reinicio con `1b5c36b`. |
| Sync ejecutado en esta sesión | Ninguno. No se escribieron filas en Supabase. |

## Arquitectura

```text
React/Vite en navegador
  ├─ Zoho WorkDrive: empresas, agentes y ciclo de facturación
  ├─ Supabase Auth: sesión y perfil
  └─ Supabase anon/authenticated: lectura de cmp_invoices vigentes
          │
          ├─ mapCmpInvoicesToDebtorRows (company/agent/invoice fields)
          ├─ mergeZohoWithCmpRows (evita duplicar invoice/company)
          └─ aggregateByCompany -> Overview, Debtors List, Company Profile

Bot CMP local (requiere Chrome autenticado del operador)
  UI Sync -> POST /api/cmp/run (API Node local)
          -> server/cmpRunner.js
          -> automation/run_cmp_bot.ps1
          -> automation/cmp_invoice_extractor.py + Selenium
          -> POST /api/cmp/ingest (API Node local)
          -> apply_cmp_sync_run RPC (Supabase)
          -> cmp_invoices + cmp_sync_runs
```

### Frontend y lectura

- `src/App.jsx` arma las vistas, controla el estado del dashboard y consulta el status del runner local.
- `src/hooks/useDebtors.js` carga fuentes y mantiene/mapea registros del dashboard. `src/services/dashboardDataSources.js` permite cargar Zoho y CMP en paralelo para que un error de Zoho no impida consultar CMP.
- `src/services/zohoWorkDrive.js` obtiene el portafolio publicado de Zoho WorkDrive, que se usa para compañías/agentes y conciliación de nombres.
- `src/services/cmpInvoices.js` consulta `cmp_invoices` con `is_current=true`, pide el conteo exacto y lee en rangos de 1,000 filas. Lanza error si las filas recibidas no igualan el conteo esperado.
- `src/services/cmpMerge.js` transforma filas CMP y las combina con Zoho. El dashboard agrupa luego por empresa; un total agregado puede incluir varias facturas y/o registros Zoho únicos.
- `CmpFreshnessPanel.jsx` y el perfil muestran cuándo se observó cada fila. No cambian la cobertura, no inician un scrape y no corrigen datos antiguos.
- La lectura de facturas ocurre desde el navegador con la sesión Supabase. La clave `service_role` debe permanecer solo en el API/entorno backend, nunca en el bundle Vite.
- `src/components/` contiene las superficies principales: Overview/Debtors List, Companies/Company Profile, Manager Analytics, Invoice Entry y paneles operativos CMP. `src/constants/accessControl.js` calcula perfiles manager/agent/viewer para la UI; Guidiana está configurada como viewer de lectura. Las rutas backend de PDF vuelven a validar sesión/alcance. Esto no significa que las políticas de lectura de todas las filas CMP ya estén aisladas por agente en RLS.

### Runner, extractor e ingest

- `server/server.js` expone `/api/health`, `/api/cmp/status`, `/api/cmp/logs`, `/api/cmp/run` y `/api/cmp/ingest`. El servidor carga variables de entorno al inicio y no imprime sus valores.
- `server/cmpRunner.js` asigna `run_id`, historial, timeout de login/MFA y parámetros de profundidad, luego crea un proceso `powershell.exe` para `automation/run_cmp_bot.ps1`.
- `automation/run_cmp_bot.ps1` prepara Chrome con directorio de perfil aislado, debugging en puerto 9222 y llama al extractor Python. El bot depende de una sesión CMP/MFA válida del operador.
- `automation/cmp_invoice_extractor.py` solicita `limit=500`, valida el tamaño efectivo, navega páginas, extrae filas crudas y filtra coincidencias contra el roster/compañías de Zoho. Conserva saldos abiertos de cualquier antigüedad; la ventana de pagadas se basa en fecha de factura (Fast 15 días, normal 120, deep 365). No persiste `last payment date`.
- El extractor entrega run ID, páginas, filas extraídas, `complete`/`truncated` y las filas recolectadas al endpoint local de ingest.
- `server/cmpIngest.cjs` requiere secreto de ingest y credenciales de servicio en el backend. Convierte las filas y llama el RPC transaccional `apply_cmp_sync_run`.
- La migración `20261112214000_cmp_snapshot_reconciliation.sql` mantiene la lógica de snapshot: las filas observadas se upsert; las no vistas se cierran solo si el run completo satisface todas las guardas de estado, no truncado, no vacío, alcance y ratio. **Los runs incompletos no borran ni cierran las filas ausentes.** Es una protección correcta, pero deja coexistir filas recientes y filas viejas en `is_current=true`.

### Profundidades y límites efectivos

| Invocación | Fuente de configuración | Comportamiento actual/intencionado |
|---|---|---|
| UI -> `/api/cmp/run` | `server/cmpRunner.js` envía `CMP_MAX_PAGES` al proceso hijo | Con commit `1b5c36b`, Fast/normal/deep tienen límite 1,000; las ventanas pagadas siguen siendo 15/120/365 días. |
| Ejecutar `run_cmp_bot.ps1 -Depth ...` directamente | El propio PowerShell asigna páginas al recibir `-Depth` | El script conserva valores históricos fast=5, normal=100, deep=250. **Diverge del runner** y puede volver a limitar una invocación directa. |
| Extractor iniciado sin `CMP_MAX_PAGES` | Default de `cmp_invoice_extractor.py` | 1,000 páginas. |

La ruta normal de la interfaz inicia PowerShell **sin** `-Depth` y pasa variables desde `cmpRunner.js`; por eso debe respetar el límite del runner. La ruta directa con `-Depth` sí aplica los números antiguos del PowerShell. El siguiente agente debe unificar estas dos fuentes y añadir una prueba para evitar regresión.

## Cronología verificada

Esta cronología distingue el primer fallo de cobertura del empeoramiento posterior.

| Fecha/hora local | Hecho y evidencia | Interpretación |
|---|---|---|
| 17 nov, 5:02 PM | Captura compartida: Sync All/Standard parcial, 100 páginas, 2,234 filas almacenadas, `complete=false`, `truncated=true`. CMP mostraba del orden de 433,812 filas. `progress.md` asocia el run de 100 páginas con `c31f4576-1b0d-4425-a9f3-a385973b50bb`. | **El problema de cobertura empezó antes del límite Fast=20.** El run no alcanzó el final del inventario. |
| 17 nov, 5:53 PM | Commit `91660b8 fix(cmp): allow full inventory pagination`: en `server/cmpRunner.js` subió los límites del runner de Fast 5 / normal 100 / deep 250 a 1,000, y el default del extractor de 40 a 1,000. | Fue un intento de corregir el límite, pero no cambia los valores históricos dentro de `run_cmp_bot.ps1` para invocaciones directas con `-Depth`. El run anterior a las 5:53 no puede ser resultado de este commit. |
| 17 nov, después | Se reportó avance a cientos de páginas en una ejecución larga; también se anotó un Standard de 100 páginas/26 minutos y runs que quedaron truncados. | Los logs/run IDs concretos deben revisarse antes de afirmar que hubo un snapshot completo. Llegar a una página intermedia no equivale a terminar. |
| 18 nov, 8:05 AM | Commit `f4bd723 fix(cmp): bound fast sync to recent pages`: cambia solo Fast en `server/cmpRunner.js` de 1,000 a 20 páginas. | Este cambio es **posterior al inicio del problema**. Agravó la cobertura de Fast y explica runs de 20 páginas, pero no el primer run truncado del día anterior. |
| 18 nov | Runs Fast documentados con 20 páginas, 10,000 filas crudas y 351 coincidencias; `complete=false`, `truncated=true`. | Solo esas filas observadas pudieron actualizarse; las demás siguieron vigentes con `synced_at` antiguo. |
| 18 nov, 8:40 AM | Commit `eb3611b fix(dashboard): load CMP independently from Zoho`, luego desplegado. | Corrigió que un error de Zoho impidiera leer CMP. Es una corrección de disponibilidad del dashboard, no aumenta la cobertura del scrape. |
| 18 nov, 9:22-9:34 AM | Se añadieron indicadores de frescura al perfil/panel y se desplegó el bundle de frontend. | Hace visible la antigüedad; no sincroniza ni modifica facturas. |
| 18 nov, 10:02 AM | Commit `1b5c36b`: revierte únicamente el límite Fast de 20 a 1,000; backend 30/30. | Cambio subido a `codex/windows-cmp-auto-sync`. No se ha demostrado con un run real porque el API local no fue reiniciado con este commit en esta sesión. |

### Causa inmediata versus causa inicial

1. **Causa inicial observada ayer:** el run llegó a 100 páginas y quedó truncado. La captura es anterior al commit `91660b8` que más tarde subió los límites del runner. No es correcto atribuir el inicio al commit de Fast de hoy.
2. **Empeoramiento posterior:** `f4bd723` limitó Fast a 20 páginas. Eso dejó aún más facturas fuera del run y produjo el patrón de 20 páginas/351 coincidencias.
3. **Por qué hoy no se puede declarar resuelto:** `1b5c36b` restauró el parámetro del runner, pero no se ejecutó un scrape con ese código ni se comprobó una fila en DB -> respuesta REST -> Debtors List.
4. **Segunda discrepancia que hay que cerrar:** `run_cmp_bot.ps1` mantiene límites históricos en invocación directa con `-Depth`; alinear configuración y agregar contrato de prueba antes de que otro camino de ejecución se use accidentalmente.

## Datos y run conocidos

Consulta de solo lectura documentada el 18 nov para el proyecto de producción:

- `cmp_invoices`: 4,260 filas y 4,260 `is_current=true`.
- 2,238 con `agent_id`; 2,022 sin actualización en más de 72 horas.
- Último run relevante observado: 351 filas con su `sync_run_id`, incompleto/truncado. Run ID exacto depende de qué captura se tome como la más reciente (`01fe7c97-0239-4e6d-94d4-5fa2c7ee85fb` y `fc8ac8ca-ccba-4928-adf1-2d669dbbd6ec` figuran en notas como runs Fast parciales distintos).
- Logs de 20 páginas verifican `limit=500`, 500 filas crudas por página, 10,000 filas crudas totales y 351 matches. 500 es el máximo comprobado en la UI/log; no se probó más de 500.
- Un run de 100 páginas tomó aproximadamente 26 minutos; extrapolar a 868 páginas da varias horas, no una garantía. Fast puede terminar truncado si llega a 1,000 páginas o CMP falla antes.

## Problemas actuales, por prioridad

### P0: no existe una prueba de sync completo después del arreglo

El cambio `1b5c36b` tiene test de configuración, no prueba de ejecución CMP. Hasta ver `runStatus=complete`, `truncated=false`, páginas terminales y filas nuevas con `synced_at` reciente, la actualización no está demostrada.

### P0: API local activo y código del runner pueden no coincidir

En esta sesión, `/api/health` en `127.0.0.1:3001` respondió conectado al Supabase de producción y sin run activo. Ese proceso ya estaba iniciado antes del nuevo commit. Un proceso Node no carga automáticamente cambios de `cmpRunner.js`; debe reiniciarse para usar `maxPages=1000`. La sesión de Codex no tenía `.env`/`server/.env` en este worktree, así que no pudo iniciar un backend configurado alternativo. No exponer ni copiar secretos para resolverlo.

### P1: cobertura depende del orden de CMP

Fast usa ventana de fecha de factura para pagadas, no `last payment date`. Un pago reciente aplicado a una invoice antigua puede quedar fuera incluso recorriendo páginas, según el orden/alcance efectivo. El extractor hoy no parsea esa columna. El modo open + segunda pasada por fecha de pago solo está diseñado, no implementado; falta confirmar los filtros reales de la UI CMP.

### P1: valores agregados pueden esconder una discrepancia por factura

La tabla del dashboard agrupa varias facturas por compañía y se fusiona con filas Zoho. Un invoice de control debe compararse en tres capas: fila Supabase, respuesta REST autenticada y Debtors List/Company Profile. Si DB está nueva y UI vieja, investigar normalización/merge/filtros/estado React; si DB está vieja, es cobertura/ingest.

### P1: una fila current no significa fila reciente

`is_current=true` indica que no se ha reconciliado como ausente; no certifica que se haya visto en el último run. Un run truncado actualiza las filas que observó y deja sin cambiar las demás, por diseño.

### P2: automatización Windows no sirve para un run de varias horas todavía

Las tareas planificadas tienen límite de ejecución de una hora. Un scrape completo estimado en varias horas no debe registrarse como tarea normal/fija hasta rediseñar timeout, frecuencia y protección contra solapamientos.

## Plan de continuación para el siguiente agente

1. **No revertir toda la app ni tocar Supabase/RLS.** Preservar el arreglo `eb3611b` que separa la carga de CMP de Zoho y el comportamiento de no reconciliar runs parciales.
2. Revisar el run de ayer (100 páginas) y cada run Fast posterior con `run_id`, `pages_scraped`, `rows_extracted`, `complete`, `truncated`, `failure_reason` y `synced_at`. No inferir cobertura por el número de páginas que se vio pasar en pantalla.
3. Unificar `server/cmpRunner.js`, `automation/run_cmp_bot.ps1` y `automation/cmp_invoice_extractor.py` para que una sola fuente controle `CMP_MAX_PAGES`; probar tanto el endpoint/API como la invocación directa con `-Depth` sin arrancar el bot en tests.
4. Reiniciar el API local desde el entorno operativo autorizado que tenga las credenciales cargadas. Confirmar `/api/health`, el proyecto Supabase esperado y `/api/cmp/status` inactivo antes de lanzar. No leer ni mostrar `.env`.
5. Solo con autorización explícita, lanzar un Fast con el límite corregido. Esperar el fin real; confirmar `complete=true`, `truncated=false`, `pages_scraped` coherente con el total CMP y que las filas de prueba obtuvieron nuevo `synced_at`/`sync_run_id`. Si supera el tiempo disponible o hay MFA/cambios de página, dejarlo incompleto; nunca forzar reconciliación.
6. Elegir una factura de control y seguirla DB -> REST -> UI. Esta prueba distingue finalmente cobertura/ingest de un defecto de lectura/fusión.
7. Diseñar/validar modo de abiertas y pagos recientes solo después de confirmar en CMP los filtros por saldo y `last payment date`, total de resultados, semántica de fechas y paginación.

## Verificación y límites de esta sesión

- Commit `1b5c36b` subido a `codex/windows-cmp-auto-sync`; `cd server; npm test`: 30/30.
- No se ejecutó el bot; no se aplicó SQL remoto; no se editaron policies; no se leyeron ni imprimieron `.env`.
- No se verificó un run nuevo ni la aparición de datos tras `1b5c36b`.
- Hay modificaciones preexistentes del usuario en `package.json`/`package-lock.json` y artefactos locales bajo `automation/`; deben permanecer fuera del staging.

## Archivos de referencia

- `progress.md`: diario de cambios y resultados.
- `README.md`, `automation/README.md`: ejecución y reglas del sync.
- `docs/CMP-DASHBOARD-DATA-FRESHNESS-ANALYSIS.md`: diagnóstico DB/REST/UI y prueba de factura de control.
- `docs/CMP-OPEN-SYNC-DESIGN.md`: propuesta no implementada para abiertas + pagos recientes.
- `server/cmpRunner.js`, `automation/run_cmp_bot.ps1`, `automation/cmp_invoice_extractor.py`: configuración y ejecución de la extracción.
- `server/cmpIngest.cjs`, `supabase/migrations/20261112214000_cmp_snapshot_reconciliation.sql`: ingest y guardas del snapshot.
- `src/services/cmpInvoices.js`, `src/services/cmpMerge.js`, `src/hooks/useDebtors.js`: lectura, combinación y agregación del dashboard.
