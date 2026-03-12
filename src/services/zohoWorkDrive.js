import Papa from 'papaparse';

// Este es un enlace de ejemplo. Para funcionar, el usuario debe abrir su Google Sheet, 
// ir a Archivo > Compartir > Publicar en la Web > Seleccionar "Toda la hoja" o la pestaña específica como "CVS" (Valores Separados por Comas).
// Luego pegar ese link aquí.

// Ejemplo de hoja pública:
// Columnas esperadas: id, clientName, amount, dueDate, status, agentId, notes
const SHEET_CSV_URL = 'https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b'; // Enlace de Zoho del usuario

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildCsvUrl = (url, cacheBust) => {
  if (!cacheBust) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

export const fetchDebtorsFromSheet = async (url = SHEET_CSV_URL, options = {}) => {
    const { cacheBust = true } = options;
    if (!url) {
        throw new Error("No URL provided");
    }

    const csvUrl = buildCsvUrl(url, cacheBust);

    return new Promise((resolve, reject) => {
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim().toLowerCase(),
            complete: (results) => {
                // Mapeo adaptado a las columnas específicas de la imagen proporcionada (en minúsculas)
                const mappedData = results.data
                    .filter(row => row['invoice number'] || row.id || row['company name'] || row.clientname) // Filtrar filas vacías
                    .map(row => ({
                        id: normalizeText(row['invoice number'] || row.id, `INV-${Math.floor(Math.random() * 10000)}`),
                        clientName: normalizeText(row['company name'] || row.clientname, 'Desconocido'),
                        amount: normalizeAmount(row['total due ($)'] ?? row.amount),
                        dueDate: normalizeDate(row.duedate || row['due date'] || row.due_date),
                        status: normalizeText(row['payment status'] || row.status, 'pending').toLowerCase(),
                        agentId: normalizeText(row['sales rep'] || row.agentid, 'Sin Asignar'),
                        notes: normalizeText(row.notes)
                    }));

                resolve(mappedData);
            },
            error: (error) => {
                console.error("Error parsing CSV:", error);
                reject(error);
            }
        });
    });
};
