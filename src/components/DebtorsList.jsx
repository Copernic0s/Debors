import React, { useState } from 'react';
import styled from 'styled-components';
import { Search, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { BILLING_CYCLE_OPTIONS, BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const Container = styled.div`
  padding: 2rem;
  margin-top: 1.5rem;
  animation: fadeIn 0.6s ease-out;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(24px);
  border-radius: var(--radius-xl);

  @media (max-width: 768px) {
    padding: 1rem;
    margin-top: 1rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const SearchInput = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  
  input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    padding: 0.7rem 1rem 0.7rem 2.8rem;
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.9rem;
    width: min(320px, 80vw);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &::placeholder {
      color: var(--text-muted);
      opacity: 0.6;
    }

    &:focus {
      outline: none;
      border-color: var(--brand);
      background: rgba(0, 0, 0, 0.4);
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);
      width: min(360px, 85vw);
    }
  }

  svg {
    position: absolute;
    left: 1rem;
    color: var(--text-muted);
    transition: color 0.3s;
    pointer-events: none;
  }

  &:focus-within svg {
    color: var(--brand);
  }

  @media (max-width: 768px) {
    width: 100%;
    input { width: 100% !important; }
  }
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  width: 100%;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

const Th = styled.th`
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;

  &:hover {
    color: var(--text-main);
  }

  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  @media (max-width: 768px) {
    white-space: nowrap;
    padding: 0.8rem;
  }
`;

const Td = styled.td`
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--text-main);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  vertical-align: middle;

  @media (max-width: 768px) {
    padding: 0.8rem;
    white-space: nowrap;
  }
`;

const Tr = styled.tr`
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.04);
  }

  &:last-child ${Td} {
    border-bottom: none;
  }
`;

const formatAmountInput = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0,00';
  return new Intl.NumberFormat('es-ES', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numeric);
};

const BillingCycleSelect = styled.select`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  font-size: 0.78rem;
  padding: 0.32rem 0.45rem;
  min-width: 148px;

  option {
    background: var(--bg-2);
    color: var(--text-main);
  }
`;

const StatusSelect = styled(BillingCycleSelect)`
  min-width: 122px;
  font-weight: 700;
  color: ${(props) => {
    if (props.$tone === 'paid') return 'var(--ok)';
    if (props.$tone === 'overdue') return 'var(--danger)';
    if (props.$tone === 'no_invoice') return 'var(--text-muted)';
    return 'var(--warn)';
  }};
  border-color: ${(props) => {
    if (props.$tone === 'paid') return 'rgba(16, 185, 129, 0.35)';
    if (props.$tone === 'overdue') return 'rgba(248, 113, 113, 0.35)';
    if (props.$tone === 'no_invoice') return 'rgba(149, 164, 187, 0.3)';
    return 'rgba(245, 158, 11, 0.35)';
  }};
  background: ${(props) => {
    if (props.$tone === 'paid') return 'rgba(16, 185, 129, 0.12)';
    if (props.$tone === 'overdue') return 'rgba(248, 113, 113, 0.12)';
    if (props.$tone === 'no_invoice') return 'rgba(149, 164, 187, 0.12)';
    return 'rgba(245, 158, 11, 0.12)';
  }};
