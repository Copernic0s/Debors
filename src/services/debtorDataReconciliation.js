import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const SHEET_AUTHORITY_FIELDS = [
  'company',
  'clientName',
  'agentId',
  'billingCycle',
  'weekLabel',
  'invoiceNumber',
  'source',
  'sourceType'
];

export const parseMoneyValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  let raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;

  raw = raw
    .replace(/[$â‚¬Â£]/g, '')
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!raw) return Number.NaN;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const sepIndex = Math.max(lastComma, lastDot);

  if (sepIndex === -1) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
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
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const roundMoney = (value) => {
  const parsed = parseMoneyValue(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
};

export const mergeManualEdits = (rows, editsById) => {
  const merged = rows
    .filter((row) => !editsById[row.id]?.__deleted)
    .map((row) => {
      const patch = editsById[row.id];
      if (!patch) return row;
      const mergedRow = {
        ...row,
        ...patch
      };

      SHEET_AUTHORITY_FIELDS.forEach((field) => {
        if (row[field] !== undefined) {
          mergedRow[field] = row[field];
        }
      });

      return mergedRow;
    });

  const existingIds = new Set(merged.map((r) => r.id));
  Object.values(editsById).forEach((edit) => {
    if ((edit.__isNew || !existingIds.has(edit.id)) && !edit.__deleted) {
      merged.unshift({
        ...edit,
        source: edit.source === 'manual_entry' ? 'invoice' : (edit.source || 'invoice')
      });
    }
  });

  return merged;
};

const normalizeWeekLabel = (label) => {
  const raw = String(label || '').trim().toLowerCase();
  if (!raw) return 'unspecified';
  const numbers = raw.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    return `W-${numbers[0]}-${numbers[1]}`;
  }
  return raw.replace(/[^a-z0-9]/g, '');
};

export const toComparableDate = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeMatchKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|limited|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

const buildBillingCycleLookups = (csRows = []) => {
  const byCompanyAgent = new Map();
  const byCompany = new Map();

  (csRows || []).forEach((row) => {
    const companyKey = normalizeMatchKey(row.company || row.clientName);
    const agentKey = normalizeMatchKey(row.agentId);
    const cycle = normalizeBillingCycle(row.billingCycle);

    if (!companyKey || cycle === BILLING_CYCLES.UNSPECIFIED) return;

    if (agentKey) {
      byCompanyAgent.set(`${companyKey}|${agentKey}`, cycle);
    }

    const currentCompanyCycle = byCompany.get(companyKey);
    if (!currentCompanyCycle) {
      byCompany.set(companyKey, cycle);
    } else if (currentCompanyCycle !== cycle) {
      byCompany.set(companyKey, null);
    }
  });

  return { byCompanyAgent, byCompany };
};

const resolveRosterBillingCycle = (row, lookups) => {
  const directCycle = normalizeBillingCycle(row?.billingCycle);
  const companyKey = normalizeMatchKey(row?.company || row?.clientName);
  const agentKey = normalizeMatchKey(row?.agentId);

  if (!companyKey) return directCycle;

  const exactCycle = agentKey ? lookups.byCompanyAgent.get(`${companyKey}|${agentKey}`) : null;
  if (exactCycle) return exactCycle;

  const companyCycle = lookups.byCompany.get(companyKey);
  if (companyCycle) return companyCycle;

  return directCycle;
};

export const mergeDebtorsWithClientSheet = (debtRows, csRows) => {
  const merged = new Map();
  const windowsWithInvoice = new Set();
  const billingCycleLookups = buildBillingCycleLookups(csRows);

  debtRows.forEach((row) => {
    merged.set(row.id, {
      ...row,
      billingCycle: resolveRosterBillingCycle(row, billingCycleLookups),
      source: 'debt'
    });

    const normalizedCompany = normalizeMatchKey(row.company || row.clientName);
    const normalizedWeek = normalizeWeekLabel(row.weekLabel);
    if (normalizedCompany && normalizedWeek) {
      windowsWithInvoice.add(`${normalizedWeek}|${normalizedCompany}`);
    }
  });

  (csRows || []).forEach((row) => {
    const company = String(row.company || '').trim();
    const week = String(row.weekLabel || '').trim();
    if (!company) return;

    const normalizedCompany = normalizeMatchKey(company);
    const normalizedWeek = normalizeWeekLabel(row.weekLabel);
    const windowKey = `${normalizedWeek}|${normalizedCompany}`;
    const stableId = `CS-${normalizedWeek}-${normalizedCompany}`;

    if (!windowsWithInvoice.has(windowKey) && !merged.has(stableId)) {
      merged.set(stableId, {
        id: stableId,
        company,
        clientName: company,
        agentId: String(row.agentId || 'Unassigned').trim(),
        amount: Number(row.amount) || 0,
        billingCycle: resolveRosterBillingCycle(row, billingCycleLookups),
        status: String(row.status || 'pending').toLowerCase() === 'paid' ? 'paid' : 'no_invoice',
        dueDate: row.dueDate || '',
        weekLabel: week,
        source: 'cs'
      });
    }
  });

  return Array.from(merged.values());
};

