# Debors: funcionamiento y revision tecnica

Documento de arquitectura y hallazgos del proyecto Debors, preparado el 12 de noviembre de 2026. Describe el flujo que existe hoy y deja un backlog priorizado para que el dashboard muestre datos CMP completos, recientes y financieramente confiables.

## Resumen ejecutivo

Debors es una aplicacion React/Vite que combina el portafolio de Zoho con facturas de CMP persistidas en Supabase. El scrape de CMP se ejecuta desde el equipo local, porque necesita Chrome y la sesion autenticada del operador. El frontend consulta Zoho desde el backend configurado en `VITE_API_URL`, lee facturas CMP desde Supabase y combina ambas fuentes en memoria.

La estructura principal existe: autenticacion, filtros por agente, directorio de companias, perfil con facturas, estados de sincronizacion y bot CMP local. Sin embargo, hay problemas confirmados que afectan la cifra y el detalle financiero:

- Supabase contiene 2,520 filas CMP en la revision, pero la consulta del cliente devuelve solo 1,000. Los totales y el directorio pueden quedar incompletos.
- El perfil de compania muestra el importe original de la factura en la columna `Amount`, aunque el resumen utiliza el saldo restante.
- Facturas recientes se ordenan por numero de factura y se pueden ocultar al seleccionar una semana.
- Las metricas agregadas `Total Invoiced` y `Total Paid` no usan de forma consistente los campos CMP `total_amount`, `total_paid` y `remaining_amount`.
- La politica RLS permite que cualquier usuario autenticado lea todas las filas CMP; el filtro por agente se hace en el navegador y no constituye una barrera de seguridad.
- El ingest conserva filas historicas por upsert, sin reconciliar registros que ya no regresan del scrape.

Durante esta revision el bot permanecia ejecutandose: al ultimo chequeo iba en pagina 39 con 975 facturas extraidas y sin error reportado. Ese numero es solo una observacion intermedia; no representa el resultado final del sync. No se lanzo, detuvo ni modifico el bot.

## Arranque local

Usar dos terminales abiertas en la raiz del repo `Debors`:

```powershell
# Terminal 1: frontend
npm run dev -- --host 127.0.0.1
```

```powershell
# Terminal 2: API local y runner CMP
node server/server.js
```

Direcciones locales:

| Servicio | Direccion | Uso |
|---|---|---|
| Frontend | `http://localhost:5173/` | App React y dashboard |
| API local | `http://localhost:3001/api/health` | Estado del servidor local |
| Estado CMP | `http://localhost:3001/api/cmp/status` | Estado actual del runner |
| Log CMP | `http://localhost:3001/api/cmp/log?lines=120` | Ultimas lineas del scraper |

El backend local lee primero el `.env` de la raiz y luego `server/.env`. No se deben copiar valores secretos a documentacion ni al frontend. Vite incorpora variables `VITE_*` al iniciar; despues de cambiarlas, hay que reiniciar Vite.

Los controles CMP solo aparecen en modo desarrollo, desde localhost y para una cuenta cuyo email contiene `andres`. La app arma la URL del runner como `http://<host-de-la-pagina>:3001`.

## Componentes y responsabilidades

| Componente | Responsabilidad |
|---|---|
| `src/App.jsx` | Sesion Supabase, permisos de UI, filtros globales, controles CMP, perfil de compania y vistas principales. |
| `src/hooks/useDebtors.js` | Descarga Zoho, consulta CMP, combina fuentes, aplica cambios manuales y calcula agregados por compania. |
| `src/services/zohoWorkDrive.js` | Lee el JSON publicado por el backend configurado en `VITE_API_URL`. |
| `api/debtors.js` | Handler serverless que descarga y transforma el XLSX publicado de Zoho. |
| `server/server.js` | API Express local: health, datos Zoho, runner CMP, ingest, logs y cola de PDFs. |
| `server/cmpRunner.js` | Lanza el script PowerShell y reporta estado/progreso del proceso CMP. |
| `automation/run_cmp_bot.ps1` | Prepara Chrome aislado, abre el endpoint de invoices y espera el debugger local. |
| `automation/cmp_invoice_extractor.py` | Lee `Client BY agent`, navega invoices CMP, filtra companias y extrae importes/estados. |
| `server/cmpIngest.cjs` / `lib/cmpIngest.js` | Convierte el snapshot del bot en filas Supabase mediante service role y upsert. |
| `src/services/cmpInvoices.js` | Consulta `cmp_invoices`, recupera la ultima marca de sync y gestiona PDFs. |
| `src/services/cmpMerge.js` | Mapea filas CMP y elimina duplicados de invoices CMP/Zoho por compania y numero. |
| `src/components/CompanyDirectory.jsx` | Tabla agregada de companias; seleccionar una fila abre el perfil. |
| `src/components/CompanyProfileModal.jsx` | Resumen de deuda y lista de facturas de una compania. |
| `supabase/cmp_invoices.sql` | Esquema/RLS documentado para CMP y bucket privado de PDFs. |

