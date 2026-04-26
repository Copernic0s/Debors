import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, Save, Check, X } from 'lucide-react';
import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const Container = styled.div`
  padding: 2rem;
  animation: fadeIn 0.6s ease-out;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-lg);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: 1rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-color);
  text-align: left;
`;

const Td = styled.td`
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
`;

const Input = styled.input`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  color: var(--text-main);
  width: 120px;

  &:focus {
    outline: none;
    border-color: var(--brand);
  }
`;

const Button = styled.button`
  background: var(--brand);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: var(--brand-deep);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export default function InvoiceEntry({ clientsByAgent, existingData, onSaveInvoice }) {
  const [week, setWeek] = useState(() => {
    // Basic week string generation for UI default
    const now = new Date();
    const start = new Date(now.setDate(now.getDate() - now.getDay() + 1));
    const end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} - ${end.getDate()}`;
  });

  const expectedSlots = useMemo(() => {
    const slots = [];
    clientsByAgent.forEach(client => {
      const cycle = normalizeBillingCycle(client.billingCycle);
      const company = client.company;
      const agentId = client.agentId;
      
      const createSlot = (suffix = '') => {
        const slotId = `EXPECTED-${company}-${week}${suffix}`.replace(/[^a-zA-Z0-9-]/g, '');
        // Check if we already have an invoice for this in existingData
        const existing = existingData.find(d => 
          d.company.toLowerCase() === company.toLowerCase() && 
          (d.weekLabel === week || (d.id && d.id.includes(slotId)))
        );

        if (!existing || existing.status === 'no_invoice') {
          slots.push({
            id: slotId,
            company,
            agentId,
            cycle,
            weekLabel: week,
            invoiceNumber: existing?.invoiceNumber || '',
            amount: existing?.amount || ''
          });
        }
      };

      if (cycle === BILLING_CYCLES.TWICE) {
        createSlot('-1');
        createSlot('-2');
      } else if (cycle !== BILLING_CYCLES.UNSPECIFIED && cycle !== 'CS by agent') {
        createSlot('');
      }
    });
    return slots;
  }, [clientsByAgent, existingData, week]);

  const [entries, setEntries] = useState({});

  const handleEntryChange = (id, field, value) => {
    setEntries(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || expectedSlots.find(s => s.id === id)),
        [field]: value
      }
    }));
  };

  const handleSave = (id) => {
    const entry = entries[id];
    if (!entry || !entry.invoiceNumber || !entry.amount) return;

    onSaveInvoice({
      ...entry,
      status: 'pending',
      source: 'manual_entry',
      id: `MAN-${Date.now()}-${entry.company.replace(/[^a-zA-Z0-9]/g, '')}`
    });
    
    // Clear from local entries so it disappears from 'missing' list
    setEntries(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });
  };

  return (
    <Container>
      <Header>
        <Title>Weekly Invoice Entry</Title>
        <Input 
          value={week} 
          onChange={e => setWeek(e.target.value)} 
          style={{ width: '200px' }} 
          placeholder="Week Label (e.g. Mar 16 - 22)"
        />
      </Header>
      
      <Table>
        <thead>
          <tr>
            <Th>Company</Th>
            <Th>Agent</Th>
            <Th>Cycle</Th>
            <Th>Invoice #</Th>
            <Th>Amount ($)</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {expectedSlots.length === 0 ? (
            <tr><Td colSpan={6} style={{textAlign: 'center'}}>All caught up for this week!</Td></tr>
          ) : (
            expectedSlots.map(slot => {
              const entry = entries[slot.id] || slot;
              const isReady = entry.invoiceNumber && entry.amount;
              return (
                <tr key={slot.id}>
                  <Td><strong>{slot.company}</strong></Td>
                  <Td>{slot.agentId}</Td>
                  <Td>{slot.cycle}</Td>
                  <Td>
                    <Input 
                      placeholder="INV-..." 
                      value={entry.invoiceNumber}
                      onChange={e => handleEntryChange(slot.id, 'invoiceNumber', e.target.value)}
                    />
                  </Td>
                  <Td>
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      value={entry.amount}
                      onChange={e => handleEntryChange(slot.id, 'amount', e.target.value)}
                    />
                  </Td>
                  <Td>
                    <Button 
                      disabled={!isReady}
                      onClick={() => handleSave(slot.id)}
                    >
                      <Save size={16} /> Save
                    </Button>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </Table>
    </Container>
  );
}
