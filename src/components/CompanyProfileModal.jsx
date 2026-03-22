import React from 'react';
import styled from 'styled-components';
import { X, Building2, Users, FileText, AlertTriangle, Edit2 } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1.5rem;
  animation: fadeIn 0.3s ease-out;
`;

const Panel = styled.div`
  width: min(1000px, 100%);
  max-height: 90vh;
  overflow: auto;
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8), 0 0 40px rgba(249, 115, 22, 0.05);
  animation: modalScaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  @keyframes modalScaleUp {
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
`;

const Header = styled.div`
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
`;

const Body = styled.div`
  padding: 1rem 1.25rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
  margin-bottom: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1rem;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--brand);
    transform: translateY(-2px);
  }

  span {
    color: var(--text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  strong {
    display: block;
    margin-top: 0.4rem;
    font-size: 1.15rem;
    font-weight: 800;
    font-family: 'Montserrat', sans-serif;
  }
`;

const ChipsRow = styled.div`
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  margin-bottom: 0.9rem;
`;

const Chip = styled.span`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-main);
  border-radius: 999px;
  padding: 0.3rem 0.8rem;
  font-size: 0.74rem;
  font-weight: 600;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    text-align: left;
    padding: 0.55rem;
    font-size: 0.82rem;
  }

  th {
    color: var(--text-muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.68rem;
  }
`;

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(value || 0);

const getStatusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return { label: 'Paid', color: 'var(--ok)' };
  if (s === 'overdue') return { label: 'Overdue', color: 'var(--danger)' };
  return { label: 'Pending', color: 'var(--warn)' };
};

export default function CompanyProfileModal({ isOpen, onClose, profile, onEditInvoice }) {
  if (!isOpen || !profile) return null;

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title><Building2 size={18} /> Company Technical Profile</Title>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '0.35rem' }}>
            <X size={16} />
          </button>
        </Header>

        <Body>
          <h4 style={{ marginBottom: '0.65rem' }}>{profile.company}</h4>

          <Grid>
            <StatCard>
              <span>Total Active Debt</span>
              <strong>{formatCurrency(profile.totalDebt)}</strong>
            </StatCard>
            <StatCard>
              <span>Total Overdue</span>
              <strong style={{ color: 'var(--danger)' }}>{formatCurrency(profile.totalOverdue)}</strong>
            </StatCard>
            <StatCard>
              <span>Invoices</span>
              <strong>{profile.invoiceCount}</strong>
            </StatCard>
            <StatCard>
              <span>Unique Agents</span>
              <strong>{profile.agents.length}</strong>
            </StatCard>
          </Grid>

          <div style={{ marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={14} /> Agents
          </div>
          <ChipsRow>
            {profile.agents.map((agent) => <Chip key={agent}>{agent}</Chip>)}
          </ChipsRow>

          {profile.contacts.length > 0 && (
            <>
              <div style={{ marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={14} /> Contact Persons
              </div>
              <ChipsRow>
                {profile.contacts.map((contact) => <Chip key={contact}>{contact}</Chip>)}
              </ChipsRow>
            </>
          )}

          <div style={{ marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={14} /> Invoice Breakdown
          </div>

          <Table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Cycle</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {profile.invoices.length > 0 ? profile.invoices.map((item) => {
                const tone = getStatusTone(item.status);
                return (
                  <tr key={item.id}>
                    <td>{item.invoiceNumber || '-'}</td>
                    <td>{item.billingCycle || '-'}</td>
                    <td style={{ color: tone.color, fontWeight: 700 }}>{tone.label}</td>
                    <td>{formatCurrency(item.amount)}</td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem', minWidth: 'auto' }}
                        onClick={() => onEditInvoice(item)}
                        title="Edit this invoice"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No invoice detail available for this company.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Body>
      </Panel>
    </Overlay>
  );
}