## Flujo de datos

```text
Zoho XLSX publicado
  -> API configurada en VITE_API_URL (/api/debtors)
  -> useDebtors carga debtors, Client BY agent y tracker
  -> mapeo de CMP agrega agentId/ciclo y deduplica invoices
  -> agregados y perfil de compania en React

Sync All local
  -> vuelve a cargar Zoho
  -> POST http://localhost:3001/api/cmp/run
  -> cmpRunner.js ejecuta run_cmp_bot.ps1
  -> Chrome aislado con puerto debugger 9222
  -> Python vuelve a leer Client BY agent y scrapea CMP
  -> guarda snapshot en memoria durante el scrape
  -> al terminar, POST /api/cmp/ingest
  -> Express verifica secreto y usa Supabase service role
  -> upsert de cmp_invoices con sync_run_id/synced_at
  -> Supabase Realtime avisa al frontend y se refresca CMP
```

### Fuentes y frecuencia

- `loadData()` consulta Zoho al iniciar sesion y cada cinco minutos.
- `refreshCmpData()` vuelve a consultar CMP cada 15 segundos y al recibir cambios Realtime.
- El bot carga el portafolio de Zoho por separado para decidir que filas CMP conservar. El frontend y el bot pueden, por tanto, consultar el XLSX en momentos diferentes.
- El scraper publica el snapshot cuando completa el recorrido; las filas parciales que muestra el log durante el scrape no se consideran todavia una carga completa a Supabase.
- El scrape normal usa 120 dias y hasta 100 paginas; fast usa 15 dias/5 paginas y deep 365 dias/250 paginas. El comportamiento efectivo depende de las filas y paginacion de CMP.

## Logica financiera actual

El scraper busca en CMP los campos `Total Amount`, `Remaining Amount`, `Total Paid`, status, invoice date y due date. Cuando existe `Remaining Amount`, lo usa como `amount` y como `remainingAmount`; el importe original se conserva aparte como `totalAmount`. Esta es la semantica adecuada para calcular deuda pendiente.

La UI transforma y agrupa facturas por nombre normalizado de compania. Las filas con estado `paid` no aportan deuda abierta; las fechas vencidas pueden convertirse automaticamente a `overdue`. En el perfil, `totalDebt` suma `amount` de filas no pagadas y `totalOverdue` suma `amount` de filas con estado overdue. Si el conjunto de facturas esta completo y cada fila conserva el saldo correcto, esas dos sumas representan el saldo pendiente y el overdue.

### Lo que muestra hoy

- El directorio presenta estado agregado, `Total Invoiced`, `Total Paid` y `Total Due`.
- El perfil abre desde la fila completa del directorio, no solo desde el texto del nombre.
- El perfil presenta tarjetas para total activo, total overdue, numero de invoices y agentes.
- La tabla de detalle presenta invoice, ciclo, estado y una columna `Amount`, mas la accion de editar.
- La UI intenta actualizar CMP por polling y Supabase Realtime.

## Hallazgos que deben corregirse

### P1 - Leer todas las filas CMP, no solo las primeras 1,000

**Evidencia:** `fetchCmpInvoices()` hace `select('*').order(...)` sin paginar. En la verificacion de esta revision, la base tenia 2,520 filas, mientras esa consulta devolvio 1,000. Es el limite por defecto configurado en PostgREST/Supabase para esta instancia.

**Impacto:** se omiten facturas mas antiguas, el `Total Due`/`Total Overdue` puede quedar subestimado, y `cmpInvoiceCount` informa la cantidad descargada por el navegador, no el total de la tabla. El orden descendente por fecha hace probable que queden fuera las facturas mas viejas, que son especialmente relevantes para overdue.

**Archivos:** `src/services/cmpInvoices.js`, `src/hooks/useDebtors.js`.

