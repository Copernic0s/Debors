# CMP Dashboard: Data Freshness Analysis

**Estado:** el dashboard sigue mostrando datos que el usuario considera desactualizados. El arreglo anterior quitó la dependencia de Zoho para cargar CMP, pero no aumentó la cobertura del scraper ni demuestra que una factura concreta aparezca correctamente en la pantalla. Este documento separa los hechos confirmados de lo que falta comprobar.

## Resumen Ejecutivo

La explicación más fuerte, confirmada en producción, es **cobertura parcial del scrape**:

- La tabla tiene 4,260 facturas actuales.
- El último run registrado, `01fe7c97-0239-4e6d-94d4-5fa2c7ee85fb`, fue Fast: 20 páginas, 351 filas, `incomplete`, `truncated=true`, sin reconciliación.
- Solo 351 filas tienen ese `sync_run_id`; el run no refrescó las otras 3,909 filas.
- De las filas actuales, 2,022 tienen `synced_at` de hace más de 72 horas.

Por diseño, un run incompleto guarda las filas que alcanzó a leer pero **no** marca las no vistas como cerradas. La tabla resultante mezcla filas recién observadas con filas antiguas que siguen `is_current=true`. Por eso “vigente” no significa “verificada hoy”. El indicador global de última carga tampoco garantiza que cada factura haya sido revisada.

Esto explica que parte del listado siga viejo. No basta, sin embargo, para explicar un caso en que una de las 351 facturas actualizadas en el run siga mostrando un valor anterior. Para ese caso hay que comparar el mismo número de factura en base de datos, respuesta HTTP de Supabase y UI.

## Evidencia Confirmada

### Base de datos de producción

Consultas read-only ejecutadas contra `etffmaakaefrygfomgen` el 2026-11-18:

| Dato | Resultado |
|---|---:|
| Filas en `cmp_invoices` | 4,260 |
| Filas `is_current=true` | 4,260 |
| Filas con `agent_id` | 2,238 |
| Filas sincronizadas en últimas 24 h | 2,234 |
| Filas sincronizadas en últimas 72 h | 2,238 |
| Filas sin sync en más de 72 h | 2,022 |
| Filas con run ID `01fe7c97-0239-4e6d-94d4-5fa2c7ee85fb` | 351 |

El run anterior `fc8ac8ca-ccba-4928-adf1-2d669dbbd6ec` también terminó Fast, 20 páginas, 351 filas, incompleto/truncado y sin reconciliación. Los runs Standard anteriores llegaron al límite de páginas y también quedaron incompletos. No deben tratarse como inventarios completos.

La policy remota `cmp_invoices_read_authenticated` permanece activa con `USING (true)`. `agent_scopes` está vacía. Esto no demuestra que la sesión del navegador tenga un JWT `authenticated` válido, pero sí descarta que se haya activado el aislamiento por cartera como parte de este arreglo. No se cambió ninguna policy.

### Despliegue y código

- Vercel deployment `dpl_MYxAeG67ygYSH9dhjCSzJ8Jek7RT` está `READY`, con alias `https://debors.vercel.app`; el HTML y el bundle devuelven HTTP 200.
- Ese bundle contiene el cambio que consulta Zoho y CMP en paralelo. Por tanto, una publicación que no contuviera el arreglo anterior no es la explicación principal actual.
- La app consulta CMP directamente desde el navegador mediante `fetchCmpInvoices`, con filtro `is_current=true` y paginación por rangos de 1,000 ([`src/services/cmpInvoices.js`](../src/services/cmpInvoices.js)).
- El dashboard combina CMP con Zoho/WorkDrive y después agrupa por compañía ([`src/hooks/useDebtors.js`](../src/hooks/useDebtors.js), [`src/services/cmpMerge.js`](../src/services/cmpMerge.js)). Facturas únicas que solo existen en Zoho se conservan; ajustes manuales también se aplican después.
- CMP se carga ahora aunque Zoho falle, pero esto corrige disponibilidad de fuente, no actualidad de las filas que el scraper no visitó.

## Por Qué Fast No Actualiza Todo

El runner configura Fast con `historyDays=15` y `maxPages=20` ([`server/cmpRunner.js`](../server/cmpRunner.js)). El extractor conserva saldos abiertos de cualquier antigüedad, pero su ventana de pagadas usa fecha de factura. El extractor no guarda actualmente `last payment date`; por tanto, un pago ocurrido hoy sobre una factura emitida hace meses puede quedar fuera del tramo priorizado.

El run `01fe...` llegó a `max_pages`: la aplicación reportó 351 filas y `truncated=true`. Ingest hace upsert solo de lo que vio. La reconciliación exige run completo, no truncado, no vacío y ratio mínimo; esta guarda funcionó correctamente y evitó cerrar filas no observadas. Ver [`supabase/migrations/20261112214000_cmp_snapshot_reconciliation.sql`](../supabase/migrations/20261112214000_cmp_snapshot_reconciliation.sql).

**Implicación:** seguir lanzando Fast no convierte los 4,260 registros en un snapshot nuevo. Repetir el mismo recorrido puede volver a tocar las mismas páginas y filas.

## Hipótesis Restantes

