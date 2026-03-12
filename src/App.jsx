import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Menu, RefreshCw, Layers, Plus, Users } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import DebtorsList from './components/DebtorsList';
import DebtorModal from './components/DebtorModal';
import { calculateMetrics } from './data/mockData';
import { fetchAllDataFromSheet } from './services/zohoWorkDrive';
import './index.css';

const AppContainer = styled.div`
  display: flex;
  min-height: 100vh;
`;

const Sidebar = styled.aside`
  width: ${props => props.$isOpen ? '260px' : '0px'};
  background: var(--bg-2);
  border-right: ${props => props.$isOpen ? '1px solid var(--border-color)' : 'none'};
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    display: none;
  }
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
  height: 72px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  background: var(--surface);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  z-index: 10;
`;

const ContentScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
`;

const Logo = styled.div`
  font-family: 'Montserrat', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
  color: #39b8ff;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;

  span {
    color: #86dbff;
  }
`;

const BrandOwner = styled.p`
  margin: 0 0 2.1rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const NavItem = styled.div`
  padding: 0.85rem 1rem;
  border-radius: var(--radius-md);
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  color: ${props => props.$active ? 'var(--text-main)' : 'var(--text-muted)'};
  background: ${props => props.$active ? 'var(--surface-3)' : 'transparent'};
  font-weight: ${props => props.$active ? '600' : '500'};
  display: flex;
  align-items: center;
  gap: 0.75rem;

  ${props => props.$active && `
    box-shadow: inset 4px 0 0 var(--brand);
  `}

  &:hover {
    background: ${props => props.$active ? 'var(--surface-3)' : 'var(--surface-2)'};
    color: var(--text-main);
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
    const key = `${agent.toLowerCase()}|${company.toLowerCase()}`;
    const amount = Number(row.amount) || 0;

    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...row,
        company,
        clientName: company,
        agentId: agent,
        amount,
        billingCycle: row.billingCycle || '',
        status: row.status || 'pending',
        notes: row.notes || '',
        invoiceNumber: row.invoiceNumber || '',
        id: `CMP-${key}`
      });
      return;
    }

    current.amount += amount;
    if (current.billingCycle !== row.billingCycle && row.billingCycle) {
      current.billingCycle = 'Multiple';
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

  return Array.from(grouped.values());
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSourceLabel, setSyncSourceLabel] = useState('Zoho WorkDrive');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDebtor, setCurrentDebtor] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const syncInFlightRef = useRef(false);

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
        setData(mergedData);
        setSyncSourceLabel('Zoho WorkDrive');
        if (notifyUser) {
          toast.success(`Sync completed (${mergedData.length} records)`, {
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      } else {
        setData([]);
        if (notifyUser) {
          toast.error('Zoho returned no rows.', {
            icon: 'ℹ️',
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      }
    } catch {
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

  const handleSaveDebtor = (debtor) => {
    if (currentDebtor) {
      setData(data.map(d => d.id === debtor.id ? debtor : d));
      toast.success('Debt updated successfully', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    } else {
      setData([debtor, ...data]);
      toast.success('New debtor added', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    }
    setIsModalOpen(false);
    setCurrentDebtor(null);
  };

  const handleDeleteDebtor = (id) => {
    setData(data.filter(d => d.id !== id));
    toast.success('Record deleted', {
      icon: '🗑️',
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const openNewModal = () => {
    setCurrentDebtor(null);
    setIsModalOpen(true);
  };

  const aggregatedData = aggregateByCompany(data);
  const metrics = calculateMetrics(aggregatedData);
  const agentOptions = Array.from(new Set(aggregatedData.map((item) => String(item.agentId || '').trim()).filter(Boolean))).sort();
  const agentData = selectedAgent === 'all'
    ? aggregatedData
    : aggregatedData.filter((item) => String(item.agentId || '').trim() === selectedAgent);

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

  const renderContent = () => {
    if (activeTab === 'reports') {
      return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Reports Module</h2>
          <p style={{ color: 'var(--text-muted)' }}>Coming soon... agent performance trends and export options.</p>
        </div>
      );
    }

    if (activeTab === 'settings') {
      return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Settings</h2>
          <p style={{ color: 'var(--text-muted)' }}>Coming soon... connection preferences and team options.</p>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', opacity: loading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: '800', marginBottom: '0.5rem' }}>Collections Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Track total debt, overdue balances, and account health across your team.</p>
        </div>

        <Dashboard metrics={metrics} />

        <AgentToolbar>
          <AgentSelect value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
            <option value="all">All agents</option>
            {agentOptions.map((agentName) => (
              <option key={agentName} value={agentName}>{agentName}</option>
            ))}
          </AgentSelect>

          <AgentSnapshot>
            <Users size={16} color="var(--brand)" />
            <div>
              <div>
                <strong>{snapshotClients}</strong> clients | <strong>{snapshotClientsInDebt}</strong> in debt | <strong>{snapshotClientsClear}</strong> clear
              </div>
            </div>
          </AgentSnapshot>
        </AgentToolbar>

        <DebtorsList
          data={agentData}
          onEdit={(debtor) => {
            setCurrentDebtor(debtor);
            setIsModalOpen(true);
          }}
          onDelete={handleDeleteDebtor}
        />
      </div>
    );
  };

  return (
    <AppContainer>
      <Sidebar $isOpen={isSidebarOpen}>
        <div style={{ width: '260px', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Logo>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--brand), #67d8ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)',
              flexShrink: 0
            }}>
              <Layers color="#062131" size={20} />
            </div>
            Flow<span>Collect</span>
          </Logo>
          <BrandOwner>Andres Mendez</BrandOwner>

          <nav style={{ flex: 1 }}>
            <NavItem $active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
              Dashboard
            </NavItem>
            <NavItem $active={activeTab === 'reports'} onClick={() => setActiveTab('reports')}>
              <span style={{ fontSize: '1.2rem' }}>📊</span> Reports
            </NavItem>
            <NavItem $active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              <span style={{ fontSize: '1.2rem' }}>⚙️</span> Settings
            </NavItem>
          </nav>
        </div>
      </Sidebar>

      <MainContent>
        <Topbar>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Menu
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
              size={24}
            />
            <h1 style={{ fontSize: '1.35rem', margin: 0, color: '#39b8ff' }}>Citifuel</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => loadData({ notifyUser: true })}>
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} /> Sync
              </button>
              <button className="btn btn-primary" onClick={openNewModal}>
                <Plus size={16} /> New Debtor
              </button>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Source: {syncSourceLabel} | Last sync: {syncTimeLabel}</span>
          </div>
        </Topbar>

        <ContentScroll>
          {renderContent()}
        </ContentScroll>
      </MainContent>

      <DebtorModal
        key={`${currentDebtor?.id || 'new'}-${isModalOpen ? 'open' : 'closed'}`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveDebtor}
        debtor={currentDebtor}
      />

      <Toaster position="bottom-right" />

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </AppContainer>
  );
}

export default App;