**Criterio de cierre:** paginacion por rangos hasta agotar resultados o lectura server-side; agregar prueba con mas de 1,000 registros; verificar que el total leido coincide con un `count exact` sin duplicados.

### P1 - Aplicar permisos de agente en la base, no solo en React

**Evidencia:** `supabase/cmp_invoices.sql` tiene politica de lectura `to authenticated using (true)`. El frontend consulta todas las facturas CMP y despues filtra `accessibleData` localmente mediante `src/constants/accessControl.js`.

**Impacto:** un usuario autenticado puede consultar directamente las filas de otras companias/agentes con la clave publica de Supabase. La ocultacion en el dashboard no protege los datos.

**Archivos:** `supabase/cmp_invoices.sql`, `src/constants/accessControl.js`, `src/hooks/useDebtors.js`, `src/services/cmpInvoices.js`.

**Estado (F3 preparado, aun no activado):** existe migracion `20261112213000_cmp_agent_rls.sql` para `agent_scopes`, lectura de invoices y PDFs; el bootstrap ya no crea policies de lectura global. El extractor agrega el `agent_id` de `Client BY agent` y las asignaciones en conflicto quedan sin agente. Falta provisionar los scopes privados, probar RLS agente/manager contra Postgres local y recien entonces decidir la aplicacion remota. La lectura de filas antiguas sin `agent_id` queda solo para manager hasta que una corrida valide y actualice esas filas.

**Criterio de cierre:** probar que una cuenta agente no puede leer otra cartera via tabla o Storage, que un usuario sin scope ve cero filas y que un manager ve todo; aplicar migraciones en el entorno aprobado y verificar asignaciones reales.

### P1 - Mostrar saldo restante en el detalle de invoice

**Evidencia:** el perfil suma `item.amount` para deuda, pero la tabla renderiza `item.totalAmount || item.amount` bajo el encabezado `Amount`.

**Impacto:** una invoice parcialmente pagada muestra el importe original en la tabla, aunque el resumen indica el saldo pendiente. El usuario no puede reconciliar las cifras rapidamente.

**Archivos:** `src/App.jsx`, `src/components/CompanyProfileModal.jsx`.

**Criterio de cierre:** mostrar columnas distintas `Invoice total`, `Paid` y `Balance due`; el balance debe usar `remainingAmount` con fallback explicito y cuadrar con las tarjetas de resumen.

### P1 - Calcular correctamente Total Invoiced y Total Paid

**Evidencia:** `aggregateByCompany()` acumula `row.amount` como `totalInvoiced`; para CMP ese campo representa remaining balance. `totalPaid` solo aumenta si el status completo es `paid`, ignorando `row.totalPaid` en pagos parciales.

**Impacto:** el directorio presenta cifras equivocadas para facturas parcialmente pagadas, aunque `Total Due` individual pueda estar bien.

**Archivos:** `src/hooks/useDebtors.js`, `src/services/cmpMerge.js`, `src/components/CompanyDirectory.jsx`.

**Criterio de cierre:** calcular separadamente `totalInvoiced = total_amount`, `totalPaid = total_paid` y `totalDue = remaining_amount` (con fallback para registros Zoho/manuales); probar invoice abierta, parcial, pagada y combinacion con varios overdue.

### P1 - Reconciliar el snapshot actual sin destruir el historial

**Evidencia:** el ingest anterior solo hacia upsert, por lo que invoices que ya no aparecen podian seguir vigentes indefinidamente.

**Impacto:** si una invoice deja de aparecer en el scrape o cambia a un estado que no se carga, la fila antigua puede seguir contando como abierta/overdue. Al mismo tiempo, borrar filas de forma global seria riesgoso si el scrape fue parcial o fallo.

**Archivos:** `server/cmpIngest.cjs`, `lib/cmpIngest.js`, `automation/cmp_invoice_extractor.py`.

**Estado F4 implementado en codigo:** la migracion `20261112214000_cmp_snapshot_reconciliation.sql` agrega/asegura las columnas y `cmp_sync_runs`; `apply_cmp_sync_run` upsertea y reconcilia en una sola transaccion, registra status/coverage y ofrece `p_dry_run`. La reconciliacion exige complete, no truncated, filas > 0, ratio minimo y limita la cobertura a agentes del run y saldos abiertos o facturas pagadas desde cutoff. Usa `is_current`/`closed_at`; no contiene `DELETE`. El cliente cuenta y lee solo `is_current = true`.

