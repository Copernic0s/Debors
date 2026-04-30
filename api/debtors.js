import * as XLSX from 'xlsx';

const SHEET_XLSX_URL = 'https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b?download=xlsx';

const BILLING_CYCLES = {
  MONDAY_SUNDAY: 'Monday - Sunday',
  THURSDAY_WEDNESDAY: 'Thursday - Wednesday',
  TWICE: 'Twice',
  UNSPECIFIED: 'Unspecified'
};

const BILLING_PROFILE = {
  OWNER_A: 'owner_a',
  OWNER_B: 'owner_b',
  COMPANY_DUAL: 'company_dual'
};

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeMatchKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|limited|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

const normalizeBillingCycle = (value) => {
  const raw = normalizeMatchKey(value);
  if (!raw || raw.includes('unspecified') || raw.includes('csbyagent')) return BILLING_CYCLES.UNSPECIFIED;
  if (raw.includes('thursday') || raw.includes('thu') || raw.includes('wednesday') || raw.includes('wed')) return BILLING_CYCLES.THURSDAY_WEDNESDAY;
  if (raw.includes('monday') || raw.includes('mon') || raw.includes('sunday') || raw.includes('sun')) return BILLING_CYCLES.MONDAY_SUNDAY;
  if (raw.includes('twice')) return BILLING_CYCLES.TWICE;
  return BILLING_CYCLES.UNSPECIFIED;
};

const normalizeAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2));

  let raw = String(value ?? '').trim();
  if (!raw) return 0;

  raw = raw.replace(/[$â‚¬Â£]/g, '').replace(/[\s\u00A0\u202F]/g, '').replace(/[^0-9,.-]/g, '');
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const sepIndex = Math.max(lastComma, lastDot);

  if (sepIndex === -1) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }

  const hasBoth = lastComma !== -1 && lastDot !== -1;
  const decPart = raw.slice(sepIndex + 1);
  const intPart = raw.slice(0, sepIndex);

  let normalized;
  if (!hasBoth && decPart.length === 3) {
    normalized = raw.replace(/[.,]/g, '');
  } else {
    const cleanInt = intPart.replace(/[.,]/g, '');
    normalized = `${cleanInt}.${decPart.replace(/[.,]/g, '')}`;
  }

  const parsed = Number.parseFloat(normalized);
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

const normalizeStatus = (value, dueDate) => {
  const raw = normalizeText(value, 'pending').toLowerCase();
  if (raw.includes('partial')) return 'pending';
  if (raw.includes('paid') || raw.includes('pagado') || raw.includes('cobrado')) return 'paid';
  if (raw.includes('overdue') || raw.includes('mora') || raw.includes('vencido')) return 'overdue';
  if (raw.includes('pending')) return 'pending';

  if (dueDate) {
    const parsedDate = new Date(`${dueDate}T00:00:00`);
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!Number.isNaN(parsedDate.getTime()) && parsedDate < dayStart) return 'overdue';
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
  if (['no debt', 'without debt', 'clear', 'no', 'paid', 'al dia', 'al dÃ­a'].includes(normalized)) return false;
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
  const match = raw.match(/^([A-Za-z]+)\s+(\d+)\s*[-\s]*(\d+)$/);
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
  for (let i = 0; i < 10; i += 1) {
    const current = new Date(sheetStartDate);
    current.setDate(sheetStartDate.getDate() + i);
    if (current.getDay() === targetWeekday) return current;
  }
  return null;
};

const inferBillingProfile = (billingCycleText) => {
  const normalized = normalizeBillingCycle(billingCycleText);
  if (normalized === BILLING_CYCLES.THURSDAY_WEDNESDAY) return BILLING_PROFILE.OWNER_B;
  if (normalized === BILLING_CYCLES.TWICE) return BILLING_PROFILE.COMPANY_DUAL;
  if (normalized === BILLING_CYCLES.MONDAY_SUNDAY) return BILLING_PROFILE.OWNER_A;
  return BILLING_PROFILE.OWNER_A;
};

const inferDueDateFromCycle = (billingCycleText, sheetName) => {
  const profile = inferBillingProfile(billingCycleText);
  const weekStart = parseSheetWeekStart(sheetName);
  if (!weekStart) return '';

  if (profile === BILLING_PROFILE.OWNER_A) {
    const nextTuesday = getWeekdayInSheet(weekStart, 2);
    if (nextTuesday) {
      const dayDiff = Math.floor((nextTuesday - weekStart) / (1000 * 60 * 60 * 24));
      if (dayDiff < 7) nextTuesday.setDate(nextTuesday.getDate() + 7);
      return toDateKey(nextTuesday);
    }
  }

  if (profile === BILLING_PROFILE.OWNER_B) {
    const nextFriday = getWeekdayInSheet(weekStart, 5);
    if (nextFriday) {
      const dayDiff = Math.floor((nextFriday - weekStart) / (1000 * 60 * 60 * 24));
      if (dayDiff < 7) nextFriday.setDate(nextFriday.getDate() + 7);
      return toDateKey(nextFriday);
    }
  }

  if (profile === BILLING_PROFILE.COMPANY_DUAL) {
    const today = new Date();
    const nextFriday = getWeekdayInSheet(weekStart, 5);
    const nextTuesday = getWeekdayInSheet(weekStart, 2);

    if (nextFriday) {
      const dayDiff = Math.floor((nextFriday - weekStart) / (1000 * 60 * 60 * 24));
      if (dayDiff < 7) nextFriday.setDate(nextFriday.getDate() + 7);
    }

    if (nextTuesday) {
      const dayDiff = Math.floor((nextTuesday - weekStart) / (1000 * 60 * 60 * 24));
      if (dayDiff < 7) nextTuesday.setDate(nextTuesday.getDate() + 7);
    }

    if (nextFriday && today > nextFriday) return toDateKey(nextTuesday);
    return toDateKey(nextFriday || nextTuesday);
  }

  return '';
};

