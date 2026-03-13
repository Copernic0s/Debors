import * as XLSX from 'xlsx';
import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const SHEET_XLSX_URL = 'https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b?download=xlsx';
const CORS_PROXY_BUILDERS = [
  (targetUrl) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
  (targetUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
  (targetUrl) => targetUrl
];

const BILLING_PROFILE = {
  OWNER_A: 'owner_a',
  OWNER_B: 'owner_b',
  COMPANY_DUAL: 'company_dual'
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  let raw = String(value ?? '').trim();
  if (!raw) return 0;

  raw = raw.replace(/\$/g, '').replace(/\s/g, '');

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (hasComma) {
    if (/\d+,\d{1,2}$/.test(raw)) {
      raw = raw.replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  }

  raw = raw.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
};

const normalizeDate = (value) => {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }

  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildUrl = (url, cacheBust) => {
  if (!cacheBust) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

const normalizeStatus = (value, dueDate) => {
  const raw = normalizeText(value, 'pending').toLowerCase();

  if (raw.includes('partial')) {
    return 'pending';
  }

  if (raw.includes('paid') || raw.includes('pagado') || raw.includes('cobrado')) {
    return 'paid';
  }

  if (raw.includes('overdue') || raw.includes('mora') || raw.includes('vencido')) {
    return 'overdue';
  }

  if (raw.includes('pending')) {
    return 'pending';
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

const createLookup = (row) => {
  const lookup = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    lookup[String(key).trim().toLowerCase()] = value;
  });
  return lookup;
};

const parseSheetWeekStart = (sheetName) => {
  const raw = String(sheetName || '').trim();
  const match = raw.match(/^([A-Za-z]+)\s+(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;

  const [, monthName, startDay] = match;
  const currentYear = new Date().getFullYear();
  const parsed = new Date(`${monthName} ${startDay}, ${currentYear}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekdayInSheet = (sheetStartDate, targetWeekday) => {
  if (!sheetStartDate) return null;

  for (let i = 0; i <= 6; i += 1) {
    const current = new Date(sheetStartDate);
    current.setDate(sheetStartDate.getDate() + i);
    if (current.getDay() === targetWeekday) {
      return current;
    }
  }

  return null;
};

const inferBillingProfile = (billingCycleText) => {
  const normalized = normalizeBillingCycle(billingCycleText);

  if (normalized === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
    return BILLING_PROFILE.OWNER_B;
  }

  if (normalized === BILLING_CYCLES.TWICE) {
    return BILLING_PROFILE.COMPANY_DUAL;
  }

  if (normalized === BILLING_CYCLES.MONDAY_SUNDAY) {
    return BILLING_PROFILE.OWNER_A;
  }

  return BILLING_PROFILE.OWNER_A;
};

const inferDueDateFromCycle = (billingCycleText, sheetName) => {
  const profile = inferBillingProfile(billingCycleText);
  const weekStart = parseSheetWeekStart(sheetName);
  if (!weekStart) return '';

  if (profile === BILLING_PROFILE.OWNER_B) {
    const friday = getWeekdayInSheet(weekStart, 5);
    return friday ? toDateKey(friday) : '';
  }

  if (profile === BILLING_PROFILE.COMPANY_DUAL) {
    const normalized = normalizeBillingCycle(billingCycleText);
    if (normalized === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
      const friday = getWeekdayInSheet(weekStart, 5);
      return friday ? toDateKey(friday) : '';
    }
    const tuesday = getWeekdayInSheet(weekStart, 2);
    return tuesday ? toDateKey(tuesday) : '';
  }

  const tuesday = getWeekdayInSheet(weekStart, 2);
  return tuesday ? toDateKey(tuesday) : '';
};

const mapDebtorRow = (row, rowDisplay, sheetName, sheetOrder) => {
  const r = createLookup(row);
  const rd = createLookup(rowDisplay || {});
  const company = normalizeText(r['company name'] || r.company || r.clientname, 'Unknown Company');
  const billingCycle = normalizeBillingCycle(r['billing cycle'] || r.billingcycle || sheetName);
  const explicitDueDate = normalizeDate(r.duedate || r['due date'] || r.due_date);
  const dueDate = explicitDueDate || inferDueDateFromCycle(billingCycle, sheetName);

  const amountInput = rd['total due ($)']
    ?? rd.amount
    ?? rd.totaldue
    ?? r['total due ($)']
    ?? r.amount
    ?? r.totaldue;

  return {
    id: normalizeText(r['invoice number'] || r.id, `INV-${Math.floor(Math.random() * 100000)}`),
    invoiceNumber: normalizeText(r['invoice number'] || r.id),
    company,
    clientName: company,
    contactPerson: normalizeText(r['contact person'] || r.contact || r.contactperson),
    agentId: normalizeText(r['sales rep'] || r.agentid || r.agent, 'Unassigned'),
    billingCycle,
    amount: normalizeAmount(amountInput),
    dueDate,
    status: normalizeStatus(r['payment status'] || r.status, dueDate),
    notes: normalizeText(r.notes),
    weekLabel: sheetName,
    sourceSheetOrder: sheetOrder
  };
};

const consolidateDebtorRows = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const invoice = String(row.invoiceNumber || row.id || '').trim();
    const company = String(row.company || row.clientName || '').trim().toLowerCase();
    const key = invoice ? `${company}|${invoice.toLowerCase()}` : `${company}|row:${row.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, { ...row });
      return;
    }

    const current = grouped.get(key);

    if ((Number(row.amount) || 0) > (Number(current.amount) || 0)) {
      current.amount = Number(row.amount) || 0;
    }

    if ((Number(row.sourceSheetOrder) || 0) >= (Number(current.sourceSheetOrder) || 0)) {
      if (row.billingCycle) current.billingCycle = row.billingCycle;
      if (row.dueDate) current.dueDate = row.dueDate;
      if (row.agentId) current.agentId = row.agentId;
      if (row.weekLabel) current.weekLabel = row.weekLabel;
      current.sourceSheetOrder = row.sourceSheetOrder;
    }

    const statuses = [String(current.status || '').toLowerCase(), String(row.status || '').toLowerCase()];
    if (statuses.includes('overdue')) {
      current.status = 'overdue';
    } else if (statuses.includes('pending')) {
      current.status = 'pending';
    } else {
      current.status = 'paid';
    }
  });

  return Array.from(grouped.values()).map((item) => {
    const next = { ...item };
    delete next.sourceSheetOrder;
    return next;
  });
};

const mapCsByAgentRow = (row) => {
  const r = createLookup(row);
  return {
    agentId: normalizeText(r['sales rep'] || r.agentid || r.agent, 'Unassigned'),
    company: normalizeText(r['company name'] || r.company || r.clientname, 'Unknown Company'),
    debtStatus: normalizeText(r['debt status'] || r.status),
    hasDebt: normalizeDebtFlag(r['debt status'] || r.status),
    checked: parseBoolean(r.checked)
  };
};

const parseWorkbook = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const csSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'cs by agent');

  const debtors = workbook.SheetNames
    .filter((sheetName) => sheetName !== csSheetName)
    .flatMap((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];
      const rowsRaw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
      const rowsDisplay = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      return rowsRaw.map((row, rowIndex) => mapDebtorRow(row, rowsDisplay[rowIndex], sheetName, index));
    })
    .filter((item) => item.company);

  const consolidatedDebtors = consolidateDebtorRows(debtors);

  const clientsByAgent = csSheetName
    ? XLSX.utils.sheet_to_json(workbook.Sheets[csSheetName], { defval: '' }).map(mapCsByAgentRow)
    : [];

  return { debtors: consolidatedDebtors, clientsByAgent };
};

export const fetchAllDataFromSheet = async (url = SHEET_XLSX_URL, options = {}) => {
  const { cacheBust = true } = options;
  if (!url) throw new Error('No URL provided');

  const sourceUrl = buildUrl(url, cacheBust);
  let lastError = null;
  let response = null;

  for (const buildProxyUrl of CORS_PROXY_BUILDERS) {
    const requestUrl = buildProxyUrl(sourceUrl);
    try {
      response = await fetch(requestUrl);
      if (response.ok) {
        break;
      }
      lastError = new Error(`Proxy request failed (${response.status})`);
    } catch (error) {
      lastError = error;
    }
  }

  if (!response || !response.ok) {
    throw new Error(lastError?.message || 'Unable to download sheet data');
  }

  const arrayBuffer = await response.arrayBuffer();
  return parseWorkbook(arrayBuffer);
};

export const fetchDebtorsFromSheet = async (url = SHEET_XLSX_URL, options = {}) => {
  const { debtors } = await fetchAllDataFromSheet(url, options);
  return debtors;
};

export const fetchClientsByAgentFromSheet = async (url = SHEET_XLSX_URL, options = {}) => {
  const { clientsByAgent } = await fetchAllDataFromSheet(url, options);
  return clientsByAgent;
};
