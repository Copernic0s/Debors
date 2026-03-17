import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { RefreshCw, Users, List, BarChart2, Clock } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import DebtorsList from './components/DebtorsList';
import DebtorModal from './components/DebtorModal';
import CompanyProfileModal from './components/CompanyProfileModal';
import ManagerAnalytics from './components/ManagerAnalytics';
import Login from './components/Login';
import InvoiceRoadmap from './components/InvoiceRoadmap';
import ProcessInvoiceModal from './components/ProcessInvoiceModal';
import { supabase, hasSupabaseConfig } from './lib/supabase';
import { calculateMetrics } from './data/mockData';
import { fetchAllDataFromSheet } from './services/zohoWorkDrive';
import { BILLING_CYCLES, normalizeBillingCycle } from './constants/billingCycles';
import './index.css';

// Table used for cloud persistence
const TABLE_NAME = 'manual_edits';

const mergeManualEdits = (rows, editsById) => {
  const merged = rows
    .filter((row) => !editsById[row.id]?.__deleted)
    .map((row) => {
      const patch = editsById[row.id];
      if (!patch) return row;
      // Merge all edits, prioritizing manual overrides
      return {
        ...row,
        ...patch
      };
    });

  const existingIds = new Set(merged.map((r) => r.id));
  Object.values(editsById).forEach((edit) => {
    if (edit.__isNew && !edit.__deleted && !existingIds.has(edit.id)) {
      merged.unshift({ ...edit });
    }
  });

  return merged;
};

const parseMoneyValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  let raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;

  raw = raw
    .replace(/[$€£]/g, '')
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

const roundMoney = (value) => {
  const parsed = parseMoneyValue(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : Number.NaN;
};

const AppContainer = styled.div`
  min-height: 100vh;
  background: transparent;
  color: var(--text-main);
  font-family: 'Manrope', sans-serif;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
  width: 100%;
`;

const BackgroundParticles = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
`;

const Particle = styled.div`
  position: absolute;
  width: ${props => props.$size}px;
  height: ${props => props.$size}px;
  background: ${props => props.$color || 'rgba(56, 189, 248, 0.2)'};
  border-radius: 50%;
  top: ${props => props.$top}%;
  left: ${props => props.$left}%;
  filter: blur(${props => props.$blur}px);
  will-change: transform;
  animation: float ${props => props.$duration}s ease-in-out infinite;
  animation-delay: ${props => props.$delay}s;
  opacity: ${props => props.$opacity || 0.12};
  pointer-events: none;

  @keyframes float {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(${props => props.$tx}px, ${props => props.$ty}px, 0); }
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: transparent;
`;

const Topbar = styled.header`
  min-height: 72px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 10;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--brand), transparent);
    background-size: 200% 100%;
    animation: borderGlow 4s ease-in-out infinite;
    opacity: 0.5;
  }

  @keyframes borderGlow {
    0% { background-position: -100% 0; opacity: 0.3; }
    50% { opacity: 0.6; }
    100% { background-position: 100% 0; opacity: 0.3; }
  }

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
  font-size: 1.6rem;
  font-weight: 900;
  margin: 0;
  background: linear-gradient(135deg, #fff 0%, var(--brand) 50%, #fff 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-family: 'Outfit', sans-serif;
  animation: shine 5s linear infinite;

  @keyframes shine {
    to { background-position: 200% center; }
  }

  span {
    display: none;
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

const ViewSwitch = styled.div`
  display: inline-flex;
  gap: 0.3rem;
  margin-bottom: 1.5rem;
  padding: 0.4rem;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
`;

const ViewButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? 'rgba(56, 189, 248, 0.4)' : 'transparent')};
  background: ${(props) => (props.$active ? 'rgba(56, 189, 248, 0.18)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--brand)' : 'var(--text-muted)')};
  font-weight: 700;
  padding: 0.45rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.85rem;
  letter-spacing: 0.02em;

  &:hover {
    color: var(--text-main);
    background: ${(props) => (props.$active ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.05)')};
    transform: ${(props) => (props.$active ? 'none' : 'translateY(-1px)')};
  }

  ${(props) => props.$active && `
    box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);
    text-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
  `}

  .priority-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    box-shadow: 0 0 10px #ef4444;
    border: 1px solid rgba(255,255,255,0.2);
  }
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
      status: row.hasDebt ? 'no_invoice' : 'paid',
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
        hasInvoice: Boolean(String(row.invoiceNumber || '').trim()),
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
    if (String(row.invoiceNumber || '').trim()) current.hasInvoice = true;
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
    
    // NEW INACTIVE LOGIC
    // Sort all rows for this company by week (simple sort for now)
    const companyRows = rows.filter(r => 
      String(r.company || r.clientName || '').trim().toLowerCase() === item.company.toLowerCase()
    ).sort((a, b) => String(a.weekLabel || '').localeCompare(String(b.weekLabel || '')));

    const lastRows = companyRows.slice(-3);
    const last3NoUsage = lastRows.length >= 3 && lastRows.every(r => r.lastNoUsageDate);
    
    const last2Rows = companyRows.slice(-2);
    const last2NoInvoiceAndNotPaid = last2Rows.length >= 2 && last2Rows.every(r => {
      const s = String(r.status || '').toLowerCase();
      return !r.invoiceNumber && s !== 'paid';
    });

    if (last3NoUsage || last2NoInvoiceAndNotPaid) {
      item.status = 'inactive';
    }

    return {
      ...item,
      agentId: agents.join(', '),
      billingCycle: cycles.length > 1 ? BILLING_CYCLES.MULTIPLE : (cycles[0] || BILLING_CYCLES.UNSPECIFIED),
      dueDate: item.dueDate || '',
      invoiceCount: Number.isFinite(Number(item.invoiceCountOverride)) ? Number(item.invoiceCountOverride) : item.invoiceCount,
      sourceType: item.hasInvoice ? 'invoice' : 'cs',
      agentSet: undefined,
      cycleSet: undefined,
      invoiceCountOverride: item.invoiceCountOverride
    };
  });
};