**Validacion pendiente:** prueba SQL agregada en `supabase/tests/cmp_snapshot_reconciliation.sql`, pero no ejecutada porque este entorno no tiene `psql`, Supabase CLI ni Docker engine. No se aplico la migracion remota. Ejecutar el test contra una base local antes de aplicar en Supabase.

### P1 - Aplicar migracion versionada para las columnas financieras

**Evidencia:** el ingest escribe `total_amount`, `remaining_amount`, `total_paid` y `billing_type`; `supabase/cmp_invoices.sql` solo declara `amount`, fechas, status y campos PDF. En la base remota consultada durante esta revision las cuatro columnas extendidas si existen, por lo que el entorno actual tiene cambios manuales no reflejados en el SQL del repo.

**Impacto:** una instalacion nueva que ejecute solo el SQL versionado puede fallar al insertar el snapshot CMP.

**Archivo:** `supabase/cmp_invoices.sql`.

**Criterio de cierre:** agregar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para todos los campos que el ingest/frontend consumen y probar bootstrap desde una base limpia.

### P1 - Cerrar por defecto el endpoint privilegiado de ingest

**Evidencia:** `verifyCmpIngestSecret()` devuelve `true` si `CMP_INGEST_SECRET` esta vacio. El backend local escucha en `0.0.0.0`; la ruta de ingest escribe en Supabase usando service role. El `.env.example` llama opcional al secreto.

**Impacto:** una configuracion incompleta puede permitir escrituras no autenticadas a traves de un endpoint con privilegios elevados, especialmente si el servidor es accesible desde la red local.

**Archivos:** `server/cmpIngest.cjs`, `lib/cmpIngest.js`, `server/server.js`, `.env.example`, `server/.env.example`.

**Criterio de cierre:** si falta el secreto, rechazar ingest y no iniciar el runner; exigir secreto fuerte tanto local como en serverless; limitar CORS/bind a loopback en el modo local; probar requests sin token, token incorrecto y token valido.

### P1 - Definir el significado de la ventana temporal del scrape

**Evidencia:** `fast` cubre 15 dias, `normal` 120 y `deep` 365. El extractor excluye invoices por fecha de factura anterior al corte.

**Impacto:** un saldo todavia pendiente con invoice date mas antigua que la ventana puede no reaparecer en el snapshot. Si se necesita deuda abierta de cualquier antiguedad, una ventana basada solo en invoice date puede omitir justo el overdue mas viejo.

**Archivos:** `server/cmpRunner.js`, `automation/cmp_invoice_extractor.py`.

**Estado F4 implementado:** D1 confirmado: invoices con saldo > 0 o estado no pagado se conservan aunque sean antiguas; la ventana por `invoice_date` descarta solo pagadas cerradas. Un fin natural de paginacion reporta `complete`; llegar a `CMP_MAX_PAGES` reporta `truncated`; error de paginacion reporta `incomplete`. No se usa la parada temprana por antiguedad porque el orden CMP no es confiable.

**Riesgo operativo:** los limites fast/normal/deep siguen siendo 5/100/250 paginas. Si no se llega al fin real, el run se persiste como truncado/incompleto y no reconcilia; aumentar max pages o hacer una corrida deep puede ser necesario para cubrir todas las facturas abiertas.

### P2 - Corregir orden y filtros del perfil de compania

**Evidencia:** `companyProfile` limita filas por `selectedWeek` y luego ordena facturas alfanumericamente por numero. Las invoices CMP usan `weekLabel: 'CMP'`.

**Impacto:** un filtro semanal puede ocultar CMP y el perfil no presenta necesariamente las facturas mas recientes primero.

**Archivos:** `src/App.jsx`, `src/components/CompanyProfileModal.jsx`.

**Criterio de cierre:** ordenar por `invoiceDate` descendente, fallback `dueDate`/`syncedAt`; mostrar fecha de factura y vencimiento; decidir explicitamente si perfil ignora semana seleccionada o comunica el filtro aplicado.

### P2 - Corregir indicador de status viejo del runner

**Evidencia:** `cmpRunner.js` mezcla el estado de proceso en memoria con `automation/cmp_status.json` y conserva phase/error anteriores cuando inicia un servidor nuevo. Ya se observo un error Selenium antiguo persistiendo despues de reiniciar el backend.

