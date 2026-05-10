# CMP Invoice Extractor

Automatiza la extracción de:

- `Invoice #`
- `Total Amount`

desde CMP para una lista de clientes y genera un archivo `invoices_actualizados.json`.

## Qué hace

1. Abre CMP
2. Hace login con Selenium
3. Va a `/company`
4. Busca cliente por cliente
5. Entra al perfil
6. Abre la pestaña `Invoices`
7. Busca la factura más reciente disponible
8. Exporta resultados a JSON

## Requisitos

```bash
pip install -r automation/requirements.txt
```

## Archivo de entrada

Usa un CSV o JSON con estas columnas:

- `client_name`
- `billing_cycle`

Ejemplo:

```csv
client_name,billing_cycle
ACME TRUCKING LLC,Tuesday
NOVA VERSE INC,Friday
```

## Variables de entorno

### Opción 1: login automático

```powershell
$env:CMP_EMAIL="tu_correo"
$env:CMP_PASSWORD="tu_password"
```

### Opción 2: login manual

No definas `CMP_EMAIL` ni `CMP_PASSWORD`.  
El script abrirá CMP y esperará a que entres manualmente.

## Opcionales útiles

```powershell
$env:CMP_HEADLESS="false"
$env:CMP_TIMEOUT="25"
$env:CMP_OUTPUT_JSON="automation\\invoices_actualizados.json"
$env:CMP_INPUT_FILE="automation\\clients.example.csv"
```

Si quieres reutilizar tu sesión de Chrome:

```powershell
$env:CMP_USER_DATA_DIR="C:\\Users\\AndresMendez\\AppData\\Local\\Google\\Chrome\\User Data"
$env:CMP_PROFILE_DIR="Default"
```

## Ejecución

```bash
python automation/cmp_invoice_extractor.py automation/clients.example.csv
```

O con JSON:

```bash
python automation/cmp_invoice_extractor.py automation/clientes.json
```

## Salida

Genera una lista JSON como esta:

```json
[
  {
    "client_name": "Nombre Cliente",
    "billing_cycle": "Tuesday",
    "invoice_id": "INV-12345",
    "amount": "1234.56",
    "status": "Captured",
    "last_update": "2026-05-09",
    "invoice_status": "Paid"
  }
]
```

## Logging y screenshots

- Log: `cmp_invoice_extractor.log`
- Capturas de error: carpeta `cmp_screenshots`

## Nota importante

Este script ya viene modular y robusto, pero los selectores de CMP pueden cambiar.  
Si algún botón, tabla o tab no coincide exactamente, ajusta:

- `SELECTORS.search_inputs`
- `SELECTORS.invoice_tab_xpaths`
- `SELECTORS.table_selectors`

en [automation/cmp_invoice_extractor.py](C:/Users/AndresMendez/Downloads/Debors-main/Debors/automation/cmp_invoice_extractor.py).

## Recomendación práctica

La mejor forma de estabilizarlo rápido es:

1. correrlo con 2 o 3 clientes
2. confirmar que encuentra bien `Invoices`
3. ajustar selectores si hace falta
4. luego escalar a los 144 clientes
