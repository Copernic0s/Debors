import React, { useState } from 'react';
import styled from 'styled-components';
import { Search, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

const Container = styled.div`
  padding: 1.5rem;
  margin-top: 2rem;
  animation: fadeIn 0.6s ease-out;
  border-radius: var(--radius-xl);
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
`;

const SearchInput = styled.div`
  position: relative;
  
  input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.6rem 1rem 0.6rem 2.5rem;
    color: var(--text-main);
    font-family: 'Manrope', inherit;
    font-size: 0.875rem;
    width: 250px;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
  }

  svg {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
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
`;

const Td = styled.td`
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--text-main);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  vertical-align: middle;
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

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const getComputedStatus = (item) => {
  const rawStatus = String(item.status ?? '').toLowerCase();
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

const getStatusBadge = (status) => {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'pagado':
      return <span className="status-badge status-paid">Paid</span>;
    case 'pending':
    case 'pendiente':
      return <span className="status-badge status-pending">Pending</span>;
    case 'overdue':
    case 'mora':
      return <span className="status-badge status-overdue">Overdue</span>;
    default:
      return <span className="status-badge status-pending">{status}</span>;
  }
};

export default function DebtorsList({ data, onEdit, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'company', direction: 'asc' });
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, item: null });

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
              onChange={(e) => setSearchTerm(e.target.value)}
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
              <Th onClick={() => handleSort('amount')}>Total Due ($) {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? filteredData.map((item) => (
              <Tr key={item.id}>
                <Td style={{ fontWeight: 600 }}>{item.company || item.clientName || 'Unassigned Company'}</Td>
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
                <Td>{item.billingCycle || item.dueDate || 'No cycle'}</Td>
                <Td>{getStatusBadge(getComputedStatus(item))}</Td>
                <Td>{formatCurrency(item.amount)}</Td>
                <Td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => onEdit(item)}
                      style={{ padding: '0.4rem', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface-2)' }}
                      title="Edit"
                    >
                      <Edit2 size={14} color="var(--brand)" />
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setDeleteDialog({ isOpen: true, item })}
                      style={{ padding: '0.4rem', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--surface-2)' }}
                      title="Delete"
                    >
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </div>
                </Td>
              </Tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrapper>

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