`;

const SourceBadge = styled.span`
  border: 1px solid ${(props) => (props.$type === 'invoice' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(149, 164, 187, 0.3)')};
  background: ${(props) => (props.$type === 'invoice' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(149, 164, 187, 0.12)')};
  color: ${(props) => (props.$type === 'invoice' ? 'var(--brand)' : 'var(--text-muted)')};
  border-radius: 999px;
  padding: 0.18rem 0.56rem;
  font-size: 0.7rem;
  font-weight: 700;
`;

// Removed InvoiceStepper and StepButton as they are no longer needed

const DueInput = styled.input`
  width: 112px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-main);
  padding: 0.32rem 0.45rem;
  font-size: 0.78rem;

  &:focus {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.16);
  }
`;

const IconActionButton = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 9px;
  border: 1px solid ${(props) => props.$danger ? 'rgba(248, 113, 113, 0.36)' : 'rgba(56, 189, 248, 0.35)'};
  background: ${(props) => props.$danger ? 'rgba(248, 113, 113, 0.12)' : 'rgba(56, 189, 248, 0.14)'};
  color: ${(props) => props.$danger ? 'var(--danger)' : 'var(--brand)'};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s, filter 0.15s;

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }
`;

const FooterBar = styled.div`
  margin-top: 0.95rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const Pager = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
`;

const PagerButton = styled.button`
  border: 1px solid var(--border-color);
  background: var(--surface-2);
  color: var(--text-main);
  border-radius: 8px;
  padding: 0.35rem 0.55rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const getComputedStatus = (item) => {
  const rawStatus = String(item.status ?? '').toLowerCase();
  if (rawStatus === 'no_invoice') return 'no_invoice';
  if (rawStatus === 'paid' || rawStatus === 'pagado' || rawStatus === 'cobrado') return 'paid';
  if (rawStatus === 'overdue' || rawStatus === 'mora' || rawStatus === 'vencido') return 'overdue';

  if (item.dueDate) {
    const dueDate = new Date(`${item.dueDate}T00:00:00`);
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!Number.isNaN(dueDate.getTime()) && dueDate < dayStart) {
      return 'overdue';
    }
  }

  return 'pending';
};

export default function DebtorsList({
  data,
  onEdit,
  onDelete,
  onOpenCompanyProfile,
  onQuickUpdateBillingCycle,
  onQuickUpdateStatus,
  onQuickUpdateAmount
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'company', direction: 'asc' });
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, item: null });
  const [pendingAmounts, setPendingAmounts] = useState({});
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const commitQuickAmount = (item) => {
    const raw = pendingAmounts[item.id];
    if (raw === undefined) return;
    onQuickUpdateAmount?.(item, raw);
    setPendingAmounts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };


  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...data].sort((a, b) => {
    if (sortConfig.key === 'status') {
      const aStatus = getComputedStatus(a);
      const bStatus = getComputedStatus(b);
      if (aStatus < bStatus) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStatus > bStatus) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (sortConfig.key === 'company') {
      const aCompany = String(a.company || a.clientName || '');
      const bCompany = String(b.company || b.clientName || '');
      if (aCompany < bCompany) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aCompany > bCompany) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (sortConfig.key === 'agentId' || sortConfig.key === 'billingCycle') {
      const aValue = String(a[sortConfig.key] || '');
      const bValue = String(b[sortConfig.key] || '');
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const filteredData = sortedData.filter(item => {
    const companyName = String(item.company || item.clientName || '').toLowerCase();
    const agentName = String(item.agentId || '').toLowerCase();
    return companyName.includes(searchTerm.toLowerCase()) || agentName.includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedData = filteredData.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Container className="glass-panel">
      <Header>
        <Title>Debtors List</Title>
        <Controls>
          <SearchInput>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search company or agent..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </SearchInput>
        </Controls>
      </Header>

      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <Th onClick={() => handleSort('company')}>Company {sortConfig.key === 'company' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th onClick={() => handleSort('agentId')}>Sales Rep {sortConfig.key === 'agentId' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th onClick={() => handleSort('billingCycle')}>Billing Cycle {sortConfig.key === 'billingCycle' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th onClick={() => handleSort('status')}>Payment Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th onClick={() => handleSort('sourceType')}>Source {sortConfig.key === 'sourceType' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th onClick={() => handleSort('amount')}>Total Due ($) {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? paginatedData.map((item) => (
              <Tr key={item.id}>
                <Td style={{ fontWeight: 600 }}>
                  <button
                    type="button"
                    onClick={() => onOpenCompanyProfile?.(item.company || item.clientName)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--brand)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left'
                    }}
                  >
                    {item.company || item.clientName || 'Unassigned Company'}
                  </button>
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      flexShrink: 0
                    }}>
                      {(item.agentId && typeof item.agentId === 'string') ? item.agentId.charAt(0).toUpperCase() : '?'}
                    </div>
                    {item.agentId}
                  </div>
                </Td>
                <Td>
                  <BillingCycleSelect
                    value={normalizeBillingCycle(item.billingCycle || BILLING_CYCLES.UNSPECIFIED)}
                    onChange={(e) => onQuickUpdateBillingCycle?.(item, e.target.value)}
                  >
                    {BILLING_CYCLE_OPTIONS.map((cycle) => (
                      <option key={cycle} value={cycle}>{cycle}</option>
                    ))}
                  </BillingCycleSelect>
                </Td>
                <Td>
                  <StatusSelect
                    $tone={getComputedStatus(item)}
                    value={getComputedStatus(item)}
                    onChange={(e) => onQuickUpdateStatus?.(item, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="no_invoice">No invoice</option>
                  </StatusSelect>
                </Td>
                <Td>
                  <SourceBadge $type={item.sourceType || 'invoice'}>{(item.sourceType || 'invoice') === 'invoice' ? 'Invoice' : 'CS'}</SourceBadge>
                </Td>
                <Td>
                  <DueInput
                    type="text"
                    inputMode="decimal"
                    value={pendingAmounts[item.id] ?? formatAmountInput(item.amount ?? 0)}
                    onChange={(e) => setPendingAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    onBlur={() => commitQuickAmount(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitQuickAmount(item);
                      }
                    }}
                  />
                </Td>
                <Td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <IconActionButton
                      type="button"
                      onClick={() => onEdit(item)}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </IconActionButton>
                    <IconActionButton
                      type="button"
                      $danger
                      onClick={() => setDeleteDialog({ isOpen: true, item })}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </IconActionButton>
                  </div>
                </Td>
              </Tr>
            )) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrapper>

      <FooterBar>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          Showing {(safePage - 1) * pageSize + (paginatedData.length ? 1 : 0)}-{(safePage - 1) * pageSize + paginatedData.length} of {filteredData.length}
        </span>
        <Pager>
          <PagerButton type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</PagerButton>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Page {safePage} / {totalPages}</span>
          <PagerButton type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</PagerButton>
        </Pager>
      </FooterBar>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Record"
        message={`Are you sure you want to delete the collection record for "${deleteDialog.item?.company || deleteDialog.item?.clientName}"? This action cannot be undone.`}
        isDanger={true}
        confirmText="Yes, Delete"
        onCancel={() => setDeleteDialog({ isOpen: false, item: null })}
        onConfirm={() => {
          if (deleteDialog.item) {
            onDelete(deleteDialog.item.id);
          }
          setDeleteDialog({ isOpen: false, item: null });
        }}
      />
    </Container>
  );
}
