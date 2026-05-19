import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { RefreshCw, Users, Clock } from 'lucide-react';
import CmpSyncPanel from './components/CmpSyncPanel';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase, hasSupabaseConfig } from './lib/supabase';
import { calculateMetrics } from './data/mockData';
import { useDebtors, aggregateByCompany } from './hooks/useDebtors';
import { roundMoney } from './utils/moneyUtils';
import { resolveAccessProfile } from './constants/accessControl';
import { emailService } from './services/emailService';
import './index.css';

const TABLE_NAME = 'manual_edits';

const getUserAvatarSrc = (email) => {
  const normalizedEmail = String(email || '').toLowerCase();
  if (normalizedEmail.includes('andres')) return '/avatar.png';
  if (normalizedEmail.includes('hector')) return '/hector-avatar.png';
  return null;
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

  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
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
  gap: 1rem;
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  
  span.brand {
    background: linear-gradient(135deg, var(--brand-amber) 0%, var(--brand) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    transition: all 0.4s ease;
  }

  span:last-child {
    transition: all 0.4s ease;
  }

  &:hover {
    gap: 0;
    letter-spacing: 0.05em;
  }

  &:hover ${PulsatingLogo} {
    transform: translateY(-45px) scale(1.3);
    filter: drop-shadow(0 20px 20px rgba(255, 122, 26, 0.4));
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



function App() {
  const [activeView, setActiveView] = useState('overview');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [statusScope, setStatusScope] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDebtor, setCurrentDebtor] = useState(null);
  const [activeCompany, setActiveCompany] = useState(null);
  const [user, setUser] = useState(null);
  const [lastTick, setLastTick] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(new Date());

  const accessProfile = useMemo(() => resolveAccessProfile(user), [user]);
  const isAndresProfile = String(user?.email || '').toLowerCase().includes('andres');
  const isLocalHost = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const cmpRunnerApiBase = useMemo(() => {
    if (!isAndresProfile || !isLocalHost) return null;
    return `http://${window.location.hostname}:3001`;
  }, [isAndresProfile, isLocalHost]);

  const {
    data,
    clientsByAgent,
    trackerData,
    loading,
    isSyncing,
    syncSourceLabel,
    lastSyncAt,
    lastCmpSyncAt,
    cmpInvoiceCount,
    loadData,
    persistEditedRows,
    manualEdits,
    setManualEdits,
    setData
  } = useDebtors({ supabase, user, tableName: TABLE_NAME });

  const [cmpStatus, setCmpStatus] = useState({
    running: false,
    phase: 'idle',
    message: '',
    page: 0,
    invoicesFound: 0,
    error: null
  });
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const cmpWasRunningRef = React.useRef(false);

  const refreshCmpStatus = React.useCallback(async () => {
    if (!cmpRunnerApiBase) return;
    try {
      const response = await fetch(`${cmpRunnerApiBase}/api/cmp/status`);
      const payload = await response.json();
      if (!response.ok || !payload) return;
      setCmpStatus(payload);

      const wasRunning = cmpWasRunningRef.current;
      const nowRunning = Boolean(payload.running);
      cmpWasRunningRef.current = nowRunning;

      if (wasRunning && !nowRunning) {
        const code = payload.lastExitCode;
        if (typeof code === 'number' && code !== 0) {
          toast.error(`CMP sync failed (exit ${code}). Open Log for details.`, { duration: 6500 });
        } else {
          toast.success('CMP sync finished. Refreshing data...', { duration: 4000 });
          loadData({ silent: true });
        }
      }
    } catch {
      // runner offline
    }
  }, [cmpRunnerApiBase, loadData]);

  useEffect(() => {
    if (!cmpRunnerApiBase) return undefined;
    refreshCmpStatus();
    const interval = window.setInterval(refreshCmpStatus, 3000);
    return () => window.clearInterval(interval);
  }, [cmpRunnerApiBase, refreshCmpStatus]);

  const showCmpLog = React.useCallback(async () => {
    if (!cmpRunnerApiBase) return;
    try {
      const response = await fetch(`${cmpRunnerApiBase}/api/cmp/log?lines=120`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to read log');
      toast(String(payload?.tail || 'No log yet.').trim(), { duration: 8000 });
    } catch (error) {
      toast.error(error?.message || 'Could not read CMP log');
    }
  }, [cmpRunnerApiBase]);

  const runCmpScraper = React.useCallback(async () => {
    if (!cmpRunnerApiBase) {
      throw new Error('CMP runner only works on localhost with server on port 3001.');
    }
    const response = await fetch(`${cmpRunnerApiBase}/api/cmp/run`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Could not start CMP (${response.status})`);
    }
    refreshCmpStatus();
  }, [cmpRunnerApiBase, refreshCmpStatus]);

  const handleSyncAll = React.useCallback(async () => {
    if (!isAndresProfile || !cmpRunnerApiBase) {
      loadData({ notifyUser: true });
      return;
    }

    setSyncAllBusy(true);
    try {
      toast.loading('Sync All: loading Zoho...', { id: 'sync-all' });
      await loadData({ silent: true });
      toast.loading('Sync All: starting CMP in Chrome (Profile 8)...', { id: 'sync-all' });
      await runCmpScraper();
      toast.success('CMP started. Watch status below.', { id: 'sync-all', duration: 4500 });
    } catch (error) {
      toast.error(error?.message || 'Sync All failed', { id: 'sync-all', duration: 6000 });
    } finally {
      setSyncAllBusy(false);
    }
  }, [cmpRunnerApiBase, isAndresProfile, loadData, runCmpScraper]);

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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    const tickInterval = setInterval(() => setLastTick(Date.now()), 60000);
    return () => clearInterval(tickInterval);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const pressedSyncShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 's';
      if (!pressedSyncShortcut) return;
      event.preventDefault();
      handleSyncAll();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSyncAll]);

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

    const invoiceRows = deduplicatedRows.filter((item) => !String(item.id || '').startsWith('CS-') && item.invoiceNumber !== 'Marked as Sent');
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
        {accessProfile.canViewSupportTracker && (
          <ViewButton type="button" $active={activeView === 'tracker'} onClick={() => setActiveView('tracker')}>Support Tracker</ViewButton>
        )}
        {accessProfile.canViewInvoiceEntry && (
          <ViewButton type="button" $active={activeView === 'invoice_entry'} onClick={() => setActiveView('invoice_entry')}>Invoice Entry</ViewButton>
        )}
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

               // Trigger email notification if requested
               if (invoice.sendNotification) {
                 emailService.sendInvoiceNotification(invoice).then(res => {
                   if (res.success) {
                     toast.success(`Notification sent to ${invoice.company}`, {
                       icon: '📧',
                       style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
                     });
                   } else {
                     toast.error(`Email failed: ${res.error}`, {
                       style: { background: 'var(--surface-3)', color: '#ef4444', border: '1px solid #ef4444' }
                     });
                   }
                 });
               }

               toast.success('Invoice saved and synced', {
                 icon: '✅',
                 style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
               });
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
                {getUserAvatarSrc(user?.email) ? (
                  <img 
                    src={getUserAvatarSrc(user?.email)}
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
              <SyncButton
                onClick={handleSyncAll}
                title={isAndresProfile && isLocalHost ? 'Sync All (Zoho + CMP)' : 'Sync Zoho (Ctrl+Shift+S)'}
                disabled={syncAllBusy || isSyncing}
              >
                <RefreshCw size={14} style={{ animation: (syncAllBusy || isSyncing) ? 'spin 1s linear infinite' : 'none' }} />
                <span>{isAndresProfile && isLocalHost ? 'Sync All' : 'Sync'}</span>
              </SyncButton>
              <LogoutButton onClick={() => supabase.auth.signOut()}>
                Logout
              </LogoutButton>
            </ActionButtons>
          </TopbarRight>
        </Topbar>

        {isAndresProfile && isLocalHost && (
          <CmpSyncPanel
            runnerApiBase={cmpRunnerApiBase}
            cmpStatus={cmpStatus}
            onRefreshStatus={refreshCmpStatus}
            onShowLog={showCmpLog}
            lastCmpSyncAt={lastCmpSyncAt}
            cmpInvoiceCount={cmpInvoiceCount}
            syncAllBusy={syncAllBusy}
          />
        )}

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