**Impacto:** la UI puede mostrar un error que pertenece a una ejecucion anterior y confundir el diagnostico actual.

**Archivos:** `server/cmpRunner.js`, `automation/cmp_status.json`, `src/components/CmpSyncPanel.jsx`.

**Criterio de cierre:** asociar status/log con `run_id`; al iniciar una ejecucion nueva limpiar el error previo; exponer `last_successful_sync` y `last_run_error` como valores separados; ignorar estados demasiado antiguos.

### P2 - Mantener sincronizados esquema, guia y comportamiento real

**Evidencia:** `README.md` y `automation/README.md` dicen que el scrape reemplaza la tabla, pero el ingest hace upsert y preserva historico. Las guias tambien mencionan aproximadamente 60 dias mientras el runner permite 15/120/365.

**Impacto:** quien opera el bot no puede saber si el resultado esperado es snapshot o historico, ni cuanto historial se captura realmente.

**Archivos:** `README.md`, `automation/README.md`, `server/cmpIngest.cjs`, `server/cmpRunner.js`.

**Criterio de cierre:** documentar la estrategia vigente (historial vs snapshot), profundidad seleccionada, momento de persistencia y recuperacion ante scrape parcial.

### P2 - Agregar pruebas de negocio y flujo CMP

**Evidencia:** las pruebas automatizadas encontradas en `src` cubren normalizacion y utilidades monetarias. `server/package.json` no tiene suite real de pruebas.

**Pruebas necesarias:** paginacion Supabase >1,000 filas; importe total/paid/remaining; suma de multiples overdue; deduplicacion CMP/Zoho; click y perfil de compania con fechas ordenadas; RLS por agente/manager; rechazo de ingest sin secreto; migracion desde esquema limpio; y que un scrape incompleto no marque snapshot como vigente.

## Backlog recomendado

1. P1: paginar la lectura CMP completa; mostrar metricas que no se trunquen.
2. P1: corregir modelo financiero agregado y detalle invoice (original/paid/balance).
3. P1: proteger lectura por agente en RLS/API y cerrar ingest fail-open.
4. P1: implementar snapshot vigente/reconciliacion con proteccion contra scrape parcial.
5. P1: versionar todas las columnas requeridas por la ingest.
6. P1: acordar cobertura de invoices abiertas antiguas frente a ventanas 15/120/365.
7. P2: ordenar por fechas, quitar filtros inesperados del perfil y mejorar status del runner.
8. P2: agregar pruebas de regresion de importes, permisos y sync.
9. P2: corregir README y guia de automatizacion tras adoptar la politica de snapshot/historial.

## Estado observado y limites de esta revision

- Frontend local: `http://localhost:5173/` respondio HTTP 200.
- Backend local: `http://localhost:3001/api/health` respondio correctamente y reporto configuracion Supabase presente.
- CMP: activo durante la revision; ultima lectura observada pagina 39 y 975 facturas, sin error en ese instante. El resultado final del run no se verifico aqui.
- Datos Supabase: lectura de conteo no destructiva; 2,520 filas `cmp_invoices`, lectura normal del frontend limitada a 1,000.
- Esquema remoto: las columnas financieras extendidas existen en este proyecto; el SQL versionado no las declara.
- No se ejecutaron syncs adicionales, no se cambio codigo de aplicacion y no se editaron ni borraron archivos locales preexistentes. Los dos documentos creados para la revision son este informe y el registro vivo `progress.md`.
- El compromiso y publicacion de esta documentacion se registra en `progress.md`; las correcciones funcionales quedan pendientes de acordar con Andres.

## Validacion de cierre del roadmap

- [ ] El dashboard lee todas las filas CMP y reporta cantidad total precisa.
- [ ] `Total Invoiced`, `Total Paid`, `Total Due` y `Total Overdue` se concilian con facturas de CMP.
- [ ] El detalle abre desde la compania y lista invoices recientes primero, mostrando invoice date, due date, status, importe original, pago y saldo.
- [ ] La cuenta agente no puede consultar datos CMP de otras carteras desde la API/Supabase.
- [ ] Un scrape incompleto no sustituye ni invalida snapshot vigente.
- [ ] Una instalacion nueva puede crear el esquema y completar ingest sin SQL manual adicional.
- [ ] Suite de pruebas cubre calculos, permisos, paginacion y reconciliacion.
