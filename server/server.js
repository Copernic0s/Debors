const express = require('express');
const cors = require('cors');
const axios = require('axios');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

const SHEET_XLSX_URL = 'https://sheet.zohopublic.com/sheet/published/w0yyac483bf4377414680872e6205cd34447b?download=xlsx';

// Constants and Normalization Fns from Frontend
const BILLING_CYCLES = {
  MONDAY_SUNDAY: 'Monday - Sunday',
  THURSDAY_WEDNESDAY: 'Thursday - Wednesday',
  TWICE: 'Twice',
  UNSPECIFIED: 'Unspecified'
};

const BILLING_PROFILE = { OWNER_A: 'owner_a', OWNER_B: 'owner_b', COMPANY_DUAL: 'company_dual' };

const normalizeText = (value, fallback = '') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const normalizeBillingCycle = (value) => {
  const raw = normalizeText(value).toLowerCase();
  if (!raw || raw.includes('unspecified')) return BILLING_CYCLES.UNSPECIFIED;
  if (raw.includes('cs by agent')) return BILLING_CYCLES.UNSPECIFIED;
  if (raw.includes('thursday') || raw.includes('thurs') || raw.includes('wednesday')) return BILLING_CYCLES.THURSDAY_WEDNESDAY;
  if (raw.includes('monday') || raw.includes('sunday')) return BILLING_CYCLES.MONDAY_SUNDAY;
  if (raw.includes('twice')) return BILLING_CYCLES.TWICE;
  return BILLING_CYCLES.UNSPECIFIED;
};

const normalizeAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2));
  let raw = String(value ?? '').trim();
  if (!raw) return 0;
  
  // Basic cleanup: remove symbols and whitespace
  raw = raw.replace(/[$€£]/g, '').replace(/[\s\u00A0\u202F]/g, '').replace(/[^0-9,.-]/g, '');
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
  // If only one type of separator and followed by exactly 3 digits, it's ambiguous but likely thousands
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
  // Matches "Month Day - Day" (e.g., "March 16 - 20" or "Feb 10-16")
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
  // Look ahead up to 9 days to find the target weekday in the "Next Week" context
  for (let i = 0; i < 10; i += 1) {
    const current = new Date(sheetStartDate);
    current.setDate(sheetStartDate.getDate() + i);
    // getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
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

  // Rule A: Monday -> Sunday cycle. Works ends Sunday. 
  // Invoice sent Monday. Due TUESDAY (next week start + 8 or 9 days depending on sheet start)
  if (profile === BILLING_PROFILE.OWNER_A) {
    const nextTuesday = getWeekdayInSheet(weekStart, 2);
    // Ensure it's at least 7 days after week start to be in the "following" week
    if (nextTuesday) {
      const dayDiff = Math.floor((nextTuesday - weekStart) / (1000 * 60 * 60 * 24));
      if (dayDiff < 7) {
        nextTuesday.setDate(nextTuesday.getDate() + 7);
      }
      return toDateKey(nextTuesday);
    }
  }

  // Rule B: Thursday -> Wednesday cycle. Work ends Wednesday.
  // Invoice sent Thursday. Due FRIDAY.
  if (profile === BILLING_PROFILE.OWNER_B) {
    const nextFriday = getWeekdayInSheet(weekStart, 5);
    if (nextFriday) {
      const dayDiff = Math.floor((nextFriday - weekStart) / (1000 * 60 * 60 * 24));
      // FRIDAY of Rule B usually comes 8 days after the Thursday start
      if (dayDiff < 7) {
        nextFriday.setDate(nextFriday.getDate() + 7);
      }
      return toDateKey(nextFriday);
    }
  }

  // Rule Twice: Monday & Thursday. 
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

    // If today is past the Friday due date (or same day late), we likely look at the Tuesday one
    if (nextFriday && today > nextFriday) {
      return toDateKey(nextTuesday);
    }
    return toDateKey(nextFriday || nextTuesday);
  }

  return '';
};

