import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Search, CheckCircle, Clock3, AlertCircle, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';

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
  gap: 1rem;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--text-main);
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

const SearchInputBox = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  max-width: 460px;

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

const PageSizeSelect = styled.select`
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  color: var(--text-main);
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  font-family: 'Manrope', sans-serif;
  font-size: 0.88rem;
  outline: none;

  option {
    background: #0f172a;
    color: var(--text-main);
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

const PaginationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const PaginationInfo = styled.span`
  color: var(--text-muted);
  font-size: 0.88rem;
`;

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const PageButton = styled.button`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  border-radius: 10px;
  padding: 0.55rem 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
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
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const normalizedData = useMemo(
    () =>
      sortByNewestDate(
        data.map((item, index) => ({
          ...item,
          id: item.id || `tracker-row-${index}`,
          statusLabel: normalizeStatusLabel(item.status)
        }))
      ),
    [data]
  );

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return normalizedData.filter((item) => (
      term === '' ||
      String(item.company || '').toLowerCase().includes(term) ||
      String(item.task || '').toLowerCase().includes(term) ||
      String(item.notes || '').toLowerCase().includes(term)
    ));
  }, [normalizedData, searchTerm]);

  const summary = useMemo(() => {
    const completed = normalizedData.filter((item) => item.statusLabel === 'Completed').length;
    const inProgress = normalizedData.filter((item) => item.statusLabel === 'In Progress').length;
    const followUp = normalizedData.filter((item) => item.statusLabel === 'Follow-up').length;

    return {
      total: normalizedData.length,
      completed,
      inProgress,
      followUp
    };
  }, [normalizedData]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
        <PageSizeSelect
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
        </PageSizeSelect>
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
      </SummaryGrid>

      <SearchInputBox>
        <Search size={16} />
        <input
          type="text"
          placeholder="Search company, task, or notes..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
        />
      </SearchInputBox>

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Task</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => {
              const badgeProps = getStatusBadgeProps(item.statusLabel);

              return (
                <tr key={item.id}>
                  <td className="col-date">{item.date || 'No date'}</td>
                  <td className="col-company">{item.company || 'Unknown'}</td>
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
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No matches found for your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </StyledTable>
      </TableWrapper>

      <PaginationRow>
        <PaginationInfo>
          Showing {filteredData.length === 0 ? 0 : pageStart + 1} to {Math.min(pageStart + pageSize, filteredData.length)} of {filteredData.length} records
        </PaginationInfo>

        <PaginationControls>
          <PageButton type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
            <ChevronLeft size={16} />
            Previous
          </PageButton>
          <PaginationInfo>Page {currentPage} of {totalPages}</PaginationInfo>
          <PageButton type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
            Next
            <ChevronRight size={16} />
          </PageButton>
        </PaginationControls>
      </PaginationRow>
    </TrackerContainer>
  );
};

export default SupportTracker;