export const aggregateByCompany = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const company = String(row.company || row.clientName || '').trim();
    if (!company) return;

    const agent = String(row.agentId || 'Unassigned').trim() || 'Unassigned';
    const invKey = String(row.invoiceNumber || row.weekLabel || row.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const companyKey = normalizeMatchKey(company);
    const key = `${companyKey}`;
    const amount = Number.isFinite(roundMoney(row.amount)) ? roundMoney(row.amount) : 0;
    const isPaid = String(row.status || '').toLowerCase() === 'paid' || String(row.status || '').toLowerCase() === 'inactive';
    const amountToAdd = isPaid ? 0 : amount;

    const current = grouped.get(key);
    const normalizedCycle = normalizeBillingCycle(row.billingCycle) || BILLING_CYCLES.UNSPECIFIED;
    const isCsSource = row.id?.startsWith('CS-') || row.source === 'cs';

    if (!current) {
      grouped.set(key, {
        ...row,
        company,
        clientName: company,
        agentId: agent,
        agentSet: new Set([agent]),
        amount: amountToAdd,
        billingCycle: normalizedCycle,
        cycleSet: new Set([normalizedCycle]),
        isSheetCycle: isCsSource && normalizedCycle !== BILLING_CYCLES.UNSPECIFIED,
        status: row.status || 'pending',
        notes: row.notes || '',
        invoiceNumber: row.invoiceNumber || '',
        invoiceCount: row.invoiceNumber ? 1 : 0,
        hasInvoice: Boolean(String(row.invoiceNumber || '').trim()),
        invoiceCountOverride: Number.isFinite(Number(row.invoiceCountOverride)) ? Number(row.invoiceCountOverride) : null,
        dueDate: row.dueDate || '',
        latestId: row.id,
        id: `CMP-${key}`,
        seenInvoices: new Set([invKey])
      });
      return;
    }

    if (!current.seenInvoices.has(invKey)) {
      current.amount = Number.isFinite(roundMoney(current.amount + amountToAdd))
        ? roundMoney(current.amount + amountToAdd)
        : 0;
      current.seenInvoices.add(invKey);
      if (row.invoiceNumber) current.invoiceCount += 1;
    }

    current.agentSet.add(agent);

    const normalizedRowCycle = normalizeBillingCycle(row.billingCycle);
    if (normalizedRowCycle && normalizedRowCycle !== BILLING_CYCLES.UNSPECIFIED) {
      current.cycleSet.add(normalizedRowCycle);

      if (!current.isSheetCycle) {
        if (isCsSource) {
          current.billingCycle = normalizedRowCycle;
          current.isSheetCycle = true;
        } else if (current.billingCycle === BILLING_CYCLES.UNSPECIFIED) {
          current.billingCycle = normalizedRowCycle;
        }
      }
    }

    if (row.invoiceNumber) current.invoiceCount += 1;
    if (String(row.invoiceNumber || '').trim()) current.hasInvoice = true;

    if (row.dueDate) {
      if (!current.dueDate || row.dueDate > current.dueDate) {
        current.dueDate = row.dueDate;
        current.latestId = row.id;
        current.invoiceNumber = row.invoiceNumber || current.invoiceNumber;
        current.notes = row.notes || current.notes;
        if (!current.isSheetCycle && normalizedRowCycle !== BILLING_CYCLES.UNSPECIFIED) {
          current.billingCycle = normalizedRowCycle;
        }
        current.lastInvoicedDate = row.lastInvoicedDate || current.lastInvoicedDate;
        current.lastNoUsageDate = row.lastNoUsageDate || current.lastNoUsageDate;
        current.noUsageCount = row.noUsageCount ?? current.noUsageCount;
      }
    }

    const statuses = [String(current.status || '').toLowerCase(), String(row.status || '').toLowerCase()];
    if (statuses.some((status) => status === 'overdue')) {
      current.status = 'overdue';
    } else if (statuses.some((status) => status === 'pending')) {
      current.status = 'pending';
    } else if (statuses.every((status) => status === 'paid' || status === 'inactive')) {
      current.status = 'paid';
    }
  });

  const today = new Date();

  return Array.from(grouped.values()).map((item) => {
    const agents = Array.from(item.agentSet);
    let status = item.status;
    let isAutoOverdue = false;

    if (status !== 'paid' && status !== 'inactive' && status !== 'no_invoice' && item.dueDate) {
      const dateStr = item.dueDate.includes('T') ? item.dueDate : `${item.dueDate}T17:00:00`;
      const parsedDue = new Date(dateStr);
      if (!Number.isNaN(parsedDue.getTime()) && parsedDue < today) {
        status = 'overdue';
        isAutoOverdue = true;
      }
    }

    const companyRows = rows
      .filter((row) => String(row.company || row.clientName || '').trim().toLowerCase() === item.company.toLowerCase())
      .sort((a, b) => String(a.weekLabel || '').localeCompare(String(b.weekLabel || '')));

    const lastRows = companyRows.slice(-3);
    const consecutiveNoUsage = lastRows.length >= 3 && lastRows.every((row) => row.lastNoUsageDate);
    const persistentNoUsageCount = Number(item.noUsageCount) || 0;

    if (consecutiveNoUsage || persistentNoUsageCount >= 3) {
      item.status = 'inactive';
    }

    return {
      ...item,
      status,
      isAutoOverdue,
      agentId: agents.join(', '),
      billingCycle:
        item.billingCycle && item.billingCycle !== BILLING_CYCLES.UNSPECIFIED
          ? item.billingCycle
          : (Array.from(item.cycleSet).find((cycle) => cycle !== BILLING_CYCLES.UNSPECIFIED) || BILLING_CYCLES.UNSPECIFIED),
      dueDate: item.dueDate || '',
      invoiceCount: Number.isFinite(Number(item.invoiceCountOverride)) ? Number(item.invoiceCountOverride) : item.invoiceCount,
      sourceType: item.hasInvoice ? 'invoice' : 'cs',
      agentSet: undefined,
      cycleSet: undefined,
      invoiceCountOverride: item.invoiceCountOverride
    };
  });
};
