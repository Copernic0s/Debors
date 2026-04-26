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
import SupportTracker from './components/SupportTracker';
import InvoiceEntry from './components/InvoiceEntry';
import AlmaFuelLogo from './components/AlmaFuelLogo';
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
    // Treat purely new entries or entries without a matching ID in Zoho as new rows
    if ((edit.__isNew || !existingIds.has(edit.id)) && !edit.__deleted) {
      // Ensure they look like real invoices
      merged.unshift({ 
        ...edit,
        source: edit.source === 'manual_entry' ? 'invoice' : (edit.source || 'invoice')
      });
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
  font-family: 'Plus Jakarta Sans', sans-serif;
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
  margin: 1.5rem 2rem;
  height: 90px;
  background: rgba(8, 18, 34, 0.45);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(180, 223, 255, 0.12);
  border-radius: 24px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 2rem;
  z-index: 1000;
  position: sticky;
  top: 1.5rem;
  box-shadow: 
    0 20px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(8, 18, 34, 0.55);
    border-color: rgba(180, 223, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 
      0 30px 60px -12px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(85, 214, 255, 0.05);
  }

  @media (max-width: 900px) {
    margin: 1rem;
    height: auto;
    padding: 1rem;
    grid-template-columns: 1fr;
    gap: 1rem;
    top: 1rem;
  }
`;

const PulsatingLogo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  
  &::after {
    content: '';
    position: absolute;
    width: 65px;
    height: 65px;
    background: radial-gradient(circle, var(--brand) 0%, transparent 70%);
    filter: blur(20px);
    border-radius: 50%;
    opacity: 0.3;
    z-index: -1;
    animation: flickerGlow 3s ease-in-out infinite alternate;
  }

  @keyframes flickerGlow {
    0% { transform: scale(0.9); opacity: 0.2; filter: blur(15px); }
    50% { transform: scale(1.15); opacity: 0.45; filter: blur(25px); }
    100% { transform: scale(1); opacity: 0.3; filter: blur(20px); }
  }
`;

const UserAvatar = styled.div`
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--brand-amber), var(--brand));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(255, 122, 26, 0.3);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    background: var(--ok);
    border: 2.5px solid #081222;
    border-radius: 50%;
    box-shadow: 0 0 8px var(--ok);
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;

  .name {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-main);
  }
  .status {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

const ContentScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 2.5rem;

  @media (max-width: 768px) {
    padding: 1.25rem;
  }
`;

const AgentToolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const FiltersRow = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const AgentSelect = styled.select`
  min-width: 260px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  color: var(--text-main);
  font-family: 'Plus Jakarta Sans', inherit;
  font-size: 0.9rem;
  outline: none;
  transition: all 0.2s ease;

  &:focus {
    border-color: var(--brand);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 15px rgba(249, 115, 22, 0.2);
  }

  option {
    color: var(--text-main);
    background: #0f172a;
  }
`;

const AgentSnapshot = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 0.85rem 1.25rem;
  color: var(--text-main);
  box-shadow: var(--shadow-lg);

  strong {
    color: var(--brand);
  }

  @media (max-width: 1100px) {
    width: 100%;
    margin-left: 0;
  }
`;

const TopbarLeft = styled.div`
  display: flex;
  align-items: center;
  min-height: 1px;

  @media (max-width: 900px) {
    display: none;
  }
`;

const BrandLockup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  text-align: center;
`;

const BrandTitle = styled.h1`
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  text-transform: uppercase;
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: 0.15em;
  color: var(--text-main);
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.3s ease;
  transform: scaleY(1.05);

  span.brand {
    background: linear-gradient(135deg, var(--brand-amber) 0%, var(--brand) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &:hover {
    letter-spacing: 0.2em;
    gap: 0.6rem;
  }
`;

const TopbarRight = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1.5rem;

  @media (max-width: 900px) {
    width: 100%;
    justify-content: center;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.75rem;

  @media (max-width: 768px) {
    justify-content: center;
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
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.6rem 1.2rem;
  border-radius: 14px;
  color: var(--text-main);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--brand-cyan);
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.3);
  }

  svg {
    transition: transform 0.6s ease;
  }

  &:hover svg {
    transform: rotate(180deg);
  }
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  padding: 0.6rem 1.2rem;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 14px;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--danger);
    color: var(--danger);
    transform: translateY(-2px);
  }
