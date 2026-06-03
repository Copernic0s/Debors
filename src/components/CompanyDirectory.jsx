import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { formatMoney } from '../utils/moneyUtils';

const Container = styled.div`
  padding: 1.5rem;
  margin-top: 1.5rem;
  animation: fadeIn 0.6s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.03);
  background: rgba(8, 18, 34, 0.35);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border-radius: 24px;
  box-shadow: 
    0 20px 40px -12px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.02) inset;

  @media (max-width: 768px) {
    padding: 1.25rem;
    margin-top: 1rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SearchContainer = styled.div`
  position: relative;
  flex: 1;
  max-width: 320px;

  @media (max-width: 768px) {
    max-width: 100%;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(180, 223, 255, 0.1);
  border-radius: 12px;
  color: var(--text-main);
  font-size: 0.9rem;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: var(--brand);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
  }

  &::placeholder {
    color: var(--text-muted);
  }
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  width: 18px;
  height: 18px;
`;

const TableContainer = styled.div`
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
  
  &::-webkit-scrollbar {
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
`;

const Th = styled.th`
  text-align: left;
  padding: 1.1rem 1.25rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-main);
  }

  display: table-cell;
`;

const Td = styled.td`
  padding: 1.1rem 1.25rem;
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  color: var(--text-main);
`;

const Tr = styled.tr`
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &:last-child ${Td} {
    border-bottom: none;
  }
`;

const StatusBadge = styled.span`
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  ${({ $status }) => {
    switch ($status) {
      case 'paid':
        return `
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.1);
        `;
      case 'overdue':
        return `
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
        `;
      case 'partial_payment':
        return `
          background: rgba(234, 179, 8, 0.15);
          color: #fde047;
          border: 1px solid rgba(234, 179, 8, 0.3);
          box-shadow: 0 0 10px rgba(234, 179, 8, 0.1);
        `;
      case 'pending':
      default:
        return `
          background: rgba(56, 189, 248, 0.15);
          color: #7dd3fc;
          border: 1px solid rgba(56, 189, 248, 0.3);
        `;
    }
  }}
`;

const CompanyName = styled.div`
  font-weight: 600;
  color: var(--brand-ice);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const formatStatus = (status) => {
  switch (status) {
    case 'paid': return 'Paid';
    case 'overdue': return 'Overdue';
    case 'partial_payment': return 'Partial Payment';
    case 'pending': return 'Pending';
    default: return 'Pending';
  }
};

const CompanyDirectory = ({ data, onOpenCompanyProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'company', direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = useMemo(() => {
    let result = [...data];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          String(item.company || '').toLowerCase().includes(lowerTerm) ||
          String(item.agentId || '').toLowerCase().includes(lowerTerm)
      );
    }

    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'amount' || sortConfig.key === 'totalInvoiced' || sortConfig.key === 'totalPaid') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortConfig.key === 'overallStatus') {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortConfig]);

  return (
    <Container>
      <Header>
        <Title>
          <FileText size={20} color="var(--brand)" />
          Companies Directory
        </Title>
        <SearchContainer>
          <SearchIcon />
          <SearchInput
            placeholder="Search companies or agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchContainer>
      </Header>

      <TableContainer>
        <Table>
          <thead>
            <tr>
              <Th onClick={() => handleSort('company')}>
                Company {sortConfig.key === 'company' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline' }} /> : <ChevronDown size={14} style={{ display: 'inline' }} />)}
              </Th>
              <Th onClick={() => handleSort('agentId')}>
                Assigned Agent {sortConfig.key === 'agentId' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline' }} /> : <ChevronDown size={14} style={{ display: 'inline' }} />)}
              </Th>
              <Th onClick={() => handleSort('overallStatus')}>
                Overall Status {sortConfig.key === 'overallStatus' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline' }} /> : <ChevronDown size={14} style={{ display: 'inline' }} />)}
              </Th>
              <Th onClick={() => handleSort('totalInvoiced')}>
                Total Invoiced {sortConfig.key === 'totalInvoiced' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline' }} /> : <ChevronDown size={14} style={{ display: 'inline' }} />)}
              </Th>
              <Th onClick={() => handleSort('totalPaid')}>
                Total Paid {sortConfig.key === 'totalPaid' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline' }} /> : <ChevronDown size={14} style={{ display: 'inline' }} />)}
              </Th>
              <Th onClick={() => handleSort('amount')}>
                Total Due {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} style={{ display: 'inline' }} /> : <ChevronDown size={14} style={{ display: 'inline' }} />)}
              </Th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length > 0 ? (
              sortedData.map((item) => (
                <Tr key={item.id} onClick={() => onOpenCompanyProfile && onOpenCompanyProfile(item.company)}>
                  <Td>
                    <CompanyName>{item.company}</CompanyName>
                  </Td>
                  <Td>{item.agentId}</Td>
                  <Td>
                    <StatusBadge $status={item.overallStatus}>
                      {formatStatus(item.overallStatus)}
                    </StatusBadge>
                  </Td>
                  <Td>{formatMoney(item.totalInvoiced)}</Td>
                  <Td>{formatMoney(item.totalPaid)}</Td>
                  <Td style={{ fontWeight: 700, color: item.amount > 0 ? '#f87171' : 'var(--text-main)' }}>
                    {formatMoney(item.amount)}
                  </Td>
                </Tr>
              ))
            ) : (
              <tr>
                <Td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No companies found matching your criteria.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default CompanyDirectory;