function App() {
  const [data, setData] = useState([]);
  const [rawZohoData, setRawZohoData] = useState([]);
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'analytics', 'sla'
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSourceLabel, setSyncSourceLabel] = useState('Zoho WorkDrive');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [statusScope, setStatusScope] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDebtor, setCurrentDebtor] = useState(null);
  const [activeCompany, setActiveCompany] = useState(null);
  const [manualEdits, setManualEdits] = useState({});
  const [user, setUser] = useState(null);
  const syncInFlightRef = useRef(false);
  const manualEditsRef = useRef({});

  // New states for Process Billing Flow
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processingDebtor, setProcessingDebtor] = useState(null);
  const [suggestedInv, setSuggestedInv] = useState('');

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchManualEdits = useCallback(async () => {
    if (!user) return;
    try {
      const { data: edits, error } = await supabase
        .from(TABLE_NAME)
        .select('*');

      if (error) throw error;

      const editsById = {};
      edits.forEach(edit => {
        editsById[edit.id] = {
          ...edit,
          // Map DB snake_case to App camelCase
          company: edit.company,
          clientName: edit.company,
          agentId: edit.agent_id,
          dueDate: edit.due_date,
          billingCycle: edit.billing_cycle,
          lastInvoicedDate: edit.last_invoiced_date,
          lastNoUsageDate: edit.last_no_usage_date,
          invoiceNumber: edit.invoice_number,
          notes: edit.notes || '',
          __isNew: edit.is_new,
          __deleted: edit.is_deleted
        };
      });

      setManualEdits(editsById);
      manualEditsRef.current = editsById;
    } catch (error) {
      console.error('Error fetching manual edits:', error.message);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchManualEdits();
    }
  }, [user, fetchManualEdits]);

  // Reactive Data Hydration: Merges Zoho Data + Manual Edits whenever either changes
  useEffect(() => {
    if (rawZohoData.length === 0 && Object.keys(manualEdits).length === 0) return;

    // Always merge from the LATEST reference of manualEdits
    const hydrated = mergeManualEdits(rawZohoData, manualEdits);

    // Apply Smart Billing Logic: Auto-Overdue
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const withSmartStatus = hydrated.map(row => {
      let status = row.status || 'pending';
      let isAutoOverdue = false;

      // Only attempt auto-overdue if the status isn't already 'paid' or 'no_invoice'
      if (status !== 'paid' && status !== 'no_invoice' && row.dueDate) {
        const parsedDue = new Date(`${row.dueDate}T00:00:00`);
        if (!Number.isNaN(parsedDue.getTime()) && parsedDue < dayStart) {
          status = 'overdue';
          isAutoOverdue = true;
        }
      }

      return { ...row, status, isAutoOverdue };
    });

    setData(withSmartStatus);
  }, [rawZohoData, manualEdits]);

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

      if (mergedData && mergedData.length > 0) {
        setRawZohoData(mergedData);
        setSyncSourceLabel('Zoho WorkDrive');
        if (notifyUser) {
          toast.success(`Sync completed (${mergedData.length} records)`, {
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      } else {
        setRawZohoData([]);
        setSyncSourceLabel('Zoho WorkDrive');
        if (notifyUser) {
          toast.error('Zoho returned no rows.', {
            icon: 'ℹ️',
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      }
    } catch (err) {
      console.error('[Sync] Load data failed:', err);
      // No data wiping
      setSyncSourceLabel('Offline Data');
      if (notifyUser) {
        toast.error('Unable to connect to Zoho. Using offline data.', {
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
              invoiceNumber: debtor.invoiceNumber,
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
      const newId = debtor.id || `MANUAL-${Date.now()}`;
      const newDebtor = {
        ...debtor,
        id: newId,
        amount: Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0
      };
      setData([newDebtor, ...data]);
      setManualEdits((prev) => {
        const nextEdit = {
          ...newDebtor,
          __isNew: true,
          __deleted: false
        };
        const next = {
          ...prev,
          [newId]: nextEdit
        };
        persistEditedRows([nextEdit]);
        return next;
      });
      toast.success('New debtor added', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    }
    setIsModalOpen(false);
    setCurrentDebtor(null);
  };

  const handleResetDebtor = async (id) => {
    if (!user || !id) return;
    try {
      // 1. Delete from Supabase to effectively remove the override
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', String(id));

      if (error) throw error;

      // 2. Remove from local state
      setManualEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        manualEditsRef.current = next;
        return next;
      });

      toast.success('Override removed. Restoring Zoho data...', {
        icon: '🔄',
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
      setIsModalOpen(false);
      setCurrentDebtor(null);
    } catch (error) {
      toast.error('Failed to reset record');
      console.error(error);
    }
  };

  const handleDeleteDebtor = (id) => {
    if (String(id).startsWith('CMP-')) {
      const targetCompany = String(id).replace('CMP-', '').trim().toLowerCase();

      const rowsToDelete = data.filter((d) =>
        String(d.company || d.clientName || '').trim().toLowerCase() === targetCompany
      );

      setData((prev) => prev.filter((d) =>
        String(d.company || d.clientName || '').trim().toLowerCase() !== targetCompany
      ));

      setManualEdits((prev) => {
        const next = { ...prev };
        const changed = [];
        rowsToDelete.forEach((d) => {
          const edit = { ...(next[d.id] || {}), id: d.id, __deleted: true };
          next[d.id] = edit;
          changed.push(edit);
        });
        persistEditedRows(changed);
        return next;
      });
    } else {
      setData((prev) => prev.filter((d) => d.id !== id));
      setManualEdits((prev) => {
        const edit = {
          ...(prev[id] || {}),
          id,
          __deleted: true
        };
        const next = {
          ...prev,
          [id]: edit
        };
        persistEditedRows([edit]);
        return next;
      });
    }
    toast.success('Record deleted', {
      icon: '🗑️',
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const openCompanyProfile = (companyName) => {
    if (!companyName) return;
    setActiveCompany(companyName);
  };

  const persistEditedRows = async (rows) => {
    if (!rows || rows.length === 0 || !user) return;

    // Optimization: Filter out virtual rows (CS-...) that don't exist in Supabase
    // We also filter out any null or undefined IDs.
    const upserts = rows
      .filter(row => row.id && !String(row.id).startsWith('CS-'))
      .map(row => ({
        id: String(row.id),
        amount: Number(row.amount) || 0,
        status: String(row.status || 'pending'),
        notes: String(row.notes || ''),
        agent_id: String(row.agentId || 'Unassigned'),
        billing_cycle: String(row.billingCycle || 'Unspecified'),
        due_date: row.dueDate || null,
        company: String(row.company || row.clientName || 'Unknown'),
        is_new: Boolean(row.__isNew),
        is_deleted: Boolean(row.__deleted),
        last_invoiced_date: row.lastInvoicedDate || null,
        last_no_usage_date: row.lastNoUsageDate || null,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
        invoice_number: row.invoiceNumber || null
      }));

    if (upserts.length === 0) return;

    console.log('[Persistence] Upserting rows:', upserts.length, upserts);

    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .upsert(upserts);

      if (error) {
        console.error('[Persistence] Supabase Error:', error);
        throw error;
      }

      // Update local ref after successful DB update
      setManualEdits(prev => {
        const next = { ...prev };
        rows.forEach(row => {
          next[row.id] = { ...row };
        });
        manualEditsRef.current = next;
        return next;
      });
    } catch (error) {
      const msg = error?.message || 'Unknown network error';
      toast.error(`Cloud Sync Failed: ${msg}`, { duration: 5000 });
      console.error('[Persistence] Detailed Error:', error);
    }
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

  const handleMarkInvoiced = (debtor) => {
    const targetCompany = String(debtor.company || debtor.clientName || '').trim().toLowerCase();
    if (!targetCompany) return;

    // Auto-detection logic: Find any existing invoice number for this company
    // in the current data set to suggest to the user.
    const existing = data.find(item =>
      String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany &&
      item.invoiceNumber &&
      String(item.invoiceNumber).trim() !== ''
    );

    setSuggestedInv(existing ? existing.invoiceNumber : '');
    setProcessingDebtor(debtor);
    setIsProcessModalOpen(true);
  };

  const handleConfirmProcess = (invNumber) => {
    if (!processingDebtor) return;
    const targetCompany = String(processingDebtor.company || processingDebtor.clientName || '').trim().toLowerCase();
    const todayDate = new Date().toISOString().split('T')[0];

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
        if (!sameCompany) return item;

        // Sync: If it's the target company, mark lastInvoicedDate
        const updated = {
          ...item,
          lastInvoicedDate: todayDate,
          invoiceNumber: invNumber || item.invoiceNumber
          // Explicitly keeping the previous status to avoid auto-marking as 'paid'
        };
        changed.push(updated);
        return updated;
      });

      persistEditedRows(changed);
      return next;
    });

    toast.success(`${processingDebtor.company} confirmed (Inv: ${invNumber || 'N/A'})`, {
      icon: '✅',
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });

    setIsProcessModalOpen(false);
    setProcessingDebtor(null);
  };

  const handleMarkNoUsage = (debtor) => {
    const targetCompany = String(debtor.company || debtor.clientName || '').trim().toLowerCase();
    if (!targetCompany) return;

    const todayDate = new Date().toISOString().split('T')[0];

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = String(item.company || item.clientName || '').trim().toLowerCase() === targetCompany;
        if (!sameCompany) return item;

        const updated = { ...item, lastNoUsageDate: todayDate };
        changed.push(updated);
        return updated;
      });

      persistEditedRows(changed);
      return next;
    });

    toast.success(`${debtor.company} marked as No Usage`, {
      icon: '🚫',
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };


  const weekOptions = React.useMemo(() => Array.from(new Set(data.map((item) => String(item.weekLabel || '').trim()).filter(Boolean))).sort(), [data]);
  const agentOptions = React.useMemo(() => Array.from(new Set(data.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort(), [data]);

  const scopedInvoiceData = React.useMemo(() => data.filter((item) => {
    const matchesAgent = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
    const matchesWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
    const status = String(item.status || '').toLowerCase();
    const isOpen = status === 'pending' || status === 'overdue';
    const matchesStatus = statusScope === 'all' || isOpen;
    return matchesAgent && matchesWeek && matchesStatus;
  }), [data, selectedAgent, selectedWeek, statusScope]);

  const aggregatedData = React.useMemo(() => aggregateByCompany(scopedInvoiceData), [scopedInvoiceData]);
  const agentData = aggregatedData;
  const metrics = React.useMemo(() => calculateMetrics(agentData), [agentData]);

  const { snapshotClients, snapshotClientsInDebt, snapshotClientsClear } = React.useMemo(() => {
    const map = new Map();
    agentData.forEach((item) => {
      const key = String(item.company || item.clientName || '').trim().toLowerCase();
      if (!key) return;
      const isInDebt = String(item.status || '').toLowerCase() !== 'paid';
      const previous = map.get(key) || false;
      map.set(key, previous || isInDebt);
    });

    const size = map.size;
    const inDebt = Array.from(map.values()).filter(Boolean).length;
    return {
      snapshotClients: size,
      snapshotClientsInDebt: inDebt,
      snapshotClientsClear: size - inDebt
    };
  }, [agentData]);
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
      invoices: invoiceRows.sort((a, b) => 
        String(a.invoiceNumber || a.id).localeCompare(String(b.invoiceNumber || b.id))
      )
    };
  }, [activeCompany, data, selectedAgent, selectedWeek]);

  const slaPriorityCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();

    const getEarliestUnprocessedInvDate = (item) => {
      const cycle = normalizeBillingCycle(item.billingCycle);
      if (cycle === BILLING_CYCLES.CS_BY_AGENT || cycle === BILLING_CYCLES.UNSPECIFIED || cycle === BILLING_CYCLES.MULTIPLE) return null;

      const getDates = (type, refDate) => {
        const inv = new Date(refDate);
        const d = refDate.getDay();
        let target = (type === 'MON' ? 1 : 4);
        let diff = d - target;
        if (diff < 0) diff += 7;
        inv.setDate(refDate.getDate() - diff);
        return inv;
      };

      let currentRef = new Date(today);
      let iterations = 0;
      let finalInv = null;

      while (iterations < 2) {
        let inv = null;
        if (cycle === BILLING_CYCLES.MONDAY_SUNDAY) inv = getDates('MON', currentRef);
        else if (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY) inv = getDates('THU', currentRef);
        else if (cycle === BILLING_CYCLES.TWICE) {
          const invA = getDates('THU', currentRef);
          const invB = getDates('MON', currentRef);
          inv = invA > invB ? invA : invB;
        }

        if (!inv) break;

        const isProcessed = (item.lastInvoicedDate && new Date(item.lastInvoicedDate + 'T00:00:00') >= inv) ||
          (item.lastNoUsageDate && new Date(item.lastNoUsageDate + 'T00:00:00') >= inv);

        if (!isProcessed) {
          finalInv = inv;
          break;
        }

        currentRef = new Date(inv);
        if (cycle === BILLING_CYCLES.TWICE) {
          currentRef.setDate(inv.getDate() + (inv.getDay() === 1 ? 4 : 3));
        } else {
          currentRef.setDate(inv.getDate() + 7);
        }
        iterations++;
      }
      return finalInv;
    };

    return agentData.filter(item => {
      const invDate = getEarliestUnprocessedInvDate(item);
      return invDate && today >= invDate;
    }).length;
  }, [agentData]);

  const overviewContent = (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      width: '100%',
      opacity: loading ? 0.5 : 1, 
      transition: 'opacity 0.3s' 
    }}>
      <TopbarMeta>
        <span>User: {user?.email} | Source: {syncSourceLabel} | Last sync: {syncTimeLabel}</span>
      </TopbarMeta>

      <ViewSwitch>
        <ViewButton type="button" $active={activeView === 'overview'} onClick={() => setActiveView('overview')}>Overview</ViewButton>
        <ViewButton type="button" $active={activeView === 'analytics'} onClick={() => setActiveView('analytics')}>Manager Analytics</ViewButton>
        <ViewButton type="button" $statusColor="#38bdf8" $active={activeView === 'sla'} onClick={() => setActiveView('sla')} style={{ position: 'relative' }}>
          SLA Monitor
          {slaPriorityCount > 0 && <div className="priority-badge" />}
        </ViewButton>
      </ViewSwitch>

      <div style={{ marginBottom: '1.4rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '800', marginBottom: '0.5rem' }}>Collections Overview</h2>
      </div>

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
            <option value="all">All records</option>
            <option value="open">Open balances only</option>
          </AgentSelect>

        </FiltersRow>

        <AgentSnapshot>
          <Users size={16} color="var(--brand)" />
          <div>
            <strong>{snapshotClients}</strong> clients | <strong>{snapshotClientsInDebt}</strong> in debt | <strong>{snapshotClientsClear}</strong> clear
          </div>
        </AgentSnapshot>
      </AgentToolbar>

      {activeView === 'overview' && (
        <>
          <Dashboard metrics={metrics} />
          <DebtorsList
            data={agentData}
            onOpenCompanyProfile={openCompanyProfile}
            onQuickUpdateBillingCycle={quickUpdateBillingCycle}
            onQuickUpdateStatus={quickUpdatePaymentStatus}
            onQuickUpdateAmount={quickUpdateTotalDue}
            onEdit={(debtor) => {
              setCurrentDebtor(debtor);
              setIsModalOpen(true);
            }}
            onDelete={handleDeleteDebtor}
          />
        </>
      )}

      {activeView === 'analytics' && (
        <ManagerAnalytics
          invoiceRows={scopedInvoiceData}
          aggregatedRows={agentData}
          selectedAgent={selectedAgent}
          onSelectAgent={(agentName) => setSelectedAgent(agentName || 'all')}
          onOpenCompanyProfile={openCompanyProfile}
        />
      )}

      {activeView === 'sla' && (
        <InvoiceRoadmap
          data={agentData}
          onMarkInvoiced={handleMarkInvoiced}
          onMarkNoUsage={handleMarkNoUsage}
        />
      )}
    </div>
  );

  // Atmospheric ALMAFUEL Background - Optimized for low RAM
  const backgroundElements = React.useMemo(() => {
    return [
      { id: 'b1', size: 600, top: 10, left: 10, color: 'rgba(56, 189, 248, 0.06)', blur: 80, duration: 25, tx: 40, ty: 20 },
      { id: 'b2', size: 500, top: 60, left: 70, color: 'rgba(129, 140, 248, 0.05)', blur: 100, duration: 30, tx: -30, ty: -15 },
      { id: 'b3', size: 400, top: 80, left: 20, color: 'rgba(56, 189, 248, 0.04)', blur: 70, duration: 20, tx: 20, ty: 40 },
      { id: 'b4', size: 550, top: 20, left: 80, color: 'rgba(129, 140, 248, 0.05)', blur: 90, duration: 28, tx: -20, ty: 30 }
    ];
  }, []);

  if (!hasSupabaseConfig) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white', fontFamily: 'sans-serif', textAlign: 'center', padding: '2rem' }}>
        <div>
          <h1 style={{ color: '#39b8ff' }}>Missing Configuration</h1>
          <p>Please check your Vercel Environment Variables.</p>
          <code style={{ background: '#1e293b', padding: '0.5rem', borderRadius: '4px', display: 'block', marginTop: '1rem' }}>VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY</code>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AppContainer>
        <BackgroundParticles>
          {backgroundElements.map(p => (
            <Particle
              key={p.id}
              $size={p.size}
              $top={p.top}
              $left={p.left}
              $blur={p.blur}
              $duration={p.duration}
              $delay={p.delay}
              $tx={p.tx}
              $ty={p.ty}
              $color={p.color}
            />
          ))}
        </BackgroundParticles>
        <Login onLogin={setUser} />
        <Toaster position="bottom-right" />
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <BackgroundParticles>
        {backgroundElements.map(p => (
          <Particle
            key={p.id}
            $size={p.size}
            $top={p.top}
            $left={p.left}
            $blur={p.blur}
            $duration={p.duration}
            $delay={p.delay}
            $tx={p.tx}
            $ty={p.ty}
            $color={p.color}
            $opacity={p.opacity}
          />
        ))}
      </BackgroundParticles>
      <MainContent style={{ position: 'relative', zIndex: 1 }}>
        <Topbar>
          <TopbarLeft>
            <BrandTitle>DEBORS ALMAFUEL</BrandTitle>
          </TopbarLeft>

          <TopbarRight>
            <ActionButtons>
              <SyncButton className="btn btn-secondary" onClick={() => loadData({ notifyUser: true })} title="Sync (Ctrl+Shift+S)">
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} /> Sync
              </SyncButton>
              <button
                className="btn btn-outline"
                onClick={() => supabase.auth.signOut()}
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.72rem' }}
              >
                Logout
              </button>
            </ActionButtons>
          </TopbarRight>
        </Topbar>

        <ContentScroll>
          {overviewContent}
        </ContentScroll>
      </MainContent>

      <DebtorModal
        key={`${currentDebtor?.id || 'new'}-${isModalOpen ? 'open' : 'closed'}`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDebtor}
        onReset={handleResetDebtor}
        debtor={currentDebtor}
      />

      <CompanyProfileModal
        isOpen={Boolean(activeCompany)}
        onClose={() => setActiveCompany(null)}
        profile={companyProfile}
        onEditInvoice={(inv) => {
          setActiveCompany(null);
          setCurrentDebtor(inv);
          setIsModalOpen(true);
        }}
      />

      <ProcessInvoiceModal
        isOpen={isProcessModalOpen}
        onClose={() => setIsProcessModalOpen(false)}
        onConfirm={handleConfirmProcess}
        companyName={processingDebtor?.company || ''}
        suggestedInv={suggestedInv}
      />

      <Toaster position="bottom-right" />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </AppContainer>
  );
}

export default App;