`;

const ViewSwitch = styled.div`
  display: inline-flex;
  gap: 0.4rem;
  margin-bottom: 2rem;
  padding: 0.45rem;
  background: rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(180, 223, 255, 0.14);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 20px 40px -30px rgba(0, 0, 0, 0.8);
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
`;

const ViewButton = styled.button`
  border: 1px solid ${(props) => (props.$active ? 'rgba(255, 179, 71, 0.35)' : 'transparent')};
  background: ${(props) => (props.$active ? 'linear-gradient(135deg, rgba(255, 179, 71, 0.16), rgba(255, 122, 26, 0.2))' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--brand-ice)' : 'var(--text-muted)')};
  font-weight: 800;
  padding: 0.82rem 1.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.83rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  white-space: nowrap;
  min-width: 180px;
  text-align: center;

  &:hover {
    color: var(--brand-ice);
    background: ${(props) => (props.$active ? 'linear-gradient(135deg, rgba(255, 179, 71, 0.22), rgba(255, 122, 26, 0.24))' : 'rgba(255,255,255,0.06)')};
    transform: translateY(-2px);
  }

  ${(props) => props.$active && `
    box-shadow: 0 14px 30px -18px rgba(255, 122, 26, 0.7);
    text-shadow: 0 0 12px rgba(255, 179, 71, 0.2);
  `}

  @media (max-width: 768px) {
    min-width: 150px;
    padding: 0.78rem 1.2rem;
    font-size: 0.76rem;
  }

  .priority-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    background: #ef4444;
    color: white;
    border-radius: 9px;
    font-size: 0.65rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
    border: 1.5px solid #0f172a;
    z-index: 5;
  }
