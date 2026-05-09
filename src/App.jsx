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
import ActivityLogs from './components/ActivityLogs';
import InvoiceEntry from './components/InvoiceEntry';
import PortfolioCompanies from './components/PortfolioCompanies';
import AlmaFuelLogo from './components/AlmaFuelLogo';
import { hasSupabaseConfig } from './lib/supabase';
import { calculateMetrics } from './data/mockData';
import { fetchAllDataFromSheet } from './services/zohoWorkDrive';
import { BILLING_CYCLES } from './constants/billingCycles';
import { agentMatchesScopeValue, isManagedKevinIdentity, resolveAccessProfile, userCanAccessAgent } from './constants/accessControl';
import { emailService } from './services/emailService';
import { createActivityEntry } from './services/activityLogger';
import { aggregateByCompany, mergeDebtorsWithClientSheet, mergeManualEdits, toComparableDate } from './services/debtorDataReconciliation';
import { useAppSharedState } from './hooks/useAppSharedState';
import { useManualEditsState } from './hooks/useManualEditsState';
import { MANUAL_EDITS_TABLE } from './services/manualEditsPersistence';
import { useAppSession } from './hooks/useAppSession';
import { useOverviewActions } from './hooks/useOverviewActions';
import './index.css';

const TRACKED_ACTIVITY_FIELDS = [
  { key: 'amount', label: 'Total Due' },
  { key: 'notes', label: 'Notes' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'status', label: 'Status' },
  { key: 'billingCycle', label: 'Billing Cycle' }
];

const normalizeActivityValue = (fieldKey, value) => {
  if (value === null || value === undefined) return '';
  if (fieldKey === 'amount') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : '';
  }
  return String(value).trim();
};

const buildFieldChangeActivityEntries = ({ user, previousRow, nextRow }) =>
  TRACKED_ACTIVITY_FIELDS.reduce((entries, field) => {
    const oldValue = normalizeActivityValue(field.key, previousRow?.[field.key]);
    const newValue = normalizeActivityValue(field.key, nextRow?.[field.key]);

    if (oldValue === newValue) return entries;

    const companyName = nextRow?.company || nextRow?.clientName || previousRow?.company || previousRow?.clientName || 'Unknown company';
    entries.push(
      createActivityEntry({
        user,
        actionType: 'EDIT',
        details: `${user.email} changed ${field.label} for ${companyName} from ${oldValue || 'empty'} to ${newValue || 'empty'}`,
        entityType: 'debtor',
        entityId: nextRow?.id || previousRow?.id,
        company: companyName,
        fieldName: field.key,
        oldValue,
        newValue
      })
    );

    return entries;
  }, []);

