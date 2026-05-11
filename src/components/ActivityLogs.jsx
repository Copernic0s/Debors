import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Activity, Clock3, Filter, LogIn, PencilLine, RefreshCw, Search } from 'lucide-react';
import { fetchActivityLogs } from '../services/activityLogger';

const Container = styled.div`
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 1.6rem;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-main);
  }

  p {
    margin: 0.35rem 0 0 0;
    color: var(--text-muted);
    font-size: 0.88rem;
  }
`;

const HeaderAction = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  padding: 0.7rem 1rem;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: rgba(249, 115, 22, 0.35);
    color: var(--brand);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ControlRow = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) minmax(180px, 0.7fr);
  gap: 0.85rem;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const FieldShell = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    pointer-events: none;
  }

  input,
  select {
    width: 100%;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.78rem 0.95rem;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
  }

  input {
    padding-left: 2.6rem;
  }

  option {
    background: #0f172a;
    color: var(--text-main);
  }
`;

const SummaryBar = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const SummaryChip = styled.div`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 999px;
  padding: 0.5rem 0.8rem;
  color: var(--text-muted);
  font-size: 0.82rem;

  strong {
    color: var(--text-main);
    margin-right: 0.35rem;
  }
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const LogRow = styled.div`
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 0.9rem;
  align-items: flex-start;
`;

const IconShell = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid ${(props) => props.$border};
  background: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const LogCard = styled.div`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.025);
  border-radius: 18px;
  padding: 0.95rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const LogTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  flex-wrap: wrap;

  strong {
    color: var(--text-main);
    font-size: 0.9rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
`;

const LogDetail = styled.p`
  margin: 0;
  color: var(--text-main);
  font-size: 0.9rem;
  line-height: 1.5;
`;

const MetaRow = styled.div`
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const MetaChip = styled.span`
  border-radius: 999px;
  padding: 0.28rem 0.6rem;
  font-size: 0.74rem;
  font-weight: 700;
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.03);
`;

const EmptyState = styled.div`
  border: 1px dashed var(--glass-border);
  border-radius: 18px;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-muted);
`;

const getActionTone = (actionType) => {
  const normalized = String(actionType || '').toUpperCase();
  if (normalized === 'LOGIN') {
    return {
      icon: <LogIn size={18} />,
      bg: 'rgba(56, 189, 248, 0.08)',
      color: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.2)'
    };
  }

  return {
    icon: <PencilLine size={18} />,
    bg: 'rgba(249, 115, 22, 0.08)',
    color: 'var(--brand)',
    border: 'rgba(249, 115, 22, 0.2)'
  };
};

const formatTimestamp = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

function ActivityLogs({ refreshSignal = 0 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const rows = await fetchActivityLogs(50);
      setLogs(rows);
    } catch (error) {
      setLogs([]);
      setLoadError(error?.message || 'Unable to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [refreshSignal]);

  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return logs.filter((item) => {
      const matchesAction = actionFilter === 'all' || String(item.action_type || '').toUpperCase() === actionFilter;
      const matchesSearch = term === '' ||
        String(item.user_email || '').toLowerCase().includes(term) ||
        String(item.details || '').toLowerCase().includes(term) ||
        String(item.company || '').toLowerCase().includes(term) ||
        String(item.field_name || '').toLowerCase().includes(term);

      return matchesAction && matchesSearch;
    });
  }, [logs, searchTerm, actionFilter]);

  const summary = useMemo(() => {
    const logins = logs.filter((item) => String(item.action_type || '').toUpperCase() === 'LOGIN').length;
    const edits = logs.filter((item) => String(item.action_type || '').toUpperCase() !== 'LOGIN').length;
    const uniqueUsers = new Set(logs.map((item) => String(item.user_email || '').toLowerCase()).filter(Boolean)).size;

    return { total: logs.length, logins, edits, uniqueUsers };
  }, [logs]);

  return (
    <Container>
      <Header>
        <div>
          <h3>Activity Logs</h3>
          <p>Secure internal audit trail for logins and sensitive collection edits.</p>
        </div>

        <HeaderAction type="button" onClick={loadLogs} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </HeaderAction>
      </Header>

      <SummaryBar>
        <SummaryChip><strong>{summary.total}</strong>Total events</SummaryChip>
        <SummaryChip><strong>{summary.logins}</strong>Logins</SummaryChip>
        <SummaryChip><strong>{summary.edits}</strong>Edits</SummaryChip>
        <SummaryChip><strong>{summary.uniqueUsers}</strong>Users tracked</SummaryChip>
      </SummaryBar>

      <ControlRow>
        <FieldShell>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search user, company, field, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </FieldShell>

        <FieldShell>
          <Filter size={16} />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All events</option>
            <option value="LOGIN">Logins</option>
            <option value="EDIT">Edits</option>
          </select>
        </FieldShell>
      </ControlRow>

      <Timeline>
        {loading && (
          <EmptyState>Loading latest activity...</EmptyState>
        )}

        {!loading && loadError && (
          <EmptyState>{loadError}</EmptyState>
        )}

        {!loading && filteredLogs.length === 0 && (
          <EmptyState>
            {logs.length === 0
              ? 'No activity logs yet. Events start appearing only after the activity table is active and other users log in or make tracked edits.'
              : 'No activity logs found for the current filters.'}
          </EmptyState>
        )}

        {!loading && !loadError && filteredLogs.map((log) => {
          const tone = getActionTone(log.action_type);
          return (
            <LogRow key={log.id}>
              <IconShell $bg={tone.bg} $color={tone.color} $border={tone.border}>
                {tone.icon}
              </IconShell>

              <LogCard>
                <LogTop>
                  <strong>{log.user_email || 'Unknown user'}</strong>
                  <span>{formatTimestamp(log.created_at)}</span>
                </LogTop>

                <LogDetail>{log.details}</LogDetail>

                <MetaRow>
                  <MetaChip>{String(log.action_type || 'EVENT').toUpperCase()}</MetaChip>
                  {log.company && <MetaChip>{log.company}</MetaChip>}
                  {log.field_name && <MetaChip>{log.field_name}</MetaChip>}
                  {log.old_value !== null && <MetaChip>From: {log.old_value}</MetaChip>}
                  {log.new_value !== null && <MetaChip>To: {log.new_value}</MetaChip>}
                </MetaRow>
              </LogCard>
            </LogRow>
          );
        })}
      </Timeline>
    </Container>
  );
}

export default ActivityLogs;