`;

const normalizeWeekLabel = (label) => {
  const raw = String(label || '').trim().toLowerCase();
  if (!raw) return 'unspecified';
  // Attempt to extract digits to form a semi-stable key even if names vary (March vs Mar)
  const numbers = raw.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    // Take the first two sets of numbers (likely start/end day)
    return `W-${numbers[0]}-${numbers[1]}`;
  }
  return raw.replace(/[^a-z0-9]/g, '');
};

const mergeDebtorsWithClientSheet = (debtRows, csRows) => {
  const merged = new Map();
  const windowsWithInvoice = new Set();

  // 1. Process Debt Rows (Invoices)
  debtRows.forEach((row) => {
    merged.set(row.id, { ...row, source: 'debt' });
    
    // Recognize windows that already have actual invoices
    const normalizedCompany = String(row.company || row.clientName || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const normalizedWeek = normalizeWeekLabel(row.weekLabel);
    if (normalizedCompany && normalizedWeek) {
      windowsWithInvoice.add(`${normalizedWeek}|${normalizedCompany}`);
    }
  });

  // 2. Process Client Sheet Rows (Potential Invoices / CS by Agent)
  (csRows || []).forEach((row) => {
    const company = String(row.company || '').trim();
    const week = String(row.weekLabel || '').trim();
    if (!company) return;

    const normalizedCompany = company.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const normalizedWeek = normalizeWeekLabel(row.weekLabel);
    const windowKey = `${normalizedWeek}|${normalizedCompany}`;
    const stableId = `CS-${normalizedWeek}-${normalizedCompany}`;

    // Prefer actual invoices over client sheet rows for the same window
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

const aggregateByCompany = (rows) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const company = String(row.company || row.clientName || '').trim();
    if (!company) return;

    const agent = String(row.agentId || 'Unassigned').trim() || 'Unassigned';
    const invKey = String(row.invoiceNumber || row.weekLabel || row.id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `${company.toLowerCase()}-${invKey}`;
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

    // Accumulate SUM (non-paid only), AGENTS, and CYCLES with deduplication
    if (!current.seenInvoices.has(invKey)) {
      current.amount = Number.isFinite(roundMoney(current.amount + amountToAdd)) ? roundMoney(current.amount + amountToAdd) : 0;
      current.seenInvoices.add(invKey);
      if (row.invoiceNumber) current.invoiceCount += 1;
    }
    
    current.agentSet.add(agent);
    
    // Priority 1: If the row comes from the CS sheet and has a cycle, it's the MASTER.
    // Priority 2: If we don't have a master cycle yet, take the first non-unspecified one found.
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

    // Metadata Priority: Follow the LATEST due date for the displayed fields
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

    // Status aggregation: Prioritize most critical (Overdue > Pending > Paid)
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
    
    // Re-calculate auto-overdue based on the FINAL aggregated due date
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
    // NEW INACTIVE LOGIC
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
      // If we found a specific cycle in the latest row, use it. Otherwise find any non-unspecified from the set.
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

function App() {
  const [data, setData] = useState([]);
  const [rawZohoData, setRawZohoData] = useState([]);
  const [trackerData, setTrackerData] = useState([]);
  const [clientsByAgent, setClientsByAgent] = useState([]);
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'analytics', 'tracker'
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSourceLabel, setSyncSourceLabel] = useState('Zoho WorkDrive');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastTick, setLastTick] = useState(Date.now());
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
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });


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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCurrentDebtor(null);
        setActiveCompany(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchManualEdits();
    }
  }, [user, fetchManualEdits]);

  // Data Repair: If we have confirm records (lastInvoicedDate) but no dueDate,
  // calculate it and persist it. This fixes records from before this patch.
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

    // Always merge from the LATEST reference of manualEdits
    const hydrated = mergeManualEdits(rawZohoData, manualEdits);
    setData(hydrated);
  }, [rawZohoData, manualEdits]);

  const loadData = useCallback(async ({ silent = false, notifyUser = false } = {}) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
    }
    setIsSyncing(true);

    try {
      const { debtors: sheetData, clientsByAgent: csData, trackerLogs } = await fetchAllDataFromSheet(undefined, { cacheBust: true });
      const mergedData = mergeDebtorsWithClientSheet(sheetData, csData);
      setClientsByAgent(csData || []);

      if (trackerLogs) {
        setTrackerData(trackerLogs);
      }

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

    const tickInterval = window.setInterval(() => {
      setLastTick(Date.now());
    }, 60000); // Update time-sensitive memos every minute

    return () => {
      window.clearInterval(interval);
      window.clearInterval(tickInterval);
    };
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
          const next = prev.map((d) => (d.id === debtor.id ? debtor : d));
          setManualEdits(prevEdits => {
            const nextEdits = { ...prevEdits, [debtor.id]: debtor };
            manualEditsRef.current = nextEdits;
            return nextEdits;
          });
          persistEditedRows([debtor]);
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
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const normalizedNextCycle = normalizeBillingCycle(nextCycle);

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        if (item.id !== idToUpdate) return item;

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
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const normalizedStatus = String(nextStatus || '').toLowerCase();

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        if (item.id !== idToUpdate) return item;

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
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const parsedAmount = roundMoney(nextAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;

    setData((prev) => {
      const changed = [];
      const next = prev.map((item) => {
        if (item.id !== idToUpdate) return item;

        const updatedRow = {
          ...item,
          amount: parsedAmount
        };
        changed.push(updatedRow);
        return updatedRow;
      });
      persistEditedRows(changed);
      return next;
    });

    toast.success('Total due updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };




  const weekOptions = React.useMemo(() => Array.from(new Set(data.map((item) => String(item.weekLabel || '').trim()).filter(Boolean))).sort(), [data]);
  const agentOptions = React.useMemo(() => Array.from(new Set(data.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort(), [data]);

  const hydratedWithSmartStatus = React.useMemo(() => {
    const today = new Date();
    return data.map(row => {
      let status = row.status || 'pending';
      let isAutoOverdue = false;

      // Only attempt auto-overdue if the status isn't already 'paid' or 'no_invoice'
      if (status !== 'paid' && status !== 'no_invoice' && row.dueDate) {
        // According to user instructions: Due Date 5 p.m. Eastern time
        // We use T17:00:00 to match the 5pm cutoff (relative to local time)
        const dateStr = row.dueDate.includes('T') ? row.dueDate : `${row.dueDate}T17:00:00`;
        const parsedDue = new Date(dateStr);
        if (!Number.isNaN(parsedDue.getTime()) && parsedDue < today) {
          status = 'overdue';
          isAutoOverdue = true;
        }
      }
      return { ...row, status, isAutoOverdue };
    });
  }, [data, lastTick]);

  const scopedInvoiceData = React.useMemo(() => hydratedWithSmartStatus.filter((item) => {
    const matchesAgent = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
    const matchesWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
    const status = String(item.status || '').toLowerCase();
    const isOpen = status === 'pending' || status === 'overdue';
    const matchesStatus = statusScope === 'all' || isOpen;
    return matchesAgent && matchesWeek && matchesStatus;
  }), [hydratedWithSmartStatus, selectedAgent, selectedWeek, statusScope]);

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

    // Deduplicate by week to avoid double-counting placeholders
    const deduplicatedRows = [];
    const seenWindows = new Set();
    
    // Sort to prioritize actual invoices (debt source) over placeholders (cs source)
    const sortedScoped = [...scopedRows].sort((a, b) => {
      if (a.source === 'debt' && b.source !== 'debt') return -1;
      if (a.source !== 'debt' && b.source === 'debt') return 1;
      return 0;
    });

    const seenIds = new Set();
    const seenInvoices = new Set();
    
    sortedScoped.forEach(row => {
      const invKey = String(row.invoiceNumber || row.id).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenIds.has(row.id) && !seenInvoices.has(invKey)) {
        deduplicatedRows.push(row);
        seenIds.add(row.id);
        if (row.invoiceNumber) seenInvoices.add(invKey);
      }
    });

    const invoiceRows = deduplicatedRows.filter((item) => !String(item.id || '').startsWith('CS-'));
    const totalDebt = deduplicatedRows
      .filter((item) => String(item.status || '').toLowerCase() !== 'paid')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOverdue = deduplicatedRows
      .filter((item) => String(item.status || '').toLowerCase() === 'overdue')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return {
      company: activeCompany,
      totalDebt,
      totalOverdue,
      invoiceCount: invoiceRows.length,
      agents: Array.from(new Set(deduplicatedRows.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort(),
      contacts: Array.from(new Set(deduplicatedRows.map((item) => String(item.contactPerson || '').trim()).filter(Boolean))).sort(),
      invoices: invoiceRows.sort((a, b) => 
        String(a.invoiceNumber || a.id).localeCompare(String(b.invoiceNumber || b.id))
      )
    };
  }, [activeCompany, data, selectedAgent, selectedWeek]);



  const overviewContent = (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      width: '100%',
      opacity: loading ? 0.5 : 1, 
      transition: 'opacity 0.3s' 
    }}>
      <ViewSwitch>
        <ViewButton type="button" $active={activeView === 'overview'} onClick={() => setActiveView('overview')}>Overview</ViewButton>
        <ViewButton type="button" $active={activeView === 'analytics'} onClick={() => setActiveView('analytics')}>Manager Analytics</ViewButton>
        <ViewButton type="button" $active={activeView === 'tracker'} onClick={() => setActiveView('tracker')}>Support Tracker</ViewButton>
        <ViewButton type="button" $active={activeView === 'invoice_entry'} onClick={() => setActiveView('invoice_entry')}>Invoice Entry</ViewButton>
      </ViewSwitch>

      {activeView === 'overview' && (
        <>
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

      {activeView === 'tracker' && (
        <ContentScroll>
          <SupportTracker data={trackerData} />
        </ContentScroll>
      )}

      {activeView === 'invoice_entry' && (
        <ContentScroll>
          <InvoiceEntry 
            clientsByAgent={clientsByAgent} 
            existingData={data} 
            onSaveInvoice={(invoice) => {
              // Optimistically update local data state so it shows in Overview immediately
              setData(prev => {
                // If it's a completely new manual entry, we add it to the array.
                // If it already exists (e.g. replacing 'no_invoice' with real invoice), we update it.
                const existingIndex = prev.findIndex(item => item.id === invoice.id || 
                  (item.company === invoice.company && item.weekLabel === invoice.weekLabel && item.status === 'no_invoice')
                );
                
                if (existingIndex >= 0) {
                  const next = [...prev];
                  next[existingIndex] = { ...next[existingIndex], ...invoice };
                  return next;
                }
                return [...prev, invoice];
              });
              
              persistEditedRows([invoice]);
            }} 
          />
        </ContentScroll>
      )}</div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <UserAvatar>
                {user?.email?.toLowerCase().includes('andres') ? (
                  <img 
                    src="https://raw.githubusercontent.com/Copernic0s/Debors/main/public/avatar.png" 
                    alt="User" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                  />
                ) : (
                  user?.email?.split('@')[0].split('.').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'
                )}
              </UserAvatar>
              <UserInfo>
                <span className="name">{user?.email?.split('@')[0].split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ') || 'Andres Mendez'}</span>
                <span className="status">Active Session</span>
              </UserInfo>
            </div>
          </TopbarLeft>

          <BrandLockup>
            <BrandTitle>
              <span className="brand">Alma</span>
              <PulsatingLogo>
                <AlmaFuelLogo size={42} />
              </PulsatingLogo>
              <span>fuel</span>
            </BrandTitle>
          </BrandLockup>

          <TopbarRight>
            <ActionButtons>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.8rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Clock size={12} color="var(--brand)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{timeString}</span>
              </div>
              <SyncButton onClick={() => loadData({ notifyUser: true })} title="Sync (Ctrl+Shift+S)">
                <span>Sync</span>
              </SyncButton>
              <LogoutButton onClick={() => supabase.auth.signOut()}>
                Logout
              </LogoutButton>
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


      <Toaster position="bottom-right" />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </AppContainer>
  );
}

export default App;
