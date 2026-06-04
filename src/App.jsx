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
import InvoiceEntry from './components/InvoiceEntry';
import CompanyDirectory from './components/CompanyDirectory';
import AlmaFuelLogo from './components/AlmaFuelLogo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase, hasSupabaseConfig } from './lib/supabase';
import { calculateMetrics } from './data/mockData';
import { useDebtors, aggregateByCompany } from './hooks/useDebtors';
import { roundMoney } from './utils/moneyUtils';
import { normalizeMatchKey } from './utils/normalizers';
import { agentMatchesScopeValue, resolveAccessProfile, userCanAccessAgent } from './constants/accessControl';
import { emailService } from './services/emailService';
import { openCmpInvoicePdf, requestCmpInvoicePdf, queueCmpInvoicePdf } from './services/cmpInvoices';
import './index.css';

const TABLE_NAME = 'manual_edits';

const getUserAvatarSrc = (email) => {
  const normalizedEmail = (email || '').toLowerCase();
  if (normalizedEmail.includes('andres')) return '/avatar.png';
  if (normalizedEmail.includes('hector')) return '/hector-avatar.png';
  if (normalizedEmail.includes('guidiana') || normalizedEmail.includes('guidi')) return '/guidiana-avatar.png';
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
    rawZohoData,
    clientsByAgent,
    loading,
    isSyncing,
    syncSourceLabel,
    lastSyncAt,
    lastCmpSyncAt,
    cmpInvoiceCount,
    loadData,
    refreshCmpData,
    persistEditedRows,
    manualEdits,
    setManualEdits,
    setData
  } = useDebtors({ supabase, user, tableName: TABLE_NAME });

  const isHectorProfile = String(user?.email || '').toLowerCase() === 'hector.lomeli@theunitedtransports.com';

  const accessibleData = React.useMemo(() => {
    if (isHectorProfile) {
      const hectorScopes = ['hector lomeli', 'hector lomeli g', 'hector', 'lomeli'];
      return data.filter((item) => hectorScopes.some((scope) => agentMatchesScopeValue(scope, item.agentId)));
    }
    if (accessProfile.canViewAllData) return data;
    return data.filter((item) => userCanAccessAgent(accessProfile, item.agentId));
  }, [data, accessProfile, isHectorProfile]);

  const accessibleClientsByAgent = React.useMemo(() => {
    if (isHectorProfile) {
      const hectorScopes = ['hector lomeli', 'hector lomeli g', 'hector', 'lomeli'];
      return clientsByAgent.filter((item) => hectorScopes.some((scope) => agentMatchesScopeValue(scope, item.agentId)));
    }
    if (accessProfile.canViewAllData) return clientsByAgent;
    return clientsByAgent.filter((item) => userCanAccessAgent(accessProfile, item.agentId));
  }, [clientsByAgent, accessProfile, isHectorProfile]);

  const matchesSelectedAgent = React.useCallback(
    (agentId) => selectedAgent === 'all' || agentMatchesScopeValue(selectedAgent, agentId),
    [selectedAgent]
  );

  useEffect(() => {
    if (activeView === 'tracker') {
      setActiveView('overview');
      return;
    }
    if (activeView === 'invoice_entry' && !accessProfile.canViewInvoiceEntry) {
      setActiveView('overview');
    }
  }, [activeView, accessProfile.canViewInvoiceEntry]);

  useEffect(() => {
    if (accessProfile.canViewAllData) return;
    const scopedAgents = Array.from(
      new Set(accessibleData.map((item) => String(item.agentId || '').trim()).filter(Boolean))
    );
    if (scopedAgents.length === 0) return;
    if (selectedAgent === 'all' || !scopedAgents.some((a) => agentMatchesScopeValue(a, selectedAgent))) {
      setSelectedAgent(scopedAgents[0]);
    }
  }, [accessProfile, accessibleData, selectedAgent]);

  const [cmpStatus, setCmpStatus] = useState({
    running: false,
    phase: 'idle',
    message: '',
    page: 0,
    invoicesFound: 0,
    error: null
  });
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [pdfBusyIds, setPdfBusyIds] = useState({});
  const [pdfPendingIds, setPdfPendingIds] = useState({});
  const cmpWasRunningRef = React.useRef(false);
  const pdfStatusRef = React.useRef({});
  const pdfDelayWarnedRef = React.useRef({});
  const pdfRefreshPollRef = React.useRef(null);
  const pdfRefreshAttemptsRef = React.useRef(0);

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

  const runCmpScraper = React.useCallback(async (depth = 'normal') => {
    if (!cmpRunnerApiBase) {
      throw new Error('CMP runner only works on localhost with server on port 3001.');
    }
    const response = await fetch(`${cmpRunnerApiBase}/api/cmp/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ depth })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Could not start CMP (${response.status})`);
    }
    refreshCmpStatus();
  }, [cmpRunnerApiBase, refreshCmpStatus]);

  const handleSyncAll = React.useCallback(async (depth = 'normal') => {
    if (!isAndresProfile || !cmpRunnerApiBase) {
      loadData({ notifyUser: true });
      return;
    }

    setSyncAllBusy(true);
    try {
      toast.loading('Sync All: loading Zoho...', { id: 'sync-all' });
      await loadData({ silent: true });
      toast.loading(`Sync All: starting CMP ${depth} sync in Chrome...`, { id: 'sync-all' });
      await runCmpScraper(depth);
      toast.success(`CMP ${depth} sync started. Watch status below.`, { id: 'sync-all', duration: 4500 });
    } catch (error) {
      toast.error(error?.message || 'Sync All failed', { id: 'sync-all', duration: 6000 });
    } finally {
      setSyncAllBusy(false);
    }
  }, [cmpRunnerApiBase, isAndresProfile, loadData, runCmpScraper]);

  const handleOpenPdf = React.useCallback(async (row) => {
    try {
      await openCmpInvoicePdf(supabase, row);
    } catch (error) {
      toast.error(error?.message || 'Could not open PDF');
    }
  }, []);

  const handleRequestPdf = React.useCallback(async (row) => {
    const rowId = row?.id;
    if (!rowId) return;

    setPdfBusyIds((prev) => ({ ...prev, [rowId]: true }));
    try {
      if (cmpRunnerApiBase) {
        await requestCmpInvoicePdf(cmpRunnerApiBase, row);
        toast.success('PDF request started');
      } else {
        await queueCmpInvoicePdf(supabase, row);
        toast.success('PDF requested (queued in cloud)');
      }
      setPdfPendingIds((prev) => ({ ...prev, [rowId]: true }));
      if (refreshCmpData) {
        await refreshCmpData({ silent: true });
      } else {
        await loadData({ silent: true });
      }
    } catch (error) {
      toast.error(error?.message || 'Could not request PDF');
    } finally {
      setPdfBusyIds((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    }
  }, [cmpRunnerApiBase, loadData, refreshCmpData, supabase]);

  useEffect(() => {
    const readyIds = [];
    const readyLabels = [];

    Object.keys(pdfPendingIds).forEach((id) => {
      if (!pdfPendingIds[id]) return;
      const row = data.find((item) => item.id === id);
      if (row?.pdfStoragePath) {
        readyIds.push(id);
        readyLabels.push(row.invoiceNumber || row.company || row.clientName || id);
      }
    });

    if (readyIds.length === 0) return;

    setPdfPendingIds((prev) => {
      const next = { ...prev };
      readyIds.forEach((id) => delete next[id]);
      return next;
    });

    toast.success(
      readyLabels.length === 1
        ? `PDF ready: ${readyLabels[0]}`
        : `${readyLabels.length} PDFs ready`,
      { duration: 5000 }
    );
  }, [data, pdfPendingIds]);

  useEffect(() => {
    const nextStatusMap = {};

    data.forEach((item) => {
      const rowId = item?.id;
      if (!rowId) return;

      const status = String(item.pdfStatus || (item.pdfStoragePath ? 'available' : 'missing')).toLowerCase();
      nextStatusMap[rowId] = status;

      const prevStatus = pdfStatusRef.current[rowId];
      const label = item.invoiceNumber || item.company || item.clientName || rowId;
      const requestedAt = item.pdfRequestedAt ? new Date(item.pdfRequestedAt) : null;
      const isRecentRequest = Boolean(requestedAt && !Number.isNaN(requestedAt.getTime()) && (Date.now() - requestedAt.getTime()) < 15 * 60 * 1000);

      if (prevStatus && prevStatus !== status) {
        if (status === 'queued') {
          toast.loading(`PDF queued: ${label}`, { id: `pdf-${rowId}` });
        } else if (status === 'fetching') {
          toast.loading(`Downloading PDF: ${label}`, { id: `pdf-${rowId}` });
          pdfDelayWarnedRef.current[rowId] = false;
        } else if (status === 'available') {
          toast.success(`PDF ready: ${label}`, { id: `pdf-${rowId}`, duration: 5000 });
          delete pdfDelayWarnedRef.current[rowId];
          setPdfPendingIds((prev) => {
            if (!prev[rowId]) return prev;
            const next = { ...prev };
            delete next[rowId];
            return next;
          });
        } else if (status === 'failed') {
          toast.error(`PDF failed: ${label}`, {
            id: `pdf-${rowId}`,
            duration: 7000
          });
          delete pdfDelayWarnedRef.current[rowId];
          setPdfPendingIds((prev) => {
            if (!prev[rowId]) return prev;
            const next = { ...prev };
            delete next[rowId];
            return next;
          });
        }
      }

      if ((status === 'queued' || status === 'fetching') && isRecentRequest) {
        const delayMs = requestedAt ? Date.now() - requestedAt.getTime() : 0;
        if (delayMs > 120000 && !pdfDelayWarnedRef.current[rowId]) {
          toast(`PDF is taking longer than usual: ${label}`, {
            id: `pdf-delay-${rowId}`,
            duration: 6000
          });
          pdfDelayWarnedRef.current[rowId] = true;
        }
      }
    });

    pdfStatusRef.current = nextStatusMap;
  }, [data]);

  useEffect(() => {
    const pendingIds = Object.keys(pdfPendingIds).filter((id) => pdfPendingIds[id]);
    if (pdfRefreshPollRef.current) {
      clearInterval(pdfRefreshPollRef.current);
      pdfRefreshPollRef.current = null;
    }

    if (pendingIds.length === 0) {
      pdfRefreshAttemptsRef.current = 0;
      return undefined;
    }

    pdfRefreshAttemptsRef.current = 0;
    const poll = async () => {
      pdfRefreshAttemptsRef.current += 1;

      if (refreshCmpData) {
        await refreshCmpData({ silent: true });
      }

      const stillPending = Object.keys(pdfPendingIds).some((id) => pdfPendingIds[id]);
      if (stillPending && pdfRefreshAttemptsRef.current >= 3 && loadData) {
        pdfRefreshAttemptsRef.current = 0;
        await loadData({ silent: true });
      }
    };

    poll();
    pdfRefreshPollRef.current = setInterval(poll, 5000);

    return () => {
      if (pdfRefreshPollRef.current) {
        clearInterval(pdfRefreshPollRef.current);
        pdfRefreshPollRef.current = null;
      }
    };
  }, [loadData, pdfPendingIds, refreshCmpData]);

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
    if (!hasSupabaseConfig || !supabase || !refreshCmpData) return undefined;

    const channel = supabase
      .channel('cmp-invoices-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cmp_invoices' },
        () => {
          refreshCmpData({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshCmpData, supabase]);

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
        const targetCompanyKey = normalizeMatchKey(currentDebtor.company || currentDebtor.clientName);

        const changedRows = [];
        const nextRawZohoData = rawZohoData.map((item) => {
          const sameCompany = normalizeMatchKey(item.company || item.clientName) === targetCompanyKey;
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
          changedRows.push(updatedRow);
          return updatedRow;
        });

        const changedEdits = [];
        const nextManualEdits = { ...manualEdits };
        Object.keys(nextManualEdits).forEach((editId) => {
          const edit = nextManualEdits[editId];
          const sameComp = normalizeMatchKey(edit.company || edit.clientName) === targetCompanyKey;
          if (sameComp) {
            const updatedEdit = {
              ...edit,
              company: debtor.company || debtor.clientName,
              clientName: debtor.company || debtor.clientName,
              dueDate: debtor.dueDate,
              status: debtor.status,
              agentId: debtor.agentId,
              billingCycle: debtor.billingCycle,
              invoiceNumber: debtor.invoiceNumber,
              notes: debtor.notes
            };
            nextManualEdits[editId] = updatedEdit;
            changedEdits.push(updatedEdit);
          }
        });

        setData(nextRawZohoData);
        setManualEdits(nextManualEdits);

        const uniqueChanged = new Map();
        changedRows.forEach((r) => uniqueChanged.set(r.id, r));
        changedEdits.forEach((e) => uniqueChanged.set(e.id, e));
        const toPersist = Array.from(uniqueChanged.values());

        if (toPersist.length > 0) {
          persistEditedRows(toPersist);
        }
      } else {
        const nextRawZohoData = rawZohoData.map((d) => (d.id === debtor.id ? debtor : d));
        const nextManualEdits = { ...manualEdits, [debtor.id]: debtor };

        setData(nextRawZohoData);
        setManualEdits(nextManualEdits);
        persistEditedRows([debtor]);
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
      const nextEdit = {
        ...newDebtor,
        __isNew: true,
        __deleted: false
      };

      setData([newDebtor, ...rawZohoData]);
      setManualEdits({
        ...manualEdits,
        [newId]: nextEdit
      });
      persistEditedRows([nextEdit]);

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
      let targetCompany = null;
      if (String(id).startsWith('CMP-')) {
        const targetCompanyKey = String(id).replace('CMP-', '').trim();
        const found = data.find(d => normalizeMatchKey(d.company || d.clientName) === targetCompanyKey);
        if (found) {
          targetCompany = found.company || found.clientName;
        }
      }

      if (targetCompany) {
        const targetCompanyKey = normalizeMatchKey(targetCompany);
        const idsToDelete = Object.values(manualEdits)
          .filter(edit => normalizeMatchKey(edit.company || edit.clientName) === targetCompanyKey)
          .map(edit => edit.id);

        if (idsToDelete.length > 0) {
          const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .in('id', idsToDelete);

          if (error) throw error;

          setManualEdits((prev) => {
            const next = { ...prev };
            idsToDelete.forEach(toDelId => {
              delete next[toDelId];
            });
            return next;
          });
        }
      } else {
        const { error } = await supabase
          .from(TABLE_NAME)
          .delete()
          .eq('id', String(id));

        if (error) throw error;

        setManualEdits((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }

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
      const targetCompanyKey = String(id).replace('CMP-', '').trim();

      const rowsToDelete = data.filter((d) =>
        normalizeMatchKey(d.company || d.clientName) === targetCompanyKey
      );

      const nextRawZohoData = rawZohoData.filter((d) =>
        normalizeMatchKey(d.company || d.clientName) !== targetCompanyKey
      );

      const changed = [];
      const nextManualEdits = { ...manualEdits };
      rowsToDelete.forEach((d) => {
        const edit = { ...(nextManualEdits[d.id] || {}), id: d.id, __deleted: true };
        nextManualEdits[d.id] = edit;
        changed.push(edit);
      });

      setData(nextRawZohoData);
      setManualEdits(nextManualEdits);

      if (changed.length > 0) {
        persistEditedRows(changed);
      }
    } else {
      const nextRawZohoData = rawZohoData.filter((d) => d.id !== id);
      const edit = {
        ...(manualEdits[id] || {}),
        id,
        __deleted: true
      };
      const nextManualEdits = {
        ...manualEdits,
        [id]: edit
      };

      setData(nextRawZohoData);
      setManualEdits(nextManualEdits);
      persistEditedRows([edit]);
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

  const quickUpdateBillingCycle = (row, nextCycle) => {
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const normalizedNextCycle = normalizeBillingCycle(nextCycle);

    const changedRows = [];
    const nextRawZohoData = rawZohoData.map((item) => {
      if (item.id !== idToUpdate) return item;

      const updatedRow = {
        ...item,
        billingCycle: normalizedNextCycle
      };
      changedRows.push(updatedRow);
      return updatedRow;
    });

    const changedEdits = [];
    const nextManualEdits = { ...manualEdits };
    if (nextManualEdits[idToUpdate]) {
      const updatedEdit = {
        ...nextManualEdits[idToUpdate],
        billingCycle: normalizedNextCycle
      };
      nextManualEdits[idToUpdate] = updatedEdit;
      changedEdits.push(updatedEdit);
    }

    setData(nextRawZohoData);
    setManualEdits(nextManualEdits);

    const uniqueChanged = new Map();
    changedRows.forEach((r) => uniqueChanged.set(r.id, r));
    changedEdits.forEach((e) => uniqueChanged.set(e.id, e));
    const toPersist = Array.from(uniqueChanged.values());

    if (toPersist.length > 0) {
      persistEditedRows(toPersist);
    }

    toast.success('Billing cycle updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const quickUpdatePaymentStatus = (row, nextStatus) => {
    const isAggregatedRow = String(row.id || '').startsWith('CMP-');
    const normalizedStatus = String(nextStatus || '').toLowerCase();

    if (isAggregatedRow) {
      const targetCompanyKey = normalizeMatchKey(row.company || row.clientName);

      const changedRows = [];
      const nextRawZohoData = rawZohoData.map((item) => {
        const sameCompany = normalizeMatchKey(item.company || item.clientName) === targetCompanyKey;
        if (!sameCompany) return item;

        const updatedRow = {
          ...item,
          status: normalizedStatus
        };
        changedRows.push(updatedRow);
        return updatedRow;
      });

      const changedEdits = [];
      const nextManualEdits = { ...manualEdits };
      Object.keys(nextManualEdits).forEach((editId) => {
        const edit = nextManualEdits[editId];
        const sameComp = normalizeMatchKey(edit.company || edit.clientName) === targetCompanyKey;
        if (sameComp) {
          const updatedEdit = {
            ...edit,
            status: normalizedStatus
          };
          nextManualEdits[editId] = updatedEdit;
          changedEdits.push(updatedEdit);
        }
      });

      setData(nextRawZohoData);
      setManualEdits(nextManualEdits);

      const uniqueChanged = new Map();
      changedRows.forEach((r) => uniqueChanged.set(r.id, r));
      changedEdits.forEach((e) => uniqueChanged.set(e.id, e));
      const toPersist = Array.from(uniqueChanged.values());

      if (toPersist.length > 0) {
        persistEditedRows(toPersist);
      }
    } else {
      const idToUpdate = row.latestId || row.id;
      if (!idToUpdate) return;

      const changedRows = [];
      const nextRawZohoData = rawZohoData.map((item) => {
        if (item.id !== idToUpdate) return item;

        const updatedRow = {
          ...item,
          status: normalizedStatus
        };
        changedRows.push(updatedRow);
        return updatedRow;
      });

      const changedEdits = [];
      const nextManualEdits = { ...manualEdits };
      if (nextManualEdits[idToUpdate]) {
        const updatedEdit = {
          ...nextManualEdits[idToUpdate],
          status: normalizedStatus
        };
        nextManualEdits[idToUpdate] = updatedEdit;
        changedEdits.push(updatedEdit);
      }

      setData(nextRawZohoData);
      setManualEdits(nextManualEdits);

      const uniqueChanged = new Map();
      changedRows.forEach((r) => uniqueChanged.set(r.id, r));
      changedEdits.forEach((e) => uniqueChanged.set(e.id, e));
      const toPersist = Array.from(uniqueChanged.values());

      if (toPersist.length > 0) {
        persistEditedRows(toPersist);
      }
    }

    toast.success('Payment status updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const quickUpdateTotalDue = (row, nextAmount) => {
    const idToUpdate = row.latestId || row.id;
    if (!idToUpdate) return;

    const parsedAmount = roundMoney(nextAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return;

    const changedRows = [];
    const nextRawZohoData = rawZohoData.map((item) => {
      if (item.id !== idToUpdate) return item;

      const updatedRow = {
        ...item,
        amount: parsedAmount
      };
      changedRows.push(updatedRow);
      return updatedRow;
    });

    const changedEdits = [];
    const nextManualEdits = { ...manualEdits };
    if (nextManualEdits[idToUpdate]) {
      const updatedEdit = {
        ...nextManualEdits[idToUpdate],
        amount: parsedAmount
      };
      nextManualEdits[idToUpdate] = updatedEdit;
      changedEdits.push(updatedEdit);
    }

    setData(nextRawZohoData);
    setManualEdits(nextManualEdits);

    const uniqueChanged = new Map();
    changedRows.forEach((r) => uniqueChanged.set(r.id, r));
    changedEdits.forEach((e) => uniqueChanged.set(e.id, e));
    const toPersist = Array.from(uniqueChanged.values());

    if (toPersist.length > 0) {
      persistEditedRows(toPersist);
    }

    toast.success('Total due updated', {
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };




  const weekOptions = React.useMemo(() => Array.from(new Set(accessibleData.map((item) => String(item.weekLabel || '').trim()).filter(Boolean))).sort(), [accessibleData]);
  const agentOptions = React.useMemo(() => Array.from(new Set(accessibleData.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort(), [accessibleData]);

  const hydratedWithSmartStatus = React.useMemo(() => {
    const today = new Date();
    return accessibleData.map(row => {
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
  }, [accessibleData, lastTick]);

  const scopedInvoiceData = React.useMemo(() => hydratedWithSmartStatus.filter((item) => {
    const matchesAgent = matchesSelectedAgent(item.agentId);
    const matchesWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
    const status = String(item.status || '').toLowerCase();
    const isOpen = status === 'pending' || status === 'overdue';
    const matchesStatus = statusScope === 'all' || isOpen;
    return matchesAgent && matchesWeek && matchesStatus;
  }), [hydratedWithSmartStatus, matchesSelectedAgent, selectedWeek, statusScope]);

  const aggregatedData = React.useMemo(() => aggregateByCompany(scopedInvoiceData), [scopedInvoiceData]);
  const agentData = aggregatedData;

  const directoryInvoiceData = React.useMemo(() => hydratedWithSmartStatus.filter((item) => {
    return matchesSelectedAgent(item.agentId);
  }), [hydratedWithSmartStatus, matchesSelectedAgent]);

  const directoryData = React.useMemo(() => aggregateByCompany(directoryInvoiceData), [directoryInvoiceData]);
  const metrics = React.useMemo(() => calculateMetrics(agentData), [agentData]);

  const { snapshotClients, snapshotClientsInDebt, snapshotClientsClear } = React.useMemo(() => {
    const map = new Map();
    agentData.forEach((item) => {
      const key = normalizeMatchKey(item.company || item.clientName);
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

    const targetKey = normalizeMatchKey(activeCompany);
    const scopedRows = accessibleData.filter((item) => {
      const byCompany = normalizeMatchKey(item.company || item.clientName) === targetKey;
      if (!byCompany) return false;
      const byAgent = matchesSelectedAgent(item.agentId);
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
  }, [activeCompany, accessibleData, matchesSelectedAgent, selectedWeek]);



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
        <ViewButton type="button" $active={activeView === 'companies_directory'} onClick={() => setActiveView('companies_directory')}>Companies</ViewButton>
        <ViewButton type="button" $active={activeView === 'analytics'} onClick={() => setActiveView('analytics')}>Manager Analytics</ViewButton>
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
              <AgentSelect
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                disabled={!accessProfile.canViewAllData}
              >
                {accessProfile.canViewAllData && <option value="all">All agents</option>}
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
            onOpenPdf={handleOpenPdf}
            onRequestPdf={handleRequestPdf}
            canRequestPdf={Boolean(supabase)}
            pdfBusyIds={pdfBusyIds}
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

      {activeView === 'companies_directory' && (
        <CompanyDirectory
          data={directoryData}
          onOpenCompanyProfile={openCompanyProfile}
        />
      )}

      {activeView === 'invoice_entry' && (
        <ContentScroll>
          <InvoiceEntry 
            clientsByAgent={accessibleClientsByAgent} 
            existingData={accessibleData} 
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
                onClick={() => handleSyncAll()}
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
            onRunSync={handleSyncAll}
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