| Síntoma comprobado | Causa probable | Comprobación decisiva |
|---|---|---|
| La factura no está dentro de las 351 filas del último run y DB también muestra `synced_at` viejo | Cobertura insuficiente / Fast no cubrió la factura | Comparar `sync_run_id`, `synced_at` e invoice ID en Supabase |
| DB tiene valor reciente, pero respuesta REST devuelve 401/403/0 filas | Sesión, proyecto/anon config o permisos efectivos de esa sesión | DevTools Network: request a `/rest/v1/cmp_invoices`, status y body sin tokens |
| DB y respuesta REST tienen el valor nuevo, pero el Debtors List muestra valor viejo | Fusión/agrupación, Zoho duplicate, override manual, filtro de semana/estado o estado React | Comparar el invoice ID y company key antes y después de `mergeZohoWithCmpRows` / `aggregateByCompany` |
| `Invoices loaded` queda 0/0 o `Last CMP upload` en blanco | Lectura de CMP no ocurrió o falló; el mensaje de error desplegado debe mostrar el motivo | Revisar el error visible y Network; no asumir que el scrape falló |
| DB tiene la fila nueva y CMP panel marca carga reciente, pero Overview conserva total anterior | La tabla puede estar usando una fila Zoho distinta o una compañía agregada con otras facturas viejas | Revisar todas las facturas de esa compañía, no solo el total agregado |

## Verificación Controlada

No lanzar otro scrape ni aplicar SQL remoto durante esta comprobación. Elegir **una compañía y un invoice number concreto** cuyo pago/estado se haya modificado recientemente. No usar ni compartir números completos de tarjeta, JWT, anon key, service key ni capturas con credenciales.

1. En Supabase SQL Editor, ejecutar una consulta de solo lectura sustituyendo el invoice number por el caso elegido:

   ```sql
   select id, invoice_number, company_name, status,
          total_amount, remaining_amount, total_paid,
          invoice_date, due_date, synced_at, sync_run_id, is_current
   from public.cmp_invoices
   where invoice_number = '<INVOICE_NUMBER>'
   order by synced_at desc;
   ```

2. Anotar solo invoice number parcialmente enmascarado, `status`, importes, `synced_at` y `sync_run_id`.
3. En el navegador de producción, abrir DevTools → Network, recargar con Ctrl+Shift+R y filtrar `rest/v1/cmp_invoices`.
4. Confirmar respuesta HTTP y buscar la misma factura en el JSON. **No copiar los request headers**: contienen credenciales de sesión.
5. En UI, comparar invoice number, status, total due y compañía. Revisar que filtros de agente, estado y semana estén en “todos”. El perfil Andrés debe resolver como manager (`canViewAllData=true`) con el código desplegado.
6. Decidir por la tabla de hipótesis anterior. La ubicación donde cambia el valor identifica la capa responsable.

## Corrección Recomendada Según Resultado

### Si DB está vieja

No repetir Fast sin cambiar cobertura. Para lograr actualidad de pagos y saldos:

- Validar si CMP permite filtrar por saldo/estado abierto. Si existe, diseñar un modo `open` que recorra **todas** las facturas con saldo positivo, sin ventana por fecha de emisión.
- Leer y persistir `last payment date`; usarla para seleccionar pagos recientes en facturas cerradas antiguas. Hoy el extractor y esquema no la guardan.
- Medir páginas reales y registros crudos por página. El límite debe cubrir el conjunto de facturas abiertas más la ventana de pagos, no una cantidad arbitraria de 20 páginas.
- Mantener `status=incomplete/truncated` y cero reconciliación si no cubre todo el alcance. Los upserts parciales pueden seguir siendo útiles, pero el dashboard debe indicar que la frescura es parcial y por alcance.
- Separar métricas por cobertura: timestamp global de último run, filas observadas en ese run, filas del alcance sin refrescar, y último sync por factura/compañía. No llamar “last upload” a un sello que implica cobertura completa.

### Si DB está nueva pero UI no

- Si REST no devuelve filas: inspeccionar URL de proyecto usada por el bundle, usuario autenticado actual, HTTP status/body y policy efectiva. No abrir RLS como workaround; la policy abierta ya existe en producción.
- Si REST sí devuelve el valor nuevo: añadir/ejecutar una prueba de integración para la fusión con un invoice de la misma empresa y verificar que `synced_at`/`sync_run_id` lleguen a `rawZohoData`, `accessibleData` y al agregado.
- Revisar `manual_edits` solo para la factura de prueba: el merge manual puede reemplazar campos por llave compañía+invoice.
- Revisar filas Zoho con el mismo invoice normalizado. La fusión descarta duplicados Zoho solo cuando coincide compañía normalizada + invoice normalizado; variantes de nombre o invoice pueden dejar filas viejas como únicas.
- Confirmar filtros activos: semana, estado y agente. CMP usa `weekLabel='CMP'`; selección de semana distinta puede excluirlo.

## Riesgos / No Hacer

- No ejecutar otro Fast esperando que revise automáticamente las 4,260 filas.
- No aumentar `max_pages` a ciegas: eso puede tardar horas y aun así no seleccionar pagos recientes de invoices antiguas si CMP ordena por fecha de factura.
- No reconciliar runs incompletos/truncados; no borrar filas CMP.
- No alterar policies ni volver a aplicar migraciones para corregir un problema de frescura.
- No inferir que `is_current=true` significa actualizado recientemente.
- No exponer `.env`, tokens ni credenciales de Supabase en logs, capturas o mensajes.

## Siguiente Paso

La acción que destraba el diagnóstico es comparar **un invoice de control** en tres puntos: fila Supabase, respuesta REST autenticada y valor visible en Debtors List. La evidencia agregada ya señala cobertura parcial como causa confirmada para las filas no visitadas; ese control determina si además hay un defecto de lectura/fusión en las filas sí sincronizadas.