const getUserAvatarSrc = (email) => {
  const normalizedEmail = String(email || '').toLowerCase();

  if (normalizedEmail.includes('andres')) return '/avatar.png';
  if (normalizedEmail.includes('hector')) return '/hector-avatar.png';
  if (normalizedEmail.includes('kevin')) return '/kevin-avatar.png';

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

const AccessControlPanel = styled.section`
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow-lg);
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const AccessControlHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 800;
    color: var(--text-main);
  }

  p {
    margin: 0.28rem 0 0 0;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
`;

const AccessToggleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
`;

const AccessToggleCard = styled.div`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 18px;
  padding: 0.9rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  strong {
    color: var(--text-main);
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.92rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.82rem;
  }
`;

const ToggleSwitch = styled.button`
  border: 1px solid ${(props) => (props.$active ? 'rgba(16, 185, 129, 0.35)' : 'var(--glass-border)')};
  background: ${(props) => (props.$active ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.04)')};
  color: ${(props) => (props.$active ? '#d1fae5' : 'var(--text-muted)')};
  min-width: 88px;
  padding: 0.62rem 0.9rem;
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${(props) => (props.$active ? 'rgba(16, 185, 129, 0.48)' : 'rgba(249, 115, 22, 0.35)')};
    color: var(--text-main);
  }
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
  const [data, setData] = useState([]);
  const [rawZohoData, setRawZohoData] = useState([]);
  const [trackerData, setTrackerData] = useState([]);
  const [clientsByAgent, setClientsByAgent] = useState([]);
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'analytics', 'tracker'
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(Date.now());
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [statusScope, setStatusScope] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDebtor, setCurrentDebtor] = useState(null);
  const [activeCompany, setActiveCompany] = useState(null);
  const {
    activityLogRefreshKey,
    handleLogout,
    recordActivityEntries,
    setAuthenticatedUser,
    user
  } = useAppSession({
    onSignedOut: () => {
      setActiveView('overview');
      setCurrentDebtor(null);
      setActiveCompany(null);
    }
  });
  const {
    accessFeatureOverrides,
    handleSaveFollowUp,
    normalizeIncomingTrackerRows,
    updateFeatureAccessOverride
  } = useAppSharedState({ user, setTrackerData });
  const {
    manualEdits,
    manualEditsRef,
    persistEditedRows,
    setManualEdits
  } = useManualEditsState({ user, loading });
  const accessProfile = useMemo(() => resolveAccessProfile(user, accessFeatureOverrides), [user, accessFeatureOverrides]);
  const matchesSelectedAgent = useCallback(
    (agentId) => selectedAgent === 'all' || agentMatchesScopeValue(selectedAgent, agentId),
    [selectedAgent]
  );
  const syncInFlightRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    try {
      const { debtors: sheetData, clientsByAgent: csData, trackerLogs } = await fetchAllDataFromSheet(undefined, { cacheBust: true });
      const mergedData = mergeDebtorsWithClientSheet(sheetData, csData);
      setClientsByAgent(csData || []);

      if (trackerLogs) {
        setTrackerData(normalizeIncomingTrackerRows(trackerLogs));
      }

      if (mergedData && mergedData.length > 0) {
        setRawZohoData(mergedData);
        if (notifyUser) {
          toast.success(`Sync completed (${mergedData.length} records)`, {
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      } else {
        setRawZohoData([]);
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
      if (notifyUser) {
        toast.error('Unable to connect to Zoho. Using offline data.', {
          style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
        });
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      syncInFlightRef.current = false;
    }
  }, [normalizeIncomingTrackerRows]);

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

  const accessibleData = React.useMemo(() => {
    if (accessProfile.canViewAllData) return data;
    return data.filter((item) => userCanAccessAgent(accessProfile, item.agentId));
  }, [data, accessProfile]);

  const accessibleClientsByAgent = React.useMemo(() => {
    if (accessProfile.canViewAllData) return clientsByAgent;
    return clientsByAgent.filter((item) => userCanAccessAgent(accessProfile, item.agentId));
  }, [clientsByAgent, accessProfile]);

  const accessibleTrackerData = React.useMemo(() => {
    if (accessProfile.canViewAllData) return trackerData;
    return trackerData.filter((item) => userCanAccessAgent(accessProfile, item.agent || item.agentId));
  }, [trackerData, accessProfile]);

  useEffect(() => {
    if (selectedWeek === 'all') return;
    const exists = accessibleData.some((item) => String(item.weekLabel || '').trim() === selectedWeek);
    if (!exists) {
      setSelectedWeek('all');
    }
  }, [selectedWeek, accessibleData]);

  useEffect(() => {
    if (accessProfile.canViewAllData) return;

    const scopedAgents = Array.from(
      new Set(accessibleData.map((item) => String(item.agentId || '').trim()).filter(Boolean))
    );

    if (scopedAgents.length === 0) return;

    if (!scopedAgents.some((agentName) => agentMatchesScopeValue(agentName, selectedAgent)) && selectedAgent !== 'all') {
      setSelectedAgent(scopedAgents[0]);
    }
  }, [accessProfile, accessibleData, selectedAgent]);

  useEffect(() => {
    if (activeView === 'tracker' && !accessProfile.canViewSupportTracker) {
      setActiveView('overview');
    }

    if (activeView === 'invoice_entry' && !accessProfile.canViewInvoiceEntry) {
      setActiveView('overview');
    }
  }, [activeView, accessProfile]);

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





  const agentOptions = React.useMemo(() => {
    const rosterAgents = Array.from(
      new Set(
        accessibleClientsByAgent
          .map((item) => String(item.agentId || '').trim())
          .filter(Boolean)
      )
    ).sort();

    if (rosterAgents.length > 0) return rosterAgents;

    return Array.from(
      new Set(
        accessibleData
          .map((item) => String(item.agentId || '').trim())
          .filter(Boolean)
      )
    ).sort();
  }, [accessibleClientsByAgent, accessibleData]);

  useEffect(() => {
    if (selectedAgent === 'all') return;
    const exists = agentOptions.includes(selectedAgent);
    if (!exists) {
      setSelectedAgent(accessProfile.canViewAllData ? 'all' : (agentOptions[0] || 'all'));
    }
  }, [selectedAgent, agentOptions, accessProfile]);

  const hydratedWithSmartStatus = React.useMemo(() => {
    const today = new Date(lastTick);
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

  const analyticsInvoiceRows = React.useMemo(() => hydratedWithSmartStatus.filter((item) => {
    const matchesAgent = matchesSelectedAgent(item.agentId);
    const matchesWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
    const status = String(item.status || '').toLowerCase();
    const hasInvoice = Boolean(String(item.invoiceNumber || '').trim()) && item.invoiceNumber !== 'Marked as Sent';
    return matchesAgent && matchesWeek && hasInvoice && ['pending', 'overdue', 'paid'].includes(status);
  }), [hydratedWithSmartStatus, matchesSelectedAgent, selectedWeek]);

  const analyticsAggregatedRows = React.useMemo(() => aggregateByCompany(analyticsInvoiceRows), [analyticsInvoiceRows]);
  const currentCycleWeekLabel = React.useMemo(() => {
    const latestByWeek = new Map();

    hydratedWithSmartStatus.forEach((row) => {
      const status = String(row.status || '').toLowerCase();
      const hasInvoice = Boolean(String(row.invoiceNumber || '').trim()) && row.invoiceNumber !== 'Marked as Sent';
      const weekLabel = String(row.weekLabel || '').trim();
      if (!weekLabel || !hasInvoice || !['pending', 'overdue', 'paid'].includes(status)) return;

      const candidateDate =
        toComparableDate(row.dueDate) ||
        toComparableDate(row.lastInvoicedDate) ||
        toComparableDate(row.updated_at);

      const current = latestByWeek.get(weekLabel);
      if (!current || (candidateDate && candidateDate > current)) {
        latestByWeek.set(weekLabel, candidateDate || new Date(0));
      }
    });

    const sortedWeeks = Array.from(latestByWeek.entries()).sort((a, b) => b[1] - a[1]);
    return sortedWeeks[0]?.[0] || '';
  }, [hydratedWithSmartStatus]);

  const scopedInvoiceData = React.useMemo(() => hydratedWithSmartStatus.filter((item) => {
    const matchesAgent = matchesSelectedAgent(item.agentId);
    const weekLabel = String(item.weekLabel || '').trim();
    const matchesWeek = selectedWeek === 'all'
      ? (statusScope === 'all' ? (!currentCycleWeekLabel || weekLabel === currentCycleWeekLabel) : true)
      : weekLabel === selectedWeek;
    const status = String(item.status || '').toLowerCase();
    const isOpen = status === 'pending' || status === 'overdue';
    const matchesStatus = statusScope === 'all'
      ? ['pending', 'overdue', 'paid', 'no_invoice'].includes(status)
      : isOpen;
    return matchesAgent && matchesWeek && matchesStatus;
  }), [hydratedWithSmartStatus, matchesSelectedAgent, selectedWeek, statusScope, currentCycleWeekLabel]);

  const aggregatedData = React.useMemo(() => aggregateByCompany(scopedInvoiceData), [scopedInvoiceData]);
  const agentData = aggregatedData;
  const metrics = React.useMemo(() => {
    const baseMetrics = calculateMetrics(agentData);
    
    const clients = new Set();
    accessibleData.forEach(item => {
      const agentMatch = selectedAgent === 'all' || String(item.agentId || '').trim() === selectedAgent;
      if (agentMatch && (item.company || item.clientName) && item.invoiceNumber !== 'Marked as Sent') {
        clients.add(String(item.company || item.clientName).trim().toLowerCase());
      }
    });

    return {
      ...baseMetrics,
      activeClients: clients.size
    };
  }, [agentData, accessibleData, selectedAgent]);

  const isKevinProfile = isManagedKevinIdentity(user?.email || '');
  const kevinAccessSettings = accessFeatureOverrides.kevin || {};
  const kevinSectionAccess = {
    canViewInvoiceEntry: Boolean(kevinAccessSettings.canViewInvoiceEntry ?? false),
    canViewSupportTracker: Boolean(kevinAccessSettings.canViewSupportTracker ?? false)
  };

  const {
    handleDeleteDebtor,
    handleResetDebtor,
    handleSaveDebtor,
    openCompanyProfile,
    quickUpdateBillingCycle,
    quickUpdatePaymentStatus,
    quickUpdateTotalDue
  } = useOverviewActions({
    buildFieldChangeActivityEntries,
    createActivityEntry,
    currentDebtor,
    data,
    manualEditsRef,
    manualEditsTable: MANUAL_EDITS_TABLE,
    matchesSelectedAgent,
    persistEditedRows,
    recordActivityEntries,
    selectedWeek,
    setActiveCompany,
    setCurrentDebtor,
    setData,
    setIsModalOpen,
    setManualEdits,
    user
  });

  const companyProfile = React.useMemo(() => {
    if (!activeCompany) return null;

    const scopedRows = accessibleData.filter((item) => {
      const company = String(item.company || item.clientName || '').trim().toLowerCase();
      const byCompany = company === activeCompany.trim().toLowerCase();
      if (!byCompany) return false;
      const byAgent = matchesSelectedAgent(item.agentId);
      const byWeek = selectedWeek === 'all' || String(item.weekLabel || '').trim() === selectedWeek;
      return byAgent && byWeek;
    });

    // Deduplicate by week to avoid double-counting placeholders
    const deduplicatedRows = [];
    
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
        <ViewButton type="button" $active={activeView === 'analytics'} onClick={() => setActiveView('analytics')}>Manager Analytics</ViewButton>
        {!accessProfile.canViewAllData && (
          <ViewButton type="button" $active={activeView === 'portfolio'} onClick={() => setActiveView('portfolio')}>Portfolio Companies</ViewButton>
        )}
        {accessProfile.canViewSupportTracker && (
          <ViewButton type="button" $active={activeView === 'tracker'} onClick={() => setActiveView('tracker')}>Support Tracker</ViewButton>
        )}
        {accessProfile.canViewInvoiceEntry && (
          <ViewButton type="button" $active={activeView === 'invoice_entry'} onClick={() => setActiveView('invoice_entry')}>Invoice Entry</ViewButton>
        )}
        {accessProfile.canViewActivityLogs && (
          <ViewButton type="button" $active={activeView === 'activity_logs'} onClick={() => setActiveView('activity_logs')}>Activity Logs</ViewButton>
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

              <AgentSelect
                value={statusScope}
                onChange={(e) => setStatusScope(e.target.value)}
              >
                <option value="all">All records</option>
                <option value="open">Open balances only</option>
              </AgentSelect>

            </FiltersRow>
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
          invoiceRows={analyticsInvoiceRows}
          aggregatedRows={analyticsAggregatedRows}
          selectedAgent={selectedAgent}
          onSelectAgent={(agentName) => setSelectedAgent(agentName || 'all')}
          onOpenCompanyProfile={openCompanyProfile}
          isManager={accessProfile.canViewAllData}
        />
      )}

      {activeView === 'portfolio' && !accessProfile.canViewAllData && (
        <PortfolioCompanies
          companies={accessibleClientsByAgent}
          debtRows={accessibleData}
          currentUserEmail={user?.email || ''}
        />
      )}

      {activeView === 'tracker' && (
        <ContentScroll>
          <SupportTracker
            data={accessibleTrackerData}
            canManageEntries={accessProfile.canEditData}
            canComment={Boolean(user)}
            currentUserEmail={user?.email || ''}
            onSaveFollowUp={handleSaveFollowUp}
          />
        </ContentScroll>
      )}

      {activeView === 'activity_logs' && accessProfile.canViewActivityLogs && (
        <ContentScroll>
          {accessProfile.canManageAccessOverrides && (
            <AccessControlPanel>
              <AccessControlHeader>
                <div>
                  <h3>Kevin Section Access</h3>
                  <p>
                    Control when Kevin can open `Invoice Entry` and `Support Tracker` without changing his broader operations access.
                  </p>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {isKevinProfile ? 'You are viewing the restricted profile logic live.' : 'Managed from Andres profile.'}
                </div>
              </AccessControlHeader>

              <AccessToggleGrid>
                <AccessToggleCard>
                  <div>
                    <strong>Invoice Entry</strong>
                    <span>Currently {kevinSectionAccess.canViewInvoiceEntry ? 'enabled' : 'disabled'} for Kevin.</span>
                  </div>
                  <ToggleSwitch
                    type="button"
                    $active={kevinSectionAccess.canViewInvoiceEntry}
                    onClick={() =>
                      updateFeatureAccessOverride('kevin', {
                        canViewInvoiceEntry: !kevinSectionAccess.canViewInvoiceEntry
                      })
                    }
                  >
                    {kevinSectionAccess.canViewInvoiceEntry ? 'Enabled' : 'Disabled'}
                  </ToggleSwitch>
                </AccessToggleCard>

                <AccessToggleCard>
                  <div>
                    <strong>Support Tracker</strong>
                    <span>Currently {kevinSectionAccess.canViewSupportTracker ? 'enabled' : 'disabled'} for Kevin.</span>
                  </div>
                  <ToggleSwitch
                    type="button"
                    $active={kevinSectionAccess.canViewSupportTracker}
                    onClick={() =>
                      updateFeatureAccessOverride('kevin', {
                        canViewSupportTracker: !kevinSectionAccess.canViewSupportTracker
                      })
                    }
                  >
                    {kevinSectionAccess.canViewSupportTracker ? 'Enabled' : 'Disabled'}
                  </ToggleSwitch>
                </AccessToggleCard>
              </AccessToggleGrid>
            </AccessControlPanel>
          )}
          <ActivityLogs refreshSignal={activityLogRefreshKey} />
        </ContentScroll>
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
        <Login onLogin={setAuthenticatedUser} />
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
              <SyncButton onClick={() => loadData({ notifyUser: true })} title="Sync (Ctrl+Shift+S)">
                <span>Sync</span>
              </SyncButton>
              <LogoutButton onClick={handleLogout}>
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

