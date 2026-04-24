import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Search, Filter, CheckCircle, Clock3, AlertCircle, ClipboardList, UserRound } from 'lucide-react';

const TrackerContainer = styled.div`
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.4s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;

  h3 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-main);
  }

  p {
    margin: 0.35rem 0 0;
    color: var(--text-muted);
    font-size: 0.92rem;
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1rem;
`;

const SummaryCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1rem 1.1rem;
  display: flex;
  gap: 0.85rem;
  align-items: center;

  svg {
    color: ${(props) => props.$accent || 'var(--brand)'};
    flex-shrink: 0;
  }

  strong {
    display: block;
    font-size: 1.25rem;
    color: var(--text-main);
  }

  span {
    color: var(--text-muted);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

const ControlsGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(240px, 1.4fr) repeat(3, minmax(170px, 0.9fr));
  gap: 1rem;

  @media (max-width: 1050px) {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const SearchInputBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
  }

  input {
    width: 100%;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.7rem 1rem 0.7rem 2.6rem;
    border-radius: var(--radius-md);
    font-family: 'Manrope', sans-serif;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s ease;

    &:focus {
      border-color: var(--brand);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 0 10px rgba(249, 115, 22, 0.2);
    }
  }
`;

const SelectBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  select {
    width: 100%;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.7rem 2rem 0.7rem 0.9rem;
    border-radius: var(--radius-md);
    font-family: 'Manrope', sans-serif;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s ease;
    cursor: pointer;
    appearance: none;

    &:focus {
      border-color: var(--brand);
    }

    option {
      background: #0f172a;
      color: var(--text-main);
    }
  }

  svg {
    position: absolute;
    right: 12px;
    color: var(--text-muted);
    pointer-events: none;
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);

  ::-webkit-scrollbar {
    height: 6px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--glass-border);
    border-radius: 4px;
  }
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;

  th, td {
    padding: 1rem 1.15rem;
    text-align: left;
    border-bottom: 1px solid var(--glass-border);
    vertical-align: top;
  }

  th {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tbody tr {
    transition: background 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.02);
    }
  }

  td {
    font-size: 0.9rem;
    color: var(--text-main);
  }

  .col-date {
    color: var(--text-muted);
    font-weight: 500;
    min-width: 115px;
  }

  .col-company {
    font-weight: 700;
    color: white;
    min-width: 220px;
  }

  .col-agent {
    color: var(--text-muted);
    min-width: 150px;
  }

  .col-task {
    white-space: normal;
    min-width: 280px;
    line-height: 1.45;
  }

  .col-notes {
    white-space: normal;
    min-width: 280px;
    color: var(--text-muted);
    font-size: 0.85rem;
    line-height: 1.45;
  }
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  border: 1px solid ${(props) => props.$border};
  box-shadow: 0 0 10px ${(props) => props.$glow || 'transparent'};
`;

const normalizeStatusLabel = (status) => {
  const value = String(status || '').trim();
  if (!value) return 'Unspecified';

  const lower = value.toLowerCase();
  if (lower.includes('done') || lower.includes('complete') || lower.includes('listo') || lower.includes('completado')) return 'Completed';
  if (lower.includes('progress') || lower.includes('doing') || lower.includes('working')) return 'In Progress';
  if (lower.includes('pending') || lower.includes('follow') || lower.includes('waiting') || lower.includes('pendiente')) return 'Follow-up';
  return value;
};

const getStatusBadgeProps = (status) => {
  const normalized = normalizeStatusLabel(status).toLowerCase();

  if (normalized === 'completed') {
    return {
      $bg: 'rgba(34, 197, 94, 0.1)',
      $color: '#4ade80',
      $border: 'rgba(34, 197, 94, 0.2)',
      $glow: 'rgba(34, 197, 94, 0.1)',
      icon: <CheckCircle size={14} />
    };
  }

  if (normalized === 'follow-up') {
    return {
      $bg: 'rgba(234, 179, 8, 0.1)',
      $color: '#facc15',
      $border: 'rgba(234, 179, 8, 0.2)',
      $glow: 'rgba(234, 179, 8, 0.1)',
      icon: <AlertCircle size={14} />
    };
  }

  if (normalized === 'in progress') {
    return {
      $bg: 'rgba(56, 189, 248, 0.1)',
      $color: '#38bdf8',
      $border: 'rgba(56, 189, 248, 0.2)',
      $glow: 'rgba(56, 189, 248, 0.1)',
      icon: <Clock3 size={14} />
    };
  }

  return {
    $bg: 'rgba(255, 255, 255, 0.05)',
    $color: 'var(--text-main)',
    $border: 'var(--glass-border)',
    icon: null
  };
};

const sortByNewestDate = (items) =>
  [...items].sort((a, b) => {
    const aDate = String(a.date || '');
    const bDate = String(b.date || '');
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return String(a.company || '').localeCompare(String(b.company || ''));
  });

const SupportTracker = ({ data = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  const normalizedData = useMemo(
    () =>
      sortByNewestDate(
        data.map((item, index) => ({
          ...item,
          id: item.id || `tracker-row-${index}`,
          statusLabel: normalizeStatusLabel(item.status),
          agentLabel: String(item.agent || '').trim() || 'Unassigned'
        }))
      ),
    [data]
  );

  const uniqueStatuses = useMemo(
    () => Array.from(new Set(normalizedData.map((item) => item.statusLabel))).sort(),
    [normalizedData]
  );

  const uniqueCompanies = useMemo(
    () => Array.from(new Set(normalizedData.map((item) => String(item.company || '').trim()).filter(Boolean))).sort(),
    [normalizedData]
  );

  const uniqueAgents = useMemo(
    () => Array.from(new Set(normalizedData.map((item) => item.agentLabel))).sort(),
    [normalizedData]
  );

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return normalizedData.filter((item) => {
      const matchSearch =
        term === '' ||
        String(item.company || '').toLowerCase().includes(term) ||
        String(item.task || '').toLowerCase().includes(term) ||
        String(item.notes || '').toLowerCase().includes(term);

      const matchStatus = statusFilter === 'all' || item.statusLabel === statusFilter;
      const matchCompany = companyFilter === 'all' || String(item.company || '').trim() === companyFilter;
      const matchAgent = agentFilter === 'all' || item.agentLabel === agentFilter;

      return matchSearch && matchStatus && matchCompany && matchAgent;
    });
  }, [normalizedData, searchTerm, statusFilter, companyFilter, agentFilter]);

  const summary = useMemo(() => {
    const completed = normalizedData.filter((item) => item.statusLabel === 'Completed').length;
    const inProgress = normalizedData.filter((item) => item.statusLabel === 'In Progress').length;
    const followUp = normalizedData.filter((item) => item.statusLabel === 'Follow-up').length;
    const companies = new Set(normalizedData.map((item) => String(item.company || '').trim()).filter(Boolean)).size;

    return {
      total: normalizedData.length,
      completed,
      inProgress,
      followUp,
      companies
    };
  }, [normalizedData]);

  if (!data || data.length === 0) {
    return (
      <TrackerContainer style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>No Support Logs Found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Add a "Tracker" sheet to your Zoho document with Date, Customer, Agent, Task, Status, and Notes columns.
        </p>
      </TrackerContainer>
    );
  }

  return (
    <TrackerContainer>
      <HeaderRow>
        <div>
          <h3>Support & CS Tracker</h3>
          <p>Quick visibility into follow-ups, completed work, and operational history by company.</p>
        </div>
      </HeaderRow>

      <SummaryGrid>
        <SummaryCard $accent="var(--brand)">
          <ClipboardList size={20} />
          <div>
            <strong>{summary.total}</strong>
            <span>Total logs</span>
          </div>
        </SummaryCard>
        <SummaryCard $accent="#4ade80">
          <CheckCircle size={20} />
          <div>
            <strong>{summary.completed}</strong>
            <span>Completed</span>
          </div>
        </SummaryCard>
        <SummaryCard $accent="#38bdf8">
          <Clock3 size={20} />
          <div>
            <strong>{summary.inProgress}</strong>
            <span>In progress</span>
          </div>
        </SummaryCard>
        <SummaryCard $accent="#facc15">
          <AlertCircle size={20} />
          <div>
            <strong>{summary.followUp}</strong>
            <span>Follow-up</span>
          </div>
        </SummaryCard>
        <SummaryCard $accent="#a78bfa">
          <UserRound size={20} />
          <div>
            <strong>{summary.companies}</strong>
            <span>Companies</span>
          </div>
        </SummaryCard>
      </SummaryGrid>

      <ControlsGrid>
        <SearchInputBox>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search company, task, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchInputBox>

        <SelectBox>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <Filter size={14} />
        </SelectBox>

        <SelectBox>
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="all">All companies</option>
            {uniqueCompanies.map((company) => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>
          <Filter size={14} />
        </SelectBox>

        <SelectBox>
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="all">All agents</option>
            {uniqueAgents.map((agent) => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
          <Filter size={14} />
        </SelectBox>
      </ControlsGrid>

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Agent</th>
              <th>Task</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => {
              const badgeProps = getStatusBadgeProps(item.statusLabel);

              return (
                <tr key={item.id}>
                  <td className="col-date">{item.date || 'No date'}</td>
                  <td className="col-company">{item.company || 'Unknown'}</td>
                  <td className="col-agent">{item.agentLabel}</td>
                  <td className="col-task">{item.task || 'No task provided'}</td>
                  <td>
                    <StatusBadge {...badgeProps}>
                      {badgeProps.icon} {item.statusLabel}
                    </StatusBadge>
                  </td>
                  <td className="col-notes">{item.notes || 'No notes'}</td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No matches found for your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </StyledTable>
      </TableWrapper>
    </TrackerContainer>
  );
};

export default SupportTracker;
