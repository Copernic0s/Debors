import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, Filter, CheckCircle, Clock } from 'lucide-react';

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
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;

  h3 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-main);
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
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
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.6rem 1rem 0.6rem 2.5rem;
    border-radius: var(--radius-md);
    font-family: 'Manrope', sans-serif;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.2s ease;
    width: 260px;

    &:focus {
      border-color: var(--brand);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 0 10px rgba(249, 115, 22, 0.2);
    }
    
    &::placeholder {
      color: var(--text-muted);
    }
  }
`;

const SelectBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  select {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.6rem 2rem 0.6rem 1rem;
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
    padding: 1rem 1.25rem;
    text-align: left;
    border-bottom: 1px solid var(--glass-border);
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
  }

  .col-company {
    font-weight: 700;
    color: white;
  }

  .col-task {
    white-space: normal;
    min-width: 250px;
    line-height: 1.4;
  }
  
  .col-notes {
    white-space: normal;
    min-width: 250px;
    color: var(--text-muted);
    font-size: 0.85rem;
    line-height: 1.4;
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

const getStatusBadgeProps = (status) => {
  const s = String(status || '').trim().toLowerCase();
  if (s.includes('done') || s.includes('complete') || s.includes('listo') || s.includes('completado')) {
    return {
      $bg: 'rgba(34, 197, 94, 0.1)',
      $color: '#4ade80',
      $border: 'rgba(34, 197, 94, 0.2)',
      $glow: 'rgba(34, 197, 94, 0.1)',
      icon: <CheckCircle size={14} />
    };
  }
  if (s.includes('pending') || s.includes('pendiente')) {
    return {
      $bg: 'rgba(234, 179, 8, 0.1)',
      $color: '#facc15',
      $border: 'rgba(234, 179, 8, 0.2)',
      $glow: 'rgba(234, 179, 8, 0.1)',
      icon: <Clock size={14} />
    };
  }
  if (s.includes('progress') || s.includes('proceso') || s.includes('doing')) {
    return {
      $bg: 'rgba(56, 189, 248, 0.1)',
      $color: '#38bdf8',
      $border: 'rgba(56, 189, 248, 0.2)',
      $glow: 'rgba(56, 189, 248, 0.1)',
      icon: <Clock size={14} />
    };
  }
  return {
    $bg: 'rgba(255, 255, 255, 0.05)',
    $color: 'var(--text-main)',
    $border: 'var(--glass-border)',
    icon: null
  };
};

const SupportTracker = ({ data = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Extract unique statuses for the filter dropdown
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set();
    data.forEach(item => {
      if (item.status) statuses.add(String(item.status).trim());
    });
    return Array.from(statuses).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // General term search on company or task
      const term = searchTerm.toLowerCase();
      const matchSearch = term === '' || 
        String(item.company || '').toLowerCase().includes(term) ||
        String(item.task || '').toLowerCase().includes(term);

      const matchStatus = statusFilter === 'all' || 
        String(item.status || '').trim() === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [data, searchTerm, statusFilter]);

  if (!data || data.length === 0) {
    return (
      <TrackerContainer style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)' }}>No Support Logs Found</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Add a "Tracker" sheet to your Zoho document with Date, Customer, Task, Status, and Notes columns.
        </p>
      </TrackerContainer>
    );
  }

  return (
    <TrackerContainer>
      <HeaderRow>
        <h3>Support & CS Tracker</h3>
        <ControlsContainer>
          <SearchInputBox>
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search tasks or companies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </SearchInputBox>
          <SelectBox>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <Filter size={14} />
          </SelectBox>
        </ControlsContainer>
      </HeaderRow>

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer / Company</th>
              <th>Task</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(item => {
              const badgeProps = getStatusBadgeProps(item.status);
              
              return (
                <tr key={item.id}>
                  <td className="col-date">{item.date}</td>
                  <td className="col-company">{item.company}</td>
                  <td className="col-task">{item.task}</td>
                  <td>
                    <StatusBadge {...badgeProps}>
                      {badgeProps.icon} {item.status || 'Active'}
                    </StatusBadge>
                  </td>
                  <td className="col-notes">{item.notes}</td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
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
