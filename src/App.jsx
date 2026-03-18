import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import styled from 'styled-components';
import { RefreshCw, Users, List, BarChart2, Clock } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import DebtorsList from './components/DebtorsList';
import DebtorModal from './components/DebtorModal';
import CompanyProfileModal from './components/CompanyProfileModal';
import Login from './components/Login';
import InvoiceRoadmap from './components/InvoiceRoadmap';
import ProcessInvoiceModal from './components/ProcessInvoiceModal';
import { supabase, hasSupabaseConfig } from './lib/supabase';
import { calculateMetrics } from './data/mockData';
import { fetchAllDataFromSheet } from './services/zohoWorkDrive';

const ManagerAnalytics = lazy(() => import('./components/ManagerAnalytics'));
import { BILLING_CYCLES, normalizeBillingCycle } from './constants/billingCycles';
import { isOverdue } from './utils/dateUtils';
import './index.css';

// Table used for cloud persistence
const TABLE_NAME = 'manual_edits';

const mergeManualEdits = (rows, editsById) => {
  const merged = rows
    .filter((row) => !editsById[row.id]?.__deleted)
    .map((row) => {
      const patch = editsById[row.id];
      if (!patch) return row;
      const { __editedFields: patchEditedFields, ...patchData } = patch;
      const existingEditedFields = row.__editedFields || {};
      const mergedEditedFields = { ...existingEditedFields, ...patchEditedFields };
      return {
        ...row,
        ...patchData,
        __editedFields: mergedEditedFields
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

const normalizeCompanyKey = (name) => {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/['''`]/g, "'").replace(/[""]/g, '"').replace(/–/g, '-').replace(/\s+/g, ' ');
};

const AnalyticsSkeletonGrid = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1rem;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const AnalyticsSkeletonPanel = styled.section`
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(12px);
  padding: 1.5rem;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  content-visibility: auto;
  contain-intrinsic-size: 1px 320px;
`;

const SkeletonBar = styled.div`
  height: ${props => props.$h || '280px'};
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.03) 0%,
    rgba(255,255,255,0.07) 50%,
    rgba(255,255,255,0.03) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const AnalyticsSkeleton = () => (
  <AnalyticsSkeletonGrid>
    <AnalyticsSkeletonPanel>
      <SkeletonBar $h="20px" style={{ maxWidth: '60%' }} />
      <SkeletonBar $h="280px" />
    </AnalyticsSkeletonPanel>
    <AnalyticsSkeletonPanel>
      <SkeletonBar $h="20px" style={{ maxWidth: '60%' }} />
      <SkeletonBar $h="280px" />
    </AnalyticsSkeletonPanel>
    <AnalyticsSkeletonPanel>
      <SkeletonBar $h="20px" style={{ maxWidth: '60%' }} />
      <SkeletonBar $h="280px" />
    </AnalyticsSkeletonPanel>
    <AnalyticsSkeletonPanel>
      <SkeletonBar $h="20px" style={{ maxWidth: '60%' }} />
      <SkeletonBar $h="280px" />
    </AnalyticsSkeletonPanel>
  </AnalyticsSkeletonGrid>
);

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
    debtRows.map((row) => `${String(row.agentId || '').trim().toLowerCase()}|${normalizeCompanyKey(row.company || row.clientName)}`)
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
      normalizeCompanyKey(r.company || r.clientName) === normalizeCompanyKey(item.company)
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
        let __editedFields = {};
        if (edit.__edited_fields) {
          try { __editedFields = JSON.parse(edit.__edited_fields); } catch {}
        }
        editsById[edit.id] = {
          ...edit,
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
          __deleted: edit.is_deleted,
          __editedFields
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

  // Data Repair: If we have confirm records (lastInvoicedDate) but no dueDate,
  // calculate it and persist it. Runs once on initial load.
  useEffect(() => {
    if (loading || !manualEdits || Object.keys(manualEdits).length === 0) return;

    const toFix = Object.values(manualEdits).filter(edit => 
      edit.lastInvoicedDate && (!edit.dueDate || String(edit.dueDate).trim() === '')
    );

    if (toFix.length > 0) {
      console.log(`[Repair] Found ${toFix.length} records missing dueDate. Patching...`);
      const fixed = toFix.map(item => {
        const invDate = new Date(item.lastInvoicedDate + 'T00:00:00');
        invDate.setDate(invDate.getDate() + 1);
        const due = invDate.toISOString().split('T')[0];
        return { ...item, dueDate: due };
      });

      // Update local state and persist to DB
      setManualEdits(prev => {
        const next = { ...prev };
        fixed.forEach(f => { next[f.id] = f; });
        manualEditsRef.current = next;
        return next;
      });
      persistEditedRows(fixed);
    }
  }, [loading]);

  // Reactive Data Hydration: Merges Zoho Data + Manual Edits whenever either changes
  useEffect(() => {
    if (rawZohoData.length === 0 && Object.keys(manualEdits).length === 0) return;

    const hydrated = mergeManualEdits(rawZohoData, manualEdits);

    const withSmartStatus = hydrated.map(row => {
      const status = row.status || 'pending';
      const isManuallyEdited = row.__editedFields?.status === true;
      let isAutoOverdue = false;

      if (isManuallyEdited) {
        return { ...row, isAutoOverdue: false };
      }

      if (status !== 'paid' && status !== 'no_invoice' && row.dueDate) {
        if (isOverdue(row.dueDate)) {
          isAutoOverdue = true;
          return { ...row, status: 'overdue', isAutoOverdue };
        } else if (status === 'overdue') {
          return { ...row, status: 'pending', isAutoOverdue: false };
        }
      }

      return { ...row, isAutoOverdue };
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
            const sameCompany = normalizeCompanyKey(item.company || item.clientName) === targetCompany;
            if (!sameCompany) return item;

            const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
            const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
            if (!inAgentScope || !inWeekScope) return item;

            const newAmount = Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0;
            const editedFields = {};
            if (item.amount !== newAmount) editedFields.amount = true;
            if (item.status !== debtor.status) editedFields.status = true;
            if (item.dueDate !== debtor.dueDate) editedFields.dueDate = true;
            if (item.billingCycle !== debtor.billingCycle) editedFields.billingCycle = true;
            if (item.agentId !== debtor.agentId) editedFields.agentId = true;
            if (item.notes !== debtor.notes) editedFields.notes = true;
            if (item.invoiceNumber !== debtor.invoiceNumber) editedFields.invoiceNumber = true;

            const updatedRow = {
              ...item,
              company: debtor.company || debtor.clientName,
              clientName: debtor.company || debtor.clientName,
              amount: newAmount,
              dueDate: debtor.dueDate,
              status: debtor.status,
              agentId: debtor.agentId,
              billingCycle: debtor.billingCycle,
              invoiceNumber: debtor.invoiceNumber,
              notes: debtor.notes,
              __editedFields: { ...item.__editedFields, ...editedFields }
            };
            changed.push(updatedRow);
            return updatedRow;
          });

          if (changed.length > 0) {
            setManualEdits(prevEdits => {
              const nextEdits = { ...prevEdits };
              changed.forEach(row => {
                nextEdits[row.id] = row;
              });
              manualEditsRef.current = nextEdits;
              return nextEdits;
            });
            persistEditedRows(changed);
          }
          return next;
        });
      } else {
        setData((prev) => {
          const existing = prev.find(d => d.id === debtor.id);
          const editedFields = {};
          if (existing) {
            if (existing.amount !== debtor.amount) editedFields.amount = true;
            if (existing.status !== debtor.status) editedFields.status = true;
            if (existing.dueDate !== debtor.dueDate) editedFields.dueDate = true;
            if (existing.billingCycle !== debtor.billingCycle) editedFields.billingCycle = true;
            if (existing.agentId !== debtor.agentId) editedFields.agentId = true;
            if (existing.notes !== debtor.notes) editedFields.notes = true;
            if (existing.invoiceNumber !== debtor.invoiceNumber) editedFields.invoiceNumber = true;
          }

          const updatedDebtor = {
            ...debtor,
            __editedFields: { ...(existing?.__editedFields || {}), ...editedFields }
          };
          const next = prev.map((d) => (d.id === debtor.id ? updatedDebtor : d));
          setManualEdits(prevEdits => {
            const nextEdits = { ...prevEdits, [debtor.id]: updatedDebtor };
            manualEditsRef.current = nextEdits;
            return nextEdits;
          });
          persistEditedRows([updatedDebtor]);
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
        amount: Number.isFinite(roundMoney(debtor.amount)) ? roundMoney(debtor.amount) : 0,
        __isNew: true,
        __deleted: false,
        __editedFields: { amount: true, status: true, dueDate: true, billingCycle: true, agentId: true, notes: true, invoiceNumber: true, company: true }
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
        normalizeCompanyKey(d.company || d.clientName) === targetCompany
      );

      setData((prev) => prev.filter((d) =>
        normalizeCompanyKey(d.company || d.clientName) !== targetCompany
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

    const upserts = rows
      .filter(row => row.id)
      .map(row => {
        const editedFields = row.__editedFields ? JSON.stringify(row.__editedFields) : null;
        return {
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
          invoice_number: row.invoiceNumber || null,
          __edited_fields: editedFields
        };
      });

    if (upserts.length === 0) return;

    console.log('[Persistence] Upserting rows:', upserts.length);

    try {
      const { error } = await supabase
        .from(TABLE_NAME)
        .upsert(upserts);

      if (error) {
        console.error('[Persistence] Supabase Error:', error);
        throw error;
      }

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
    const targetCompany = normalizeCompanyKey(row.company || row.clientName);
    if (!targetCompany) return;

    const normalizedNextCycle = normalizeBillingCycle(nextCycle);

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = normalizeCompanyKey(item.company || item.clientName) === targetCompany;
        if (!sameCompany) return item;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return item;

        const updatedRow = {
          ...item,
          billingCycle: normalizedNextCycle,
          __editedFields: { ...item.__editedFields, billingCycle: true }
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
    const targetCompany = normalizeCompanyKey(row.company || row.clientName);
    if (!targetCompany) return;

    const normalizedStatus = String(nextStatus || '').toLowerCase();

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = normalizeCompanyKey(item.company || item.clientName) === targetCompany;
        if (!sameCompany) return item;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return item;

        const updatedRow = {
          ...item,
          status: normalizedStatus,
          __editedFields: { ...item.__editedFields, status: true }
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
    const targetCompany = normalizeCompanyKey(row.company || row.clientName);
    if (!targetCompany) return;

    const parsedAmount = roundMoney(nextAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;

    setData((prev) => {
      const matchingIndexes = [];

      prev.forEach((item, index) => {
        const sameCompany = normalizeCompanyKey(item.company || item.clientName) === targetCompany;
        if (!sameCompany) return;

        const inAgentScope = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
        const inWeekScope = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
        if (!inAgentScope || !inWeekScope) return item;

        matchingIndexes.push(index);
      });

      if (matchingIndexes.length === 0) return prev;

      const updated = [...prev];
      if (matchingIndexes.length === 1) {
        const idx = matchingIndexes[0];
        updated[idx] = { ...updated[idx], amount: roundMoney(parsedAmount), __editedFields: { ...updated[idx].__editedFields, amount: true } };
        persistEditedRows([updated[idx]]);
        return updated;
      }

      const currentTotal = matchingIndexes.reduce((sum, idx) => sum + (Number(updated[idx].amount) || 0), 0);
      if (currentTotal <= 0) {
        matchingIndexes.forEach((idx, index) => {
          updated[idx] = {
            ...updated[idx],
            amount: index === 0 ? roundMoney(parsedAmount) : 0,
            __editedFields: { ...updated[idx].__editedFields, amount: true }
          };
        });
persistEditedRows(matchingIndexes.map((idx) => updated[idx]));
        return updated;
      }

      let runningSum = 0;
      matchingIndexes.forEach((idx, index) => {
        if (index === matchingIndexes.length - 1) {
          updated[idx] = { ...updated[idx], amount: roundMoney(parsedAmount - runningSum), __editedFields: { ...updated[idx].__editedFields, amount: true } };
          return;
        }

        const ratio = (Number(updated[idx].amount) || 0) / currentTotal;
        const nextValue = roundMoney(parsedAmount * ratio);
        runningSum = roundMoney(runningSum + nextValue);
        updated[idx] = { ...updated[idx], amount: nextValue, __editedFields: { ...updated[idx].__editedFields, amount: true } };
      });

      persistEditedRows(matchingIndexes.map((idx) => updated[idx]));
      return updated;
    });

    toast.success('Total due updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const handleMarkInvoiced = (debtor) => {
    const targetCompany = normalizeCompanyKey(debtor.company || debtor.clientName);
    if (!targetCompany) return;

    const existing = data.find(item =>
      normalizeCompanyKey(item.company || item.clientName) === targetCompany &&
      item.invoiceNumber &&
      String(item.invoiceNumber).trim() !== ''
    );

    setSuggestedInv(existing ? existing.invoiceNumber : '');
    setProcessingDebtor(debtor);
    setIsProcessModalOpen(true);
  };

  const handleConfirmProcess = (invNumber) => {
    if (!processingDebtor) return;
    const targetCompany = normalizeCompanyKey(processingDebtor.company || processingDebtor.clientName);
    
    // Use local date instead of UTC to avoid timezone shift
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = normalizeCompanyKey(item.company || item.clientName) === targetCompany;
        if (!sameCompany) return item;

        // Sync: If it's the target company, mark lastInvoicedDate
        // If status was 'no_invoice' and we have an invoice, move to 'pending'
        let newStatus = item.status;
        if ((!item.status || item.status === 'no_invoice') && invNumber) {
          newStatus = 'pending';
        }

        // Calculate 1-day due date for the new invoice
        const dateObj = new Date(todayDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + 1);
        const calculatedDue = dateObj.toISOString().split('T')[0];

        const updated = {
          ...item,
          lastInvoicedDate: todayDate,
          dueDate: calculatedDue,
          invoiceNumber: invNumber || item.invoiceNumber,
          status: newStatus
        };
        changed.push(updated);
        return updated;
      });

      if (changed.length > 0) {
        setManualEdits(prevEdits => {
          const nextEdits = { ...prevEdits };
          changed.forEach(row => {
            nextEdits[row.id] = row;
          });
          manualEditsRef.current = nextEdits;
          return nextEdits;
        });
        persistEditedRows(changed);
      }
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
    const targetCompany = normalizeCompanyKey(debtor.company || debtor.clientName);
    if (!targetCompany) return;

    const todayDate = new Date().toISOString().split('T')[0];

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        const sameCompany = normalizeCompanyKey(item.company || item.clientName) === targetCompany;
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
      const key = normalizeCompanyKey(item.company || item.clientName);
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
      const byCompany = normalizeCompanyKey(item.company || item.clientName) === normalizeCompanyKey(activeCompany);
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

    const getEarliestUnprocessedInvDate = (item) => {
      const rawCycle = item.billingCycle || '';
      const cycle = normalizeBillingCycle(rawCycle);

      if ([BILLING_CYCLES.CS_BY_AGENT, BILLING_CYCLES.UNSPECIFIED, BILLING_CYCLES.MULTIPLE].includes(cycle)) return null;

      const getDates = (type, refDate) => {
        const inv = new Date(refDate);
        const day = refDate.getDay();

        if (type === BILLING_CYCLES.MONDAY_SUNDAY) {
          let diff = day - 1;
          if (diff < 0) diff += 7;
          inv.setDate(refDate.getDate() - diff);
          return inv;
        }
        if (type === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
          let diff = day - 4;
          if (diff < 0) diff += 7;
          inv.setDate(refDate.getDate() - diff);
          return inv;
        }

        let dayA = 1, dayB = 4;
        if (type === BILLING_CYCLES.TWICE_TUE_FRI) { dayA = 2; dayB = 5; }
        else if (type === BILLING_CYCLES.TWICE_WED_SAT) { dayA = 3; dayB = 6; }
        else if (String(type).toLowerCase().includes('twice') && String(type).includes('/')) {
          const match = String(type).match(/\((.*?)\s*\/\s*(.*?)\)/);
          if (match) {
            const DAYS_TO_NUM = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 0 };
            dayA = DAYS_TO_NUM[match[1].trim()] ?? 1;
            dayB = DAYS_TO_NUM[match[2].trim()] ?? 4;
          }
        }

        const d1 = new Date(refDate);
        let diff1 = d1.getDay() - dayA; if (diff1 < 0) diff1 += 7;
        d1.setDate(d1.getDate() - diff1);

        const d2 = new Date(refDate);
        let diff2 = d2.getDay() - dayB; if (diff2 < 0) diff2 += 7;
        d2.setDate(d2.getDate() - diff2);

        const active = d1 > d2 ? d1 : d2;
        inv.setTime(active.getTime());
        return inv;
      };

      let currentRef = new Date(today);
      let iterations = 0;
      let finalInv = null;

      while (iterations < 2) {
        const inv = getDates(cycle, currentRef);
        if (!inv) break;

        const isProcessed = (item.lastInvoicedDate && new Date(item.lastInvoicedDate + 'T00:00:00') >= inv) ||
          (item.lastNoUsageDate && new Date(item.lastNoUsageDate + 'T00:00:00') >= inv);

        if (!isProcessed) {
          finalInv = inv;
          break;
        }

        currentRef = new Date(inv);
        currentRef.setDate(inv.getDate() - 1);
        iterations++;
      }
      return finalInv;
    };

    return agentData.filter(item => {
      const invDate = getEarliestUnprocessedInvDate(item);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return invDate && todayStart >= invDate;
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
        <Suspense fallback={<AnalyticsSkeleton />}>
          <ManagerAnalytics
            invoiceRows={scopedInvoiceData}
            aggregatedRows={agentData}
            selectedAgent={selectedAgent}
            onSelectAgent={(agentName) => setSelectedAgent(agentName || 'all')}
            onOpenCompanyProfile={openCompanyProfile}
          />
        </Suspense>
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
        <Login onLogin={setUser} />
        <Toaster position="bottom-right" />
      </AppContainer>
    );
  }

  return (
    <AppContainer>
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
