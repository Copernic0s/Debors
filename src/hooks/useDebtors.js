import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllDataFromSheet } from '../services/zohoWorkDrive';
import { fetchCmpInvoices, fetchCmpSyncMeta } from '../services/cmpInvoices';
import { mapCmpInvoicesToDebtorRows, mergeZohoWithCmpRows } from '../services/cmpMerge';
import { normalizeWeekLabel, normalizeMatchKey } from '../utils/normalizers';
import { roundMoney } from '../utils/moneyUtils';
import { normalizeBillingCycle } from '../constants/billingCycles';
import { BILLING_CYCLES } from '../constants/billingCycles';

const mergeManualEdits = (rows, editsById) => {
  const editsByInvKey = new Map();
  
  Object.values(editsById).forEach(edit => {
    if (edit.__deleted) return;
    const companyKey = normalizeMatchKey(edit.company || edit.clientName);
    const invNumber = String(edit.invoiceNumber || '').trim();
    if (companyKey && invNumber) {
      const invKey = normalizeMatchKey(invNumber);
      editsByInvKey.set(`${companyKey}|${invKey}`, edit);
    }
  });

  const merged = rows
    .filter((row) => !editsById[row.id]?.__deleted)
    .map((row) => {
      const companyKey = normalizeMatchKey(row.company || row.clientName);
      const invNumber = String(row.invoiceNumber || '').trim();
      const invKey = invNumber ? normalizeMatchKey(invNumber) : '';
      
      let patch = editsById[row.id];
      if (!patch && companyKey && invKey) {
        patch = editsByInvKey.get(`${companyKey}|${invKey}`);
      }
      
      if (!patch) return row;
      
      patch.__applied = true;
      return { ...row, ...patch };
    });

  const existingIds = new Set(merged.map((r) => r.id));
  Object.values(editsById).forEach((edit) => {
    if (edit.__deleted || edit.__applied) return;
    if (edit.__isNew || !existingIds.has(edit.id)) {
      merged.unshift({ 
        ...edit,
        source: edit.source === 'manual_entry' ? 'invoice' : (edit.source || 'invoice')
      });
    }
  });

  return merged;
};

const mergeDebtorsWithClientSheet = (debtRows, csRows) => {
  const merged = new Map();
  const windowsWithInvoice = new Set();

  debtRows.forEach((row) => {
    merged.set(row.id, { ...row, source: 'debt' });
    
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
        billingCycle: normalizeBillingCycle(row.billingCycle),
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
    const invKey = String(row.invoiceNumber || row.weekLabel || row.id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const companyKey = normalizeMatchKey(company);
    const key = `${companyKey}-${invKey}`;
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
      current.amount = Number.isFinite(roundMoney(current.amount + amountToAdd)) ? roundMoney(current.amount + amountToAdd) : 0;
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
        current.status = row.status || current.status;
        current.notes = row.notes || current.notes;
        if (!current.isSheetCycle) {
          current.billingCycle = row.billingCycle || current.billingCycle;
        }
        current.lastInvoicedDate = row.lastInvoicedDate || current.lastInvoicedDate;
        current.lastNoUsageDate = row.lastNoUsageDate || current.lastNoUsageDate;
        current.noUsageCount = row.noUsageCount ?? current.noUsageCount;
      }
    }

    const statuses = [String(current.status || '').toLowerCase(), String(row.status || '').toLowerCase()];
    if (statuses.some((s) => s === 'overdue')) {
      current.status = 'overdue';
    } else if (statuses.some((s) => s === 'pending')) {
      current.status = 'pending';
    } else if (statuses.every((s) => s === 'paid' || s === 'inactive')) {
      current.status = 'paid';
    }
  });

  const today = new Date();

  return Array.from(grouped.values()).map((item) => {
    const agents = Array.from(item.agentSet);
    const cycles = Array.from(item.cycleSet);
    
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

    const companyRows = rows.filter(r => 
      String(r.company || r.clientName || '').trim().toLowerCase() === item.company.toLowerCase()
    ).sort((a, b) => String(a.weekLabel || '').localeCompare(String(b.weekLabel || '')));

    const lastRows = companyRows.slice(-3);
    const consecutiveNoUsage = lastRows.length >= 3 && lastRows.every(r => r.lastNoUsageDate);
    const persistentNoUsageCount = Number(item.noUsageCount) || 0;

    if (consecutiveNoUsage || persistentNoUsageCount >= 3) {
      item.status = 'inactive';
    }

    return {
      ...item,
      status,
      isAutoOverdue,
      agentId: agents.join(', '),
      billingCycle: (item.billingCycle && item.billingCycle !== BILLING_CYCLES.UNSPECIFIED) 
        ? item.billingCycle 
        : (Array.from(item.cycleSet).find(c => c !== BILLING_CYCLES.UNSPECIFIED) || BILLING_CYCLES.UNSPECIFIED),
      dueDate: item.dueDate || '',
      invoiceCount: Number.isFinite(Number(item.invoiceCountOverride)) ? Number(item.invoiceCountOverride) : item.invoiceCount,
      sourceType: item.hasInvoice ? 'invoice' : 'cs',
      agentSet: undefined,
      cycleSet: undefined,
      invoiceCountOverride: item.invoiceCountOverride
    };
  });
};

