const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const XLSX = require('xlsx');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { canAccessCmpInvoicePdf } = require('./cmpPdfAuthorization.cjs');

const app = express();
const PORT = process.env.PORT || 3001;
const { getCmpStatus, getRunLogs, tailLog, startCmpScraper } = require('./cmpRunner');
const {
  ingestCmpSnapshot,
  verifyCmpIngestSecret,
  getConfiguredIngestSecret
} = require('./cmpIngest.cjs');

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by local Debors API'));
  }
}));
app.use(express.json({ limit: '12mb' }));

const isCsByAgentSheet = (name) => {
  const lower = String(name || '').trim().toLowerCase();
  return lower === 'cs by agent' || lower === 'client by agent';
};

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

// New Helper for robust matching
const normalizeMatchKey = (value) => {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+(llc|inc|corp|co|limited|ltd|transportation|logistics|express)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

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
  if (raw.includes('partial') || raw.includes('unpaid')) return 'pending';
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
    
    // If there's an invoice, group by normalized company + normalized invoice.
    // If not, use the generated unique ID.
    const key = invoiceNorm ? `${companyNorm}|${invoiceNorm}` : `${companyNorm}|row:${row.id}`;

    if (!grouped.has(key)) {
      grouped.set(key, { ...row });
      return;
    }

    const current = grouped.get(key);
    
    // LATEST-WINS CONSISTENCY: 
    // If this row comes from a more recent sheet (higher index), it is the SOURCE OF TRUTH.
    // This ensures that if an invoice was $1000 last week but is $200 this week (partial payment),
    // we correctly show $200, not $1000.
    const isMoreRecent = (Number(row.sourceSheetOrder) || 0) >= (Number(current.sourceSheetOrder) || 0);

    if (isMoreRecent) {
      // Overwrite everything with latest version
      Object.assign(current, row);
    } else {
      // If it's an older row, we only take information if the current one is missing it (unlikely)
      if (!current.billingCycle || current.billingCycle === BILLING_CYCLES.UNSPECIFIED) {
        current.billingCycle = row.billingCycle;
      }
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

const mapTrackerRow = (row) => {
  const r = createLookup(row);
  const date = normalizeDate(r.date || r.fecha);
  const company = normalizeText(r['customer/company'] || r.customer || r.company || r.cliente || r.empresa, 'Unknown');
  const task = normalizeText(r.task || r.tarea);
  const stableKey = [date, company, task]
    .map((part) => normalizeMatchKey(part))
    .filter(Boolean)
    .join('-');

  return {
    id: `TRK-${stableKey || 'row'}`,
    date,
    company,
    agent: normalizeText(r.agent || r['sales rep'] || r['support agent'] || r.responsible),
    task,
    status: normalizeText(r.status || r.estatus || r.estado),
    notes: normalizeText(r.notes || r.notas)
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

    const csSheetName = workbook.SheetNames.find((name) => isCsByAgentSheet(name));
    
    const trackerSheetName = workbook.SheetNames.find((name) => {
      const lower = name.trim().toLowerCase();
      return lower === 'tracker' || lower === 'traker';
    });

    const debtors = workbook.SheetNames
      .filter((sheetName) => sheetName !== csSheetName && sheetName !== trackerSheetName)
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

    const trackerLogs = trackerSheetName
      ? XLSX.utils.sheet_to_json(workbook.Sheets[trackerSheetName], { defval: '' }).map(mapTrackerRow)
      : [];

    res.json({
      debtors: consolidatedDebtors,
      clientsByAgent,
      trackerLogs
    });

  } catch (error) {
    console.error('Error fetching/parsing Zoho sheet:', error.message);
    res.status(500).json({ error: 'Failed to ingest data from Zoho' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    cmpIngestSecret: Boolean(process.env.CMP_INGEST_SECRET),
    port: PORT
  });
});

app.get('/api/cmp/status', (_req, res) => {
  res.json(getCmpStatus());
});

app.get('/api/cmp/log', (req, res) => {
  const requestedLines = Number.parseInt(String(req.query.lines || '120'), 10);
  const lines = Number.isFinite(requestedLines) ? Math.min(1000, Math.max(1, requestedLines)) : 120;
  const requestedRunId = typeof req.query.runId === 'string' ? req.query.runId : null;
  const status = getCmpStatus();
  const runId = requestedRunId || status.runId;
  res.json({ runId, tail: tailLog(lines, requestedRunId) });
});

app.get('/api/cmp/logs', (_req, res) => {
  res.json({ logs: getRunLogs() });
});

app.post('/api/cmp/run', (req, res) => {
  if (!getConfiguredIngestSecret()) {
    return res.status(503).json({ error: 'CMP runner is not configured' });
  }

  try {
    const depth = req.body?.depth || 'fast';
    const trigger = req.body?.trigger || 'manual';
    if (!['manual', 'scheduled'].includes(trigger)) {
      return res.status(400).json({ error: 'CMP trigger must be manual or scheduled' });
    }
    const result = startCmpScraper(depth, trigger);
    if (!result.started) {
      return res.status(409).json({ error: 'CMP scraper is already running' });
    }
    return res.json({ ok: true, runId: result.runId, ...getCmpStatus() });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to start CMP scraper' });
  }
});

app.post('/api/cmp/ingest', async (req, res) => {
  try {
    if (!getConfiguredIngestSecret()) {
      return res.status(503).json({ error: 'CMP ingest is not configured' });
    }
    if (!verifyCmpIngestSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await ingestCmpSnapshot(req.body || {});
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[CMP Ingest]', error);
    return res.status(500).json({ error: error.message || 'CMP ingest failed' });
  }
});

app.post('/api/cmp/pdf', async (req, res) => {
  const invoiceId = String(req.body?.invoiceId || '').trim();
  if (!invoiceId) {
    return res.status(400).json({ error: 'invoiceId is required' });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Missing Supabase service credentials for PDF upload. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication is required' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

    const [{ data: invoices, error: invoiceError }, { data: scopes, error: scopeError }, { data: viewers, error: viewerError }] = await Promise.all([
      supabase.from('cmp_invoices').select('id, invoice_number, company_name, agent_id').eq('id', invoiceId).limit(1),
      supabase.from('agent_scopes').select('agent_id, is_manager').eq('user_id', userData.user.id),
      supabase.from('cmp_billing_viewers').select('user_id').eq('user_id', userData.user.id).limit(1)
    ]);

    if (invoiceError || scopeError || viewerError) {
      return res.status(500).json({ error: 'Could not verify CMP PDF permissions' });
    }

    const invoice = invoices?.[0];
    if (!invoice) return res.status(404).json({ error: 'Invoice was not found in CMP invoices' });
    if (!canAccessCmpInvoicePdf({
      scopes: scopes || [],
      invoiceAgentId: invoice.agent_id,
      isBillingViewer: Boolean(viewers?.length)
    })) {
      return res.status(403).json({ error: 'You are not allowed to request this invoice PDF' });
    }

    if (getCmpStatus().running) {
      return res.status(409).json({ error: 'CMP sync is running. Request the PDF after the scraper finishes.' });
    }

    const result = await executePdfFetch(supabase, invoice.invoice_number, invoice.company_name, invoice.id);
    return res.json({ ok: true, pdfStoragePath: result.storagePath });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'PDF worker failed' });
  }
});

app.get('/api/cmp/pdf/queue', async (req, res) => {
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Missing Supabase service credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication is required' });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session' });
    const { data: scopes, error: scopeError } = await supabase
      .from('agent_scopes')
      .select('is_manager')
      .eq('user_id', userData.user.id);
    if (scopeError) return res.status(500).json({ error: 'Could not verify CMP queue permissions' });
    if (!(scopes || []).some((scope) => scope.is_manager === true)) {
      return res.status(403).json({ error: 'Manager access is required to inspect the CMP PDF queue' });
    }

    const statuses = ['queued', 'fetching', 'failed', 'available', 'missing'];
    const counts = {};
    for (const status of statuses) {
      const { count, error } = await supabase
        .from('cmp_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('pdf_status', status);
      if (error) throw error;
      counts[status] = count || 0;
    }

    let { data: queue, error } = await supabase
      .from('cmp_invoices')
      .select('invoice_number, company_name, pdf_status, pdf_error, pdf_storage_path, pdf_requested_at, synced_at')
      .in('pdf_status', ['queued', 'fetching', 'failed'])
      .order('pdf_requested_at', { ascending: true, nullsFirst: false })
      .limit(20);
    if (error && String(error.message || '').includes('pdf_requested_at')) {
      ({ data: queue, error } = await supabase
        .from('cmp_invoices')
        .select('invoice_number, company_name, pdf_status, pdf_error, pdf_storage_path, synced_at')
        .in('pdf_status', ['queued', 'fetching', 'failed'])
        .order('synced_at', { ascending: true })
        .limit(20));
    }
    if (error) throw error;

    return res.json({ ok: true, running: getCmpStatus().running, counts, queue: queue || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to inspect PDF queue' });
  }
});

// DRY Helper function to spawn the python crawler and upload the PDF
const getBearerToken = (req) => {
  const authorization = String(req.headers.authorization || '');
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
};

const executePdfFetch = (supabase, invoiceNumber, companyName, invoiceId = null) => {
  const targetInvoice = (query) => invoiceId ? query.eq('id', invoiceId) : query.eq('invoice_number', invoiceNumber);
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[PDF Worker] Starting fetch for invoice ${invoiceNumber} (${companyName})...`);
      
      await targetInvoice(supabase
        .from('cmp_invoices')
        .update({ pdf_status: 'fetching', pdf_error: null }));

      const scriptPath = path.join(__dirname, '..', 'automation', 'cmp_pdf_fetcher.py');
      const child = spawn(
        'python',
        [scriptPath, '--invoice-number', invoiceNumber, '--company-name', companyName],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            CMP_DEBUGGER_ADDRESS: process.env.CMP_DEBUGGER_ADDRESS || 'localhost:9222'
          },
          windowsHide: true
        }
      );

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      child.on('close', async (code) => {
        try {
          if (code !== 0) {
            let message = stderr.trim() || `PDF worker exited with code ${code}`;
            try {
              const parsed = JSON.parse(message.split(/\r?\n/).pop());
              message = parsed.error || message;
            } catch {}
            
            await targetInvoice(supabase
              .from('cmp_invoices')
              .update({ pdf_status: 'failed', pdf_error: message }));
              
            return reject(new Error(message));
          }

          const result = JSON.parse(stdout.trim().split(/\r?\n/).pop() || '{}');
          if (!result.storagePath) {
            throw new Error('PDF worker did not return a storage path');
          }

          await targetInvoice(supabase
            .from('cmp_invoices')
            .update({
              pdf_storage_path: result.storagePath,
              pdf_status: 'available',
              pdf_downloaded_at: new Date().toISOString(),
              pdf_error: null
            }));

          resolve({ storagePath: result.storagePath });
        } catch (error) {
          await targetInvoice(supabase
            .from('cmp_invoices')
            .update({ pdf_status: 'failed', pdf_error: error.message || 'PDF worker failed' }));
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Queue polling background worker
let queueWorkerActive = false;
const startCmpPdfQueueWorker = (supabase) => {
  console.log('[Queue Worker] Initializing background CMP PDF download queue listener...');

  const pollQueue = async () => {
    if (queueWorkerActive) return; // Prevent overlapping runs

    // Skip if the main scraper bot is running (to avoid port/chrome conflicts)
    if (getCmpStatus().running) return;

    queueWorkerActive = true;
    try {
      // Find the oldest queued invoice
      let { data: queuedInvoices, error } = await supabase
        .from('cmp_invoices')
        .select('id, invoice_number, company_name, pdf_requested_at, synced_at')
        .eq('pdf_status', 'queued')
        .order('pdf_requested_at', { ascending: true, nullsFirst: false })
        .order('synced_at', { ascending: true })
        .limit(1);

      if (error && String(error.message || '').includes('pdf_requested_at')) {
        ({ data: queuedInvoices, error } = await supabase
          .from('cmp_invoices')
          .select('id, invoice_number, company_name, synced_at')
          .eq('pdf_status', 'queued')
          .order('synced_at', { ascending: true })
          .limit(1));
      }

      if (error) {
        console.error('[Queue Worker] Error fetching queue:', error.message);
      } else if (queuedInvoices && queuedInvoices.length > 0) {
        const item = queuedInvoices[0];
        console.log(`[Queue Worker] Picked up queued invoice ${item.invoice_number} for ${item.company_name}`);
        try {
          await executePdfFetch(supabase, item.invoice_number, item.company_name, item.id);
          console.log(`[Queue Worker] Successfully processed invoice ${item.invoice_number}`);
        } catch (fetchError) {
          console.error(`[Queue Worker] Failed to process invoice ${item.invoice_number}:`, fetchError.message);
        }
      }
    } catch (err) {
      console.error('[Queue Worker] Error in worker loop:', err);
    } finally {
      queueWorkerActive = false;
    }
  };

  pollQueue();
  setInterval(pollQueue, 10000); // Check every 10 seconds
};

const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';

app.listen(PORT, BIND_HOST, () => {
  console.log(`Backend listening on http://${BIND_HOST}:${PORT}`);
  if (!getConfiguredIngestSecret()) {
    console.warn('[CMP] Runner and ingest disabled: a valid local ingest secret is required.');
  }
  
  // Start the queue worker on startup if Supabase config is present
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    startCmpPdfQueueWorker(supabase);
  } else {
    console.warn('[Queue Worker] Skip startup: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
});
