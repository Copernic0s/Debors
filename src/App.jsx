import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { RefreshCw, Users } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import DebtorsList from './components/DebtorsList';
import DebtorModal from './components/DebtorModal';
import CompanyProfileModal from './components/CompanyProfileModal';
import { calculateMetrics } from './data/mockData';
import { fetchAllDataFromSheet } from './services/zohoWorkDrive';
import { BILLING_CYCLES, normalizeBillingCycle } from './constants/billingCycles';
import './index.css';

const MANUAL_EDITS_STORAGE_KEY = 'debors_manual_edits_v1';

const safeReadManualEdits = () => {
  try {
    const raw = localStorage.getItem(MANUAL_EDITS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const mergeManualEdits = (rows, editsById) => {
  return rows
    .filter((row) => !editsById[row.id]?.__deleted)
    .map((row) => {
      const patch = editsById[row.id];
      if (!patch) return row;
      const { amount: _ignoredAmount, ...safePatch } = patch;
      return {
        ...row,
        ...safePatch
      };
    });
};

const parseMoneyValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  let raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;

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
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const roundMoney = (value) => {
  const parsed = parseMoneyValue(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
};

const AppContainer = styled.div`
  display: flex;
  min-height: 100vh;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: transparent;
`;

const Topbar = styled.header`
  min-height: 72px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  background: var(--surface);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  z-index: 10;
  position: relative;

  @media (max-width: 900px) {
    padding: 0.75rem 1rem;
    gap: 0.8rem;
    align-items: flex-start;
    flex-direction: column;
  }
`;

const ContentScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const AgentToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FiltersRow = styled.div`
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
`;

const AgentSelect = styled.select`
  min-width: 260px;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.65rem 0.8rem;
  color: var(--text-main);
  font-family: 'Manrope', inherit;
  font-size: 0.9rem;
  outline: none;

  &:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
  }

  option {
    color: var(--text-main);
    background: var(--bg-2);
  }
`;

const AgentSnapshot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-left: auto;
  background: var(--surface-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 0.7rem 0.9rem;
  color: var(--text-main);

  strong {
    color: var(--text-main);
  }

  span {
    color: var(--text-muted);
    font-size: 0.84rem;
  }

  @media (max-width: 1100px) {
    width: 100%;
  }

  @media (max-width: 768px) {
    padding: 0.6rem 0.75rem;
    font-size: 0.82rem;
  }
`;

const TopbarLeft = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const BrandTitle = styled.h1`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.35rem;
  margin: 0;
  color: #39b8ff;
  letter-spacing: 0.01em;
  font-family: 'Montserrat', sans-serif;

  span {
    color: #86dbff;
    margin-right: 0.5rem;
  }

  @media (max-width: 900px) {
    position: static;
    transform: none;
  }
`;

const TopbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;

  @media (max-width: 900px) {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.75rem;

  @media (max-width: 768px) {
    width: 100%;

    .btn {
      flex: 1;
      padding: 0.58rem 0.75rem;
      font-size: 0.8rem;
    }
  }
`;

const TopbarMeta = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 0.45rem;

  span {
    color: var(--text-muted);
    font-size: 0.78rem;
  }
`;

const SyncButton = styled.button`
  padding: 0.45rem 0.72rem !important;
  font-size: 0.8rem !important;
`;

const mergeDebtorsWithClientSheet = (debtRows, csRows) => {
  const merged = [...debtRows];
  const existingPairs = new Set(
    debtRows.map((row) => `${String(row.agentId || '').trim().toLowerCase()}|${String(row.company || row.clientName || '').trim().toLowerCase()}`)
  );

  csRows.forEach((row) => {
    const agent = String(row.agentId || '').trim();
    const company = String(row.company || '').trim();
    if (!company) return;

    const key = `${agent.toLowerCase()}|${company.toLowerCase()}`;
    if (existingPairs.has(key)) return;

    merged.push({
      id: `CS-${agent || 'UNASSIGNED'}-${company}`,
      invoiceNumber: '',
      company,
      clientName: company,
      contactPerson: '',
      agentId: agent || 'Unassigned',
      billingCycle: 'CS by agent',
      amount: 0,
      dueDate: '',
      status: row.hasDebt ? 'pending' : 'paid',
      notes: row.debtStatus || ''
    });
  });

  return merged;
};

const aggregateByCompany = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const company = String(row.company || row.clientName || '').trim();
    if (!company) return;

    const agent = String(row.agentId || 'Unassigned').trim() || 'Unassigned';
    const key = company.toLowerCase();
    const amount = Number.isFinite(roundMoney(row.amount)) ? roundMoney(row.amount) : 0;

    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...row,
        company,
        clientName: company,
        agentId: agent,
        agentSet: new Set([agent]),
        amount,
        billingCycle: row.billingCycle || BILLING_CYCLES.UNSPECIFIED,
        cycleSet: new Set([row.billingCycle || BILLING_CYCLES.UNSPECIFIED]),
        status: row.status || 'pending',
        notes: row.notes || '',
        invoiceNumber: row.invoiceNumber || '',
        invoiceCount: row.invoiceNumber ? 1 : 0,
        invoiceCountOverride: Number.isFinite(Number(row.invoiceCountOverride)) ? Number(row.invoiceCountOverride) : null,
        dueDate: row.dueDate || '',
        id: `CMP-${key}`
      });
      return;
    }

    current.amount = Number.isFinite(roundMoney(current.amount + amount)) ? roundMoney(current.amount + amount) : 0;
    current.agentSet.add(agent);
    if (row.billingCycle) current.cycleSet.add(row.billingCycle);
    if (row.invoiceNumber) current.invoiceCount += 1;
    if (Number.isFinite(Number(row.invoiceCountOverride))) {
      current.invoiceCountOverride = Number(row.invoiceCountOverride);
    }

    if (row.dueDate) {
      if (!current.dueDate || row.dueDate < current.dueDate) {
        current.dueDate = row.dueDate;
      }
    }

    const statuses = [String(current.status || '').toLowerCase(), String(row.status || '').toLowerCase()];
    if (statuses.some((s) => s === 'overdue')) {
      current.status = 'overdue';
    } else if (statuses.some((s) => s === 'pending')) {
      current.status = 'pending';
    } else {
      current.status = 'paid';
    }
  });

  return Array.from(grouped.values()).map((item) => {
    const agents = Array.from(item.agentSet);
    const cycles = Array.from(item.cycleSet);
    return {
      ...item,
      agentId: agents.length > 1 ? 'Multiple' : agents[0],
      billingCycle: cycles.length > 1 ? BILLING_CYCLES.MULTIPLE : (cycles[0] || BILLING_CYCLES.UNSPECIFIED),
      dueDate: item.dueDate || '',
      invoiceCount: Number.isFinite(Number(item.invoiceCountOverride)) ? Number(item.invoiceCountOverride) : item.invoiceCount,
      agentSet: undefined,
      cycleSet: undefined,
      invoiceCountOverride: item.invoiceCountOverride
    };
  });
};

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSourceLabel, setSyncSourceLabel] = useState('Zoho WorkDrive');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [statusScope, setStatusScope] = useState('open');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDebtor, setCurrentDebtor] = useState(null);
  const [activeCompany, setActiveCompany] = useState(null);
  const [manualEdits, setManualEdits] = useState(() => safeReadManualEdits());
  const syncInFlightRef = useRef(false);
  const manualEditsRef = useRef(manualEdits);

  useEffect(() => {
    manualEditsRef.current = manualEdits;
    localStorage.setItem(MANUAL_EDITS_STORAGE_KEY, JSON.stringify(manualEdits));
  }, [manualEdits]);

  const loadData = useCallback(async ({ silent = false, notifyUser = false } = {}) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
    }
    setIsSyncing(true);

    try {
      const { debtors: sheetData, clientsByAgent: csData } = await fetchAllDataFromSheet(undefined, { cacheBust: true });
      const mergedData = mergeDebtorsWithClientSheet(sheetData, csData);
      const hydratedData = mergeManualEdits(mergedData, manualEditsRef.current);

      if (hydratedData && hydratedData.length > 0) {
        setData(hydratedData);
        setSyncSourceLabel('Zoho WorkDrive');
        if (notifyUser) {
          toast.success(`Sync completed (${hydratedData.length} records)`, {
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      } else {
        setData([]);
        setSyncSourceLabel('Zoho WorkDrive');
        if (notifyUser) {
          toast.error('Zoho returned no rows.', {
            icon: 'ℹ️',
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      }
    } catch {
      setData([]);
      setSyncSourceLabel('Zoho WorkDrive');
      if (notifyUser) {
        toast.error('Unable to connect to Zoho.', {
          style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
        });
      }
    } finally {
      setLastSyncAt(new Date());
      if (!silent) {
        setLoading(false);
      }
      setIsSyncing(false);
      syncInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadData({ silent: true, notifyUser: false });
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (selectedAgent === 'all') return;
    const exists = data.some((item) => String(item.agentId || '').trim() === selectedAgent);
    if (!exists) {
      setSelectedAgent('all');
    }
  }, [selectedAgent, data]);

  useEffect(() => {
    if (selectedWeek === 'all') return;
    const exists = data.some((item) => String(item.weekLabel || '').trim() === selectedWeek);
    if (!exists) {
      setSelectedWeek('all');
    }
  }, [selectedWeek, data]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const pressedSyncShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's';
      if (!pressedSyncShortcut) return;
      event.preventDefault();
      loadData({ notifyUser: true });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loadData]);

  const handleSaveDebtor = (debtor) => {
    if (currentDebtor) {
      const isAggregatedRow = String(currentDebtor.id || '').startsWith('CMP-');

      if (isAggregatedRow) {
        const targetCompany = String(currentDebtor.company || currentDebtor.clientName || '').trim().toLowerCase();
        setData((prev) => {
          const changed = [];
          const next = prev.map((item) => {
            const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
            if (!sameCompany) return item;

            const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
            const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
            if (!inAgentScope || !inWeekScope) return item;

            const updatedRow = {
              ...item,
              company: debtor.company || debtor.clientName,
              clientName: debtor.company || debtor.clientName,
              amount: Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0,
              dueDate: debtor.dueDate,
              status: debtor.status,
              agentId: debtor.agentId,
              billingCycle: debtor.billingCycle,
              notes: debtor.notes
            };
            changed.push(updatedRow);
            return updatedRow;
          });
          persistEditedRows(changed);
          return next;
        });
      } else {
        setData((prev) => {
          const next = prev.map((d) => (d.id === debtor.id ? debtor : d));
          const changed = next.filter((d) => d.id === debtor.id);
          persistEditedRows(changed);
          return next;
        });
      }

      toast.success('Debt updated successfully', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    } else {
      setData([{
        ...debtor,
        amount: Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0
      }, ...data]);
      toast.success('New debtor added', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    }
    setIsModalOpen(false);
    setCurrentDebtor(null);
  };

  const handleDeleteDebtor = (id) => {
    setData((prev) => prev.filter((d) => d.id !== id));
    setManualEdits((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        __deleted: true
      }
    }));
    toast.success('Record deleted', {
      icon: '🗑️',
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const openCompanyProfile = (companyName) => {
    if (!companyName) return;
    setActiveCompany(companyName);
  };

  const persistEditedRows = (rows) => {
    if (!rows || rows.length === 0) return;

    setManualEdits((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (!row?.id) return;
        next[row.id] = {
          ...(next[row.id] || {}),
          __deleted: false,
          status: row.status,
          billingCycle: row.billingCycle,
          dueDate: row.dueDate,
          agentId: row.agentId,
          company: row.company,
          clientName: row.clientName,
          notes: row.notes,
          invoiceCountOverride: row.invoiceCountOverride
        };
      });
      return next;
    });
  };

  const quickUpdateBillingCycle = (row, nextCycle) => {
    const targetCompany = String(row.company || row.clientName || '').trim().toLowerCase();
    if (!targetCompany) return;

    const normalizedNextCycle = normalizeBillingCycle(nextCycle);

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
        if (!sameCompany) return item;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return item;

        const updatedRow = {
          ...item,
          billingCycle: normalizedNextCycle
        };
        changed.push(updatedRow);
        return updatedRow;
      });
      persistEditedRows(changed);
      return next;
    });

    toast.success('Billing cycle updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const quickUpdatePaymentStatus = (row, nextStatus) => {
    const targetCompany = String(row.company || row.clientName || '').trim().toLowerCase();
    if (!targetCompany) return;

    const normalizedStatus = String(nextStatus || '').toLowerCase();

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
        if (!sameCompany) return item;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return item;

        const updatedRow = {
          ...item,
          status: normalizedStatus
        };
        changed.push(updatedRow);
        return updatedRow;
      });
      persistEditedRows(changed);
      return next;
    });

    toast.success('Payment status updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const quickUpdateTotalDue = (row, nextAmount) => {
    const targetCompany = String(row.company || row.clientName || '').trim().toLowerCase();
    if (!targetCompany) return;

    const parsedAmount = roundMoney(nextAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;

    setData((prev) => {
      const matchingIndexes = [];

      prev.forEach((item, index) => {
        const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
        if (!sameCompany) return;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return;

        matchingIndexes.push(index);
      });

      if (matchingIndexes.length === 0) return prev;

      const updated = [...prev];
      if (matchingIndexes.length === 1) {
        const idx = matchingIndexes[0];
        updated[idx] = { ...updated[idx], amount: roundMoney(parsedAmount) };
        persistEditedRows([updated[idx]]);
        return updated;
      }

      const currentTotal = matchingIndexes.reduce((sum, idx) => sum + (Number(updated[idx].amount) || 0), 0);
      if (currentTotal <= 0) {
        matchingIndexes.forEach((idx, index) => {
          updated[idx] = {
            ...updated[idx],
            amount: index === 0 ? roundMoney(parsedAmount) : 0
          };
        });
        persistEditedRows(matchingIndexes.map((idx) => updated[idx]));
        return updated;
      }

      let runningSum = 0;
      matchingIndexes.forEach((idx, index) => {
        if (index === matchingIndexes.length - 1) {
          updated[idx] = { ...updated[idx], amount: roundMoney(parsedAmount - runningSum) };
          return;
        }

        const ratio = (Number(updated[idx].amount) || 0) / currentTotal;
        const nextValue = roundMoney(parsedAmount * ratio);
        runningSum = roundMoney(runningSum + nextValue);
        updated[idx] = { ...updated[idx], amount: nextValue };
      });

      persistEditedRows(matchingIndexes.map((idx) => updated[idx]));
      return updated;
    });

    toast.success('Total due updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const quickUpdateInvoiceCount = (row, nextCount) => {
    const targetCompany = String(row.company || row.clientName || '').trim().toLowerCase();
    if (!targetCompany) return;

    const parsed = Number.parseInt(String(nextCount), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
        if (!sameCompany) return item;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return item;

        const updatedRow = {
          ...item,
          invoiceCountOverride: parsed
        };
        changed.push(updatedRow);
        return updatedRow;
      });
      persistEditedRows(changed);
      return next;
    });

    toast.success('Invoice count updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const weekOptions = Array.from(new Set(data.map((item) => String(item.weekLabel || '').trim()).filter(Boolean))).sort();
  const agentOptions = Array.from(new Set(data.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort();

  const scopedInvoiceData = data.filter((item) => {
    const matchesAgent = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
    const matchesWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
    const isOpen = String(item.status || '').toLowerCase() !== 'paid';
    const matchesStatus = statusScope === 'all' || isOpen;
    return matchesAgent && matchesWeek && matchesStatus;
  });

  const aggregatedData = aggregateByCompany(scopedInvoiceData);
  const agentData = aggregatedData;
  const metrics = calculateMetrics(agentData);

  const clientDebtMap = new Map();
  agentData.forEach((item) => {
    const key = String(item.company || item.clientName || '').trim().toLowerCase();
    if (!key) return;
    const isInDebt = String(item.status || '').toLowerCase() !== 'paid';
    const previous = clientDebtMap.get(key) || false;
    clientDebtMap.set(key, previous || isInDebt);
  });

  const snapshotClients = clientDebtMap.size;
  const snapshotClientsInDebt = Array.from(clientDebtMap.values()).filter(Boolean).length;
  const snapshotClientsClear = snapshotClients - snapshotClientsInDebt;
  const syncTimeLabel = lastSyncAt
    ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(lastSyncAt)
    : '--:--';

  const companyProfile = React.useMemo(() => {
    if (!activeCompany) return null;

    const scopedRows = data.filter((item) => {
      const company = String(item.company || item.clientName || '').trim().toLowerCase();
      const byCompany = company === activeCompany.trim().toLowerCase();
      if (!byCompany) return false;
      const byAgent = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
      const byWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
      return byAgent && byWeek;
    });

    const invoiceRows = scopedRows.filter((item) => !String(item.id || '').startsWith('CS-'));
    const totalDebt = scopedRows
      .filter((item) => String(item.status || '').toLowerCase() !== 'paid')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOverdue = scopedRows
      .filter((item) => String(item.status || '').toLowerCase() === 'overdue')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return {
      company: activeCompany,
      totalDebt,
      totalOverdue,
      invoiceCount: invoiceRows.length,
      agents: Array.from(new Set(scopedRows.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort(),
      contacts: Array.from(new Set(scopedRows.map((item) => String(item.contactPerson || '').trim()).filter(Boolean))).sort(),
      invoices: invoiceRows
        .map((item) => ({
          id: item.id,
          invoiceNumber: item.invoiceNumber || item.id,
          billingCycle: item.billingCycle,
          status: item.status,
          amount: Number(item.amount) || 0
        }))
        .sort((a, b) => String(a.invoiceNumber).localeCompare(String(b.invoiceNumber)))
    };
  }, [activeCompany, data, selectedAgent, selectedWeek]);

  const overviewContent = (
    <div style={{ maxWidth: '1200px', margin: '0 auto', opacity: loading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
      <div style={{ marginBottom: '1.4rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '800', marginBottom: '0.5rem' }}>Collections Overview</h2>
      </div>

      <Dashboard metrics={metrics} />

      <AgentToolbar>
        <FiltersRow>
          <AgentSelect value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
            <option value="all">All agents</option>
            {agentOptions.map((agentName) => (
              <option key={agentName} value={agentName}>{agentName}</option>
            ))}
          </AgentSelect>

          <AgentSelect value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
            <option value="all">All weeks</option>
            {weekOptions.map((weekName) => (
              <option key={weekName} value={weekName}>{weekName}</option>
            ))}
          </AgentSelect>

          <AgentSelect value={statusScope} onChange={(e) => setStatusScope(e.target.value)}>
            <option value="open">Open only</option>
            <option value="all">All statuses</option>
          </AgentSelect>
        </FiltersRow>

        <AgentSnapshot>
          <Users size={16} color="var(--brand)" />
          <div>
            <strong>{snapshotClients}</strong> clients | <strong>{snapshotClientsInDebt}</strong> in debt | <strong>{snapshotClientsClear}</strong> clear
          </div>
        </AgentSnapshot>
      </AgentToolbar>

      <DebtorsList
        data={agentData}
        onOpenCompanyProfile={openCompanyProfile}
        onQuickUpdateBillingCycle={quickUpdateBillingCycle}
        onQuickUpdateStatus={quickUpdatePaymentStatus}
        onQuickUpdateAmount={quickUpdateTotalDue}
        onQuickUpdateInvoiceCount={quickUpdateInvoiceCount}
        onEdit={(debtor) => {
          setCurrentDebtor(debtor);
          setIsModalOpen(true);
        }}
        onDelete={handleDeleteDebtor}
      />
    </div>
  );

  return (
    <AppContainer>
      <MainContent>
        <Topbar>
          <TopbarLeft>
            <BrandTitle><span>Flow Collect</span> Almafuel</BrandTitle>
          </TopbarLeft>

          <TopbarRight>
            <ActionButtons>
              <SyncButton className="btn btn-secondary" onClick={() => loadData({ notifyUser: true })} title="Sync (Ctrl+Shift+S)">
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} /> Sync
              </SyncButton>
            </ActionButtons>
          </TopbarRight>
        </Topbar>

        <ContentScroll>
          <TopbarMeta>
            <span>Source: {syncSourceLabel} | Last sync: {syncTimeLabel} | Shortcut: Ctrl+Shift+S</span>
          </TopbarMeta>
          {overviewContent}
        </ContentScroll>
      </MainContent>

      <DebtorModal
        key={`${currentDebtor?.id || 'new'}-${isModalOpen ? 'open' : 'closed'}`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDebtor}
        debtor={currentDebtor}
      />

      <CompanyProfileModal
        isOpen={Boolean(activeCompany)}
        onClose={() => setActiveCompany(null)}
        profile={companyProfile}
      />

      <Toaster position="bottom-right" />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </AppContainer>
  );
}

export default App;
