import Papa from 'papaparse';

const SHEET_CSV_URL = 'https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b'; // Enlace de Zoho del usuario
const CS_BY_AGENT_CSV_URL = '';

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

const mapPaymentStatus = (value, dueDate) => {
  const rawStatus = normalizeText(value, 'pending').toLowerCase();

  if (['paid', 'pagado', 'cobrado'].includes(rawStatus)) {
    return 'paid';
  }

  if (['overdue', 'mora', 'vencido'].includes(rawStatus)) {
    return 'overdue';
  }

  if (dueDate) {
    const parsedDate = new Date(`${dueDate}T00:00:00`);
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!Number.isNaN(parsedDate.getTime()) && parsedDate < dayStart) {
      return 'overdue';
    }
  }

  return 'pending';
};

const parseBoolean = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  return ['true', 'yes', 'y', '1', 'checked', 'done', 'x'].includes(normalized);
};

const normalizeDebtFlag = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  if (['no debt', 'without debt', 'clear', 'no', 'paid', 'al dia', 'al día'].includes(normalized)) return false;
  if (['debt', 'has debt', 'pending', 'overdue', 'yes', 'mora'].includes(normalized)) return true;
  return null;
};

const mapDebtorRow = (row) => {
  const company = normalizeText(row['company name'] || row.company || row.clientname, 'Unknown Company');
  const dueDate = normalizeDate(row.duedate || row['due date'] || row.due_date || row['billing cycle'] || row.billingcycle);

  return {
    id: normalizeText(row['invoice number'] || row.id, `INV-${Math.floor(Math.random() * 10000)}`),
    invoiceNumber: normalizeText(row['invoice number'] || row.id),
    company,
    clientName: company,
    contactPerson: normalizeText(row['contact person'] || row.contact || row.contactperson),
    agentId: normalizeText(row['sales rep'] || row.agentid || row.agent, 'Unassigned'),
    billingCycle: normalizeText(row['billing cycle'] || row.billingcycle),
    amount: normalizeAmount(row['total due ($)'] ?? row.amount ?? row.totaldue),
    dueDate,
    status: mapPaymentStatus(row['payment status'] || row.status, dueDate),
    notes: normalizeText(row.notes)
  };
};

export const fetchDebtorsFromSheet = async (url = SHEET_CSV_URL, options = {}) => {
  const { cacheBust = true } = options;
  if (!url) {
    throw new Error('No URL provided');
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
        const mappedData = results.data
          .filter((row) => row['invoice number'] || row.id || row['company name'] || row.clientname)
          .map(mapDebtorRow);

        resolve(mappedData);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        reject(error);
      }
    });
  });
};

export const fetchClientsByAgentFromSheet = async (url = CS_BY_AGENT_CSV_URL, options = {}) => {
  const { cacheBust = true } = options;
  if (!url) {
    return [];
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
        const mappedData = results.data
          .filter((row) => row['sales rep'] || row.agentid || row['company name'] || row.clientname)
          .map((row) => ({
            agentId: normalizeText(row['sales rep'] || row.agentid || row.agent, 'Unassigned'),
            company: normalizeText(row['company name'] || row.company || row.clientname, 'Unknown Company'),
            debtStatus: normalizeText(row['debt status'] || row.status),
            hasDebt: normalizeDebtFlag(row['debt status'] || row.status),
            checked: parseBoolean(row.checked)
          }));

        resolve(mappedData);
      },
      error: (error) => {
        console.error('Error parsing clients by agent CSV:', error);
        reject(error);
      }
    });
  });
};