export function useDebtors({ supabase, user, tableName = 'manual_edits' }) {
  const [data, setDisplayData] = useState([]);
  const [rawZohoData, setRawZohoData] = useState([]);
  const [clientsByAgent, setClientsByAgent] = useState([]);
  const [trackerData, setTrackerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSourceLabel, setSyncSourceLabel] = useState('Zoho WorkDrive');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastCmpSyncAt, setLastCmpSyncAt] = useState(null);
  const [cmpInvoiceCount, setCmpInvoiceCount] = useState(0);

  const syncInFlightRef = useRef(false);
  const manualEditsRef = useRef({});
  const [manualEdits, setManualEdits] = useState({});

  const fetchManualEdits = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data: edits, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) throw error;

      const editsById = {};
      edits.forEach(edit => {
        editsById[edit.id] = {
          ...edit,
          company: edit.company,
          clientName: edit.company,
          agentId: edit.agent_id,
          dueDate: edit.due_date,
          billingCycle: edit.billing_cycle,
          lastInvoicedDate: edit.last_invoiced_date,
          lastNoUsageDate: edit.last_no_usage_date,
          email: edit.email || '',
          noUsageCount: (edit.notes || '').match(/\[streak:(\d+)\]/)?.[1] ? Number((edit.notes || '').match(/\[streak:(\d+)\]/)[1]) : (Number(edit.no_usage_count) || 0),
          invoiceNumber: edit.invoice_number,
          notes: (edit.notes || '').replace(/\[streak:\d+\]/, '').trim(),
          __isNew: edit.is_new,
          __deleted: edit.is_deleted
        };
      });

      setManualEdits(editsById);
      manualEditsRef.current = editsById;
    } catch (error) {
      console.error('Error fetching manual edits:', error.message);
    }
  }, [user, supabase, tableName]);

  const loadData = useCallback(async ({ silent = false, notifyUser = false } = {}) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    if (!silent) setLoading(true);
    setIsSyncing(true);

    try {
      const { debtors: sheetData, clientsByAgent: csData, trackerLogs } = await fetchAllDataFromSheet(undefined, { cacheBust: true });
      setClientsByAgent(csData || []);

      if (trackerLogs) setTrackerData(trackerLogs);

      let cmpRows = [];
      try {
        const cmpInvoices = await fetchCmpInvoices(supabase);
        cmpRows = mapCmpInvoicesToDebtorRows(cmpInvoices, csData);
        setCmpInvoiceCount(cmpRows.length);
        const cmpMeta = await fetchCmpSyncMeta(supabase);
        setLastCmpSyncAt(cmpMeta?.synced_at ? new Date(cmpMeta.synced_at) : null);
      } catch (cmpError) {
        console.warn('[CMP] Load skipped:', cmpError.message);
        setCmpInvoiceCount(0);
      }

      const zohoMerged = mergeDebtorsWithClientSheet(sheetData, csData);
      const mergedData = mergeZohoWithCmpRows(zohoMerged, cmpRows);

      if (mergedData && mergedData.length > 0) {
        setRawZohoData(mergedData);
        setSyncSourceLabel(cmpRows.length > 0 ? 'Zoho + CMP' : 'Zoho WorkDrive');
      } else {
        setRawZohoData([]);
        setSyncSourceLabel('Zoho WorkDrive');
      }
    } catch (err) {
      console.error('[Sync] Load data failed:', err);
      setSyncSourceLabel('Offline Data');
    } finally {
      setLastSyncAt(new Date());
      if (!silent) setLoading(false);
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [supabase]);

  const persistEditedRows = useCallback(async (rows) => {
    if (!rows || rows.length === 0 || !user || !supabase) return;

    const upserts = rows
      .filter(row => row.id)
      .map(row => ({
        id: String(row.id),
        company: row.company || row.clientName || null,
        agent_id: row.agentId || null,
        amount: Number(row.amount) || 0,
        status: String(row.status || 'pending'),
        due_date: row.dueDate || null,
        last_invoiced_date: row.lastInvoicedDate || null,
        last_no_usage_date: row.lastNoUsageDate || null,
        billing_cycle: row.billingCycle || null,
        invoice_number: row.invoiceNumber || null,
        updated_at: new Date().toISOString(),
        notes: (row.notes || '').replace(/\[streak:\d+\]/, '').trim() + (row.noUsageCount > 0 ? ` [streak:${row.noUsageCount}]` : '')
      }));

    if (upserts.length === 0) return;

    try {
      await supabase.from(tableName).upsert(upserts);
      
      setManualEdits(prev => {
        const next = { ...prev };
        rows.forEach(row => { next[row.id] = { ...row }; });
        manualEditsRef.current = next;
        return next;
      });
    } catch (error) {
      console.error('[Persistence] Error:', error);
    }
  }, [user, supabase, tableName]);

  useEffect(() => {
    if (user) fetchManualEdits();
  }, [user, fetchManualEdits]);

  useEffect(() => {
    if (rawZohoData.length === 0 && Object.keys(manualEdits).length === 0) return;
    const hydrated = mergeManualEdits(rawZohoData, manualEdits);
    setDisplayData(hydrated);
  }, [rawZohoData, manualEdits]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => loadData({ silent: true, notifyUser: false }), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const updateLocalData = useCallback((updater) => {
    setRawZohoData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  const setData = useCallback((updater) => {
    setRawZohoData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  return {
    data,
    rawZohoData,
    clientsByAgent,
    trackerData,
    loading,
    isSyncing,
    syncSourceLabel,
    lastSyncAt,
    lastCmpSyncAt,
    cmpInvoiceCount,
    manualEdits,
    setManualEdits,
    loadData,
    persistEditedRows,
    aggregateByCompany,
    setData
  };
}