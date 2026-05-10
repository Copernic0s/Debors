# CMP Invoice Extractor

Automatiza la extracción de:

- `Invoice #`
- `Total Amount`

desde CMP para alimentar Debors sin depender de la actualización manual.

## Qué hace esta versión

1. Abre CMP
2. Reutiliza tu sesión de Chrome o hace login
3. Va a `Customer Services > Companies`
4. Busca compañía por compañía
5. Entra al detalle
6. Abre la pestaña `Invoices`
7. Hace scroll horizontal dentro de la tabla
8. Toma la **primera fila** como la factura más reciente
9. Extrae:
   - `invoice_id`
   - `amount` desde la columna `Total amount`
10. Exporta `invoices_actualizados.json`

## Fuente de clientes

Por defecto el script usa directamente la hoja:

- `CS by Agent`

del workbook público de Debtors.

No necesitas mantener un CSV aparte si no quieres.

## Instalación

```bash
pip install -r automation/requirements.txt
```

## Variables de entorno

### Reutilizar sesión de Chrome

```powershell
$env:CMP_USER_DATA_DIR="C:\\Users\\AndresMendez\\AppData\\Local\\Google\\Chrome\\User Data"
$env:CMP_PROFILE_DIR="Default"
```

### Login manual

Si no defines `CMP_EMAIL` y `CMP_PASSWORD`, el script abrirá CMP y esperará a que tú ya tengas sesión disponible.

### Login automático opcional

```powershell
$env:CMP_EMAIL="tu_correo"
$env:CMP_PASSWORD="tu_password"
```

### Configuración útil

```powershell
$env:CMP_HEADLESS="false"
$env:CMP_TIMEOUT="25"
$env:CMP_OUTPUT_JSON="automation\\invoices_actualizados.json"
$env:CMP_INPUT_MODE="zoho_sheet"
$env:CMP_ZOHO_SHEET_NAME="CS by Agent"
```

### Correr en segundo plano

```powershell
$env:CMP_HEADLESS="true"
```

Mi recomendación:

1. primero visible
2. luego headless

## Modos de entrada

### Modo recomendado: hoja Zoho

```powershell
$env:CMP_INPUT_MODE="zoho_sheet"
python automation/cmp_invoice_extractor.py
```

### Modo archivo local

```powershell
$env:CMP_INPUT_MODE="file"
python automation/cmp_invoice_extractor.py automation/clients.example.csv
```

## Archivo local de ejemplo

```csv
client_name,billing_cycle
ACME TRUCKING LLC,Tuesday
NOVA VERSE INC,Friday
GOLD STAR TRANSPORT LLC,Tuesday
```

## Salida esperada

```json
[
  {
    "client_name": "ROBERTIK TRUCKING LLC",
    "billing_cycle": "Tuesday",
    "invoice_id": "INV-355522",
    "amount": "84.12",
    "status": "Captured",
    "last_update": "2026-05-09",
    "invoice_status": "PAID"
  }
]
```

## Logs y debugging

- Log: `cmp_invoice_extractor.log`
- Screenshots de error: `cmp_screenshots`

## Nota importante

Esta versión ya está adaptada al flujo que me compartiste, pero puede requerir ajustes finos si CMP cambia:

- `SELECTORS.search_inputs`
- `SELECTORS.invoice_tab_xpaths`
- `SELECTORS.table_selectors`

Archivo:
[C:\Users\AndresMendez\Downloads\Debors-main\Debors\automation\cmp_invoice_extractor.py](C:\Users\AndresMendez\Downloads\Debors-main\Debors\automation\cmp_invoice_extractor.py)

## Siguiente paso recomendado

1. probar con 2 o 3 compañías
2. confirmar que encuentra bien `Invoices`
3. confirmar que el scroll horizontal alcanza `Total amount`
4. después escalar a toda la hoja `CS by Agent`

## Futuro cercano

Cuando este snapshot actual quede estable, el siguiente paso es extenderlo a:

- histórico desde octubre 2025
- recorrido por paginación
- captura de múltiples invoices por compañía
