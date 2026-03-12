import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Bell, User, Menu, RefreshCw, Layers, Plus, Database, Clock3 } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import DebtorsList from './components/DebtorsList';
import DebtorModal from './components/DebtorModal';
import { mockDebtors, calculateMetrics } from './data/mockData';
import { fetchDebtorsFromSheet } from './services/zohoWorkDrive';
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
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2.5rem;

  span {
    color: var(--accent-color);
  }
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

const SyncMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;

  @media (max-width: 1100px) {
    display: none;
  }
`;

const SyncChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: var(--surface-2);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);

  strong {
    color: var(--text-main);
    font-weight: 700;
  }
`;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUsingRealData, setIsUsingRealData] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncSource, setSyncSource] = useState('mock');
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
      const sheetData = await fetchDebtorsFromSheet(undefined, { cacheBust: true });

      if (sheetData && sheetData.length > 0) {
        setData(sheetData);
        setIsUsingRealData(true);
        setSyncSource('zoho');
        if (notifyUser) {
          toast.success(`Sincronizacion completa (${sheetData.length} registros)`, {
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      } else {
        setData(mockDebtors);
        setIsUsingRealData(false);
        setSyncSource('mock');
        if (notifyUser) {
          toast('Zoho no devolvio filas. Se usa respaldo local.', {
            icon: 'ℹ️',
            style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
          });
        }
      }
    } catch {
      setData(mockDebtors);
      setIsUsingRealData(false);
      setSyncSource('mock');
      if (notifyUser) {
        toast.error('No se pudo conectar con Zoho. Mostrando datos locales.', {
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

  const handleSaveDebtor = (debtor) => {
    if (currentDebtor) {
      // Editar
      setData(data.map(d => d.id === debtor.id ? debtor : d));
      toast.success('Deuda actualizada correctamente', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    } else {
      // Nuevo
      setData([debtor, ...data]);
      toast.success('Nuevo deudor registrado', {
        style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
      });
    }
    setIsModalOpen(false);
    setCurrentDebtor(null);
  };

  const handleDeleteDebtor = (id) => {
    setData(data.filter(d => d.id !== id));
    toast.success('Registro eliminado', {
      icon: '🗑️',
      style: { background: 'var(--surface-3)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }
    });
  };

  const openNewModal = () => {
    setCurrentDebtor(null);
    setIsModalOpen(true);
  };

  const metrics = calculateMetrics(data);
  const syncTimeLabel = lastSyncAt
    ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(lastSyncAt)
    : '--:--';

  const renderContent = () => {
    if (activeTab === 'reports') {
      return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Módulo de Reportes</h2>
          <p style={{ color: 'var(--text-muted)' }}>Próximamente... Aquí podrás ver gráficas de recaudación por agente y exportar PDFs.</p>
        </div>
      );
    }

    if (activeTab === 'settings') {
      return (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Configuración</h2>
          <p style={{ color: 'var(--text-muted)' }}>Próximamente... Ajustes de conexión con Work Drive y preferencias del equipo.</p>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', opacity: loading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: '800', marginBottom: '0.5rem' }}>Bienvenido al Panel 👋</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Aquí está el resumen de las cobranzas consolidado.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: '0.45rem' }}>
            Fuente activa: {isUsingRealData ? 'Zoho WorkDrive' : 'Respaldo local'} | Ultima sincronizacion: {syncTimeLabel}
          </p>
        </div>

        <Dashboard metrics={metrics} />
        <DebtorsList
          data={data}
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

          <nav style={{ flex: 1 }}>
            <NavItem $active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}>
              Dashboard
            </NavItem>
            <NavItem $active={activeTab === 'reports'} onClick={() => setActiveTab('reports')}>
              <span style={{ fontSize: '1.2rem' }}>📊</span> Reportes
            </NavItem>
            <NavItem $active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              <span style={{ fontSize: '1.2rem' }}>⚙️</span> Configuración
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
            <h1 style={{ fontSize: '1.35rem', margin: 0 }}>Citifuel</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => loadData({ notifyUser: true })}>
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} /> Sincronizar
              </button>
              <button className="btn btn-primary" onClick={openNewModal}>
                <Plus size={16} /> Nuevo Deudor
              </button>
            </div>

            <SyncMeta>
              <SyncChip>
                <Database size={14} />
                Fuente: <strong>{syncSource === 'zoho' ? 'Zoho' : 'Local'}</strong>
              </SyncChip>
              <SyncChip>
                <Clock3 size={14} />
                Sync: <strong>{syncTimeLabel}</strong>
              </SyncChip>
            </SyncMeta>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
              <Bell size={20} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: 'var(--surface-3)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-md)'
              }}>
                <User size={18} color="var(--brand)" />
              </div>
            </div>
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