const mapDebtorRow = (row, rowDisplay, sheetName, sheetOrder) => {
  const r = createLookup(row);
  const rd = createLookup(rowDisplay || {});
  const company = normalizeText(r['company name'] || r.company || r.clientname, 'Unknown Company');
  const billingCycle = normalizeBillingCycle(r['billing cycle'] || r.billingcycle || sheetName);
  const explicitDueDate = normalizeDate(r.duedate || r['due date'] || r.due_date);
  const dueDate = explicitDueDate || inferDueDateFromCycle(billingCycle, sheetName);

  const rAmt = r['total due ($)'] ?? r['total due ()'] ?? r.amount ?? r.totaldue;
  const rdAmt = rd['total due ($)'] ?? rd['total due ()'] ?? rd.amount ?? rd.totaldue;
  const amountInput = typeof rAmt === 'number' ? rAmt : (rdAmt || rAmt);
  const amountNormalized = normalizeAmount(amountInput);

  const generateId = () => {
    const inv = normalizeText(r['invoice number'] || r.id);
    if (inv) return inv;

    const compStr = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 15);
    const agentStr = String(r['sales rep'] || r.agentid || r.agent || 'NA')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .substring(0, 10);
    return `GEN-${compStr}-${agentStr}`;
  };

  return {
    id: generateId(),
    invoiceNumber: normalizeText(r['invoice number'] || r.id),
    company,
    clientName: company,
    contactPerson: normalizeText(r['contact person'] || r.contact || r.contactperson),
    agentId: normalizeText(
      r['sales rep'] || r.agentid || r.agent || r.sales_rep || r.vendedor || r.representative || r['assigned to'],
      'Unassigned'
    ),
    billingCycle,
    amount: amountNormalized,
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
    const rawInv = String(row.invoiceNumber || '').trim();
    const invoiceNorm = normalizeMatchKey(rawInv);
    const companyNorm = normalizeMatchKey(row.company || row.clientName);
    const key = invoiceNorm ? `${companyNorm}|${invoiceNorm}` : `${companyNorm}|row:${row.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, { ...row });
      return;
    }

    const current = grouped.get(key);
    const isMoreRecent = (Number(row.sourceSheetOrder) || 0) >= (Number(current.sourceSheetOrder) || 0);

    if (isMoreRecent) {
      Object.assign(current, row);
    } else if (!current.billingCycle || current.billingCycle === BILLING_CYCLES.UNSPECIFIED) {
      current.billingCycle = row.billingCycle;
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
    checked: parseBoolean(r.checked),
    billingCycle: normalizeBillingCycle(r['billing cycle'] || r.billingcycle)
  };
};

const buildTrackerId = ({ date, company, task, rowIndex }) => {
  const stableKey = [date, company, task, rowIndex]
    .map((part) => normalizeMatchKey(part))
    .filter(Boolean)
    .join('-');
  return `TRK-${stableKey || rowIndex}`;
};

const mapTrackerRow = (row, rowIndex) => {
  const r = createLookup(row);
  const date = normalizeDate(r.date || r.fecha);
  const company = normalizeText(r['customer/company'] || r.customer || r.company || r.cliente || r.empresa, 'Unknown');
  const task = normalizeText(r.task || r.tarea);

  return {
    id: buildTrackerId({ date, company, task, rowIndex }),
    date,
    company,
    agent: normalizeText(r.agent || r['sales rep'] || r['support agent'] || r.responsible),
    task,
    status: normalizeText(r.status || r.estatus || r.estado),
    notes: normalizeText(r.notes || r.notas)
  };
};

const fetchWorkbook = async () => {
  const response = await fetch(`${SHEET_XLSX_URL}&t=${Date.now()}`, {
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });

  if (!response.ok) {
    throw new Error(`Zoho workbook request failed with ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: 'array' });
};

export default async function handler(_req, res) {
  try {
    const workbook = await fetchWorkbook();
    const csSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'cs by agent');
    const trackerSheetName = workbook.SheetNames.find((name) => {
      const lower = name.trim().toLowerCase();
      return lower === 'tracker' || lower === 'traker';
    });

    const debtors = workbook.SheetNames
      .filter((sheetName) => sheetName !== csSheetName && sheetName !== trackerSheetName)
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

    const trackerLogs = trackerSheetName
      ? XLSX.utils.sheet_to_json(workbook.Sheets[trackerSheetName], { defval: '' }).map(mapTrackerRow)
      : [];

    res.status(200).json({
      debtors: consolidatedDebtors,
      clientsByAgent,
      trackerLogs
    });
  } catch (error) {
    console.error('Error fetching/parsing Zoho sheet:', error);
    res.status(500).json({ error: 'Failed to ingest data from Zoho' });
  }
}