const mapDebtorRow = (row, rowDisplay, sheetName, sheetOrder, rowIndex) => {
  const r = createLookup(row);
  const rd = createLookup(rowDisplay || {});
  const company = normalizeText(r['company name'] || r.company || r.clientname, 'Unknown Company');
  const billingCycle = normalizeBillingCycle(r['billing cycle'] || r.billingcycle || sheetName);
  const explicitDueDate = normalizeDate(r.duedate || r['due date'] || r.due_date);
  const dueDate = explicitDueDate || inferDueDateFromCycle(billingCycle, sheetName);
  
  // Preference: 1. Raw number from Zoho, 2. Formatted display string, 3. Raw string
  const rAmt = r['total due ($)'] ?? r['total due ()'] ?? r.amount ?? r.totaldue;
  const rdAmt = rd['total due ($)'] ?? rd['total due ()'] ?? rd.amount ?? rd.totaldue;
  const amountInput = (typeof rAmt === 'number') ? rAmt : (rdAmt || rAmt);
  const amountNormalized = normalizeAmount(amountInput);
  
  const generateId = () => {
    const inv = normalizeText(r['invoice number'] || r.id);
    if (inv) return inv;
    const compStr = company.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 15);
    const agentStr = String(r['sales rep'] || r.agentid || r.agent || 'NA').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
    // Use company + agent for stability across sheet shifts
    return `GEN-${compStr}-${agentStr}`;
  };

  return {
    id: generateId(),
    invoiceNumber: normalizeText(r['invoice number'] || r.id),
    company,
    clientName: company,
    contactPerson: normalizeText(r['contact person'] || r.contact || r.contactperson),
    agentId: normalizeText(r['sales rep'] || r.agentid || r.agent, 'Unassigned'),
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
    const invoice = String(row.invoiceNumber || '').trim();
    const company = String(row.company || row.clientName || '').trim().toLowerCase();
    // If there's an invoice, group by company+invoice. 
    // If not, use the unique generated ID (which now includes rowIndex).
    const key = invoice ? `${company}|${invoice.toLowerCase()}` : `${company}|row:${row.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, { ...row });
      return;
    }

    const current = grouped.get(key);
    
    // If it's the same record across different sheets/weeks, we take the one from the "latest" sheet 
    // or the one with the highest amount (since debt usually grows or is corrected up).
    if ((Number(row.amount) || 0) > (Number(current.amount) || 0)) {
      current.amount = Number(row.amount) || 0;
    }

    if ((Number(row.sourceSheetOrder) || 0) >= (Number(current.sourceSheetOrder) || 0)) {
      if (row.billingCycle && row.billingCycle !== BILLING_CYCLES.UNSPECIFIED) {
        current.billingCycle = row.billingCycle;
      }
      if (row.dueDate) current.dueDate = row.dueDate;
      if (row.agentId && row.agentId !== 'Unassigned') current.agentId = row.agentId;
      if (row.weekLabel) current.weekLabel = row.weekLabel;
      current.status = row.status;
      current.sourceSheetOrder = row.sourceSheetOrder;
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

// API Endpoint
app.get('/api/debtors', async (req, res) => {
  try {
    const sourceUrl = `${SHEET_XLSX_URL}&t=${Date.now()}`;
    console.log('[Zoho Sync] Fetching from:', sourceUrl);

    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    const workbook = XLSX.read(response.data, { type: 'buffer' });
    console.log('[Zoho Sync] Sheets found:', workbook.SheetNames.join(', '));

    const csSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'cs by agent');

    const debtors = workbook.SheetNames
      .filter((sheetName) => sheetName !== csSheetName)
      .flatMap((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const rowsRaw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
        console.log(`[Zoho Sync] Sheet "${sheetName}" has ${rowsRaw.length} rows`);
        const rowsDisplay = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        return rowsRaw.map((row, rowIndex) => mapDebtorRow(row, rowsDisplay[rowIndex], sheetName, index));
      })
      .filter((item) => item.company);

    const consolidatedDebtors = consolidateDebtorRows(debtors);

    const clientsByAgent = csSheetName
      ? XLSX.utils.sheet_to_json(workbook.Sheets[csSheetName], { defval: '' }).map(mapCsByAgentRow)
      : [];

    res.json({
      debtors: consolidatedDebtors,
      clientsByAgent
    });

  } catch (error) {
    console.error('Error fetching/parsing Zoho sheet:', error.message);
    res.status(500).json({ error: 'Failed to ingest data from Zoho' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
});
