import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, Save, Check, X } from 'lucide-react';
import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const Container = styled.div`
  padding: 2.5rem;
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-radius: 28px;
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-xl);
  animation: entrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: 'Plus Jakarta Sans', sans-serif;

  @keyframes entrance {
    from { opacity: 0; transform: scale(0.98) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
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

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.1);
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: var(--shadow-md);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.12);
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 60px;
    height: 60px;
    background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.03), transparent 70%);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const CompanyName = styled.h4`
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-main);
  font-weight: 700;
  line-height: 1.2;
`;

const CycleBadge = styled.span`
  display: inline-block;
  background: rgba(167, 139, 250, 0.15);
  color: var(--violet);
  border: 1px solid rgba(167, 139, 250, 0.3);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const CardFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--glass-border);
`;

const InputGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const Input = styled.input`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  color: var(--text-main);
  width: 100%;
  font-family: inherit;
  font-size: 0.9rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:focus {
    outline: none;
    border-color: var(--brand);
    background: rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 15px rgba(249, 115, 22, 0.1);
  }
  
  &::placeholder {
    color: var(--text-muted);
    opacity: 0.4;
  }
`;

const NotificationToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
  width: fit-content;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  span {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  input {
    width: 14px;
    height: 14px;
    accent-color: var(--brand);
  }
`;

const Button = styled.button`
  background: ${props => props.$color || 'var(--brand)'};
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0.85rem 1.25rem;
  cursor: pointer;
  font-weight: 800;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  width: 100%;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 12px ${props => (props.$color || 'var(--brand)')}33;

  &:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 12px 24px ${props => (props.$color || 'var(--brand)')}55;
    filter: brightness(1.1);
  }

  &:active:not(:disabled) {
    transform: translateY(-1px) scale(0.98);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    filter: grayscale(1);
  }
`;

const getAgentColor = (name) => {
  const colors = [
    '#f97316', // Orange
    '#0ea5e9', // Sky
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#6366f1', // Indigo
    '#ef4444', // Red
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const AgentGroup = styled.div`
  margin-bottom: 1.5rem;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const AgentHeader = styled.div`
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-bottom: ${props => props.$isOpen ? '1px solid var(--glass-border)' : 'none'};

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`;

const AgentName = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const Badge = styled.span`
  background: var(--brand);
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
`;


const normalizeWeekLabel = (label) => {
  const raw = String(label || '').trim().toLowerCase();
  if (!raw) return 'unspecified';
  const numbers = raw.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    return `W-${numbers[0]}-${numbers[1]}`;
  }
  return raw.replace(/[^a-z0-9]/g, '');
};

export default function InvoiceEntry({ clientsByAgent, existingData, onSaveInvoice }) {
  const [week, setWeek] = useState(() => {
    // Basic week string generation for UI default
    const now = new Date();
    const start = new Date(now.setDate(now.getDate() - now.getDay() + 1));
    const end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} - ${end.getDate()}`;
  });

  const expectedSlots = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDueDate = tomorrow.toISOString().split('T')[0];

    const slots = [];
    clientsByAgent.forEach(client => {
      const cycle = normalizeBillingCycle(client.billingCycle);
      const company = client.company;
      const agentId = client.agentId;
      
      const createSlot = (suffix = '', customLabel = '') => {
        const slotId = `EXPECTED-${company}-${week}${suffix}`.replace(/[^a-zA-Z0-9-]/g, '');
        // Check if we already have an invoice for this in existingData
        const existing = existingData.find(d => 
          String(d.company || '').toLowerCase() === String(company || '').toLowerCase() && 
          (normalizeWeekLabel(d.weekLabel) === normalizeWeekLabel(week) || (d.id && d.id.includes(slotId)))
        );

        if (!existing || existing.status === 'no_invoice') {
          slots.push({
            id: slotId,
            company,
            agentId,
            cycle,
            weekLabel: week,
            invoiceNumber: existing?.invoiceNumber || '',
            amount: existing?.amount || '',
            dueDate: existing?.dueDate || defaultDueDate,
            customLabel
          });
        }
      };

      if (cycle === BILLING_CYCLES.TWICE) {
        createSlot('-1', 'Monday Invoice (Due Tue)');
        createSlot('-2', 'Thursday Invoice (Due Fri)');
      } else if (cycle !== BILLING_CYCLES.UNSPECIFIED && cycle !== 'CS by agent') {
        const singleLabel = cycle === BILLING_CYCLES.MONDAY_SUNDAY 
          ? 'Monday Invoice (Due Tue)' 
          : (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY ? 'Thursday Invoice (Due Fri)' : '');
        createSlot('', singleLabel);
      }
    });
    return slots;
  }, [clientsByAgent, existingData, week]);

  const groupedSlots = useMemo(() => {
    const groups = {};
    expectedSlots.forEach(slot => {
      const agent = slot.agentId || 'Unassigned';
      if (!groups[agent]) groups[agent] = [];
      groups[agent].push(slot);
    });
    // Sort agents alphabetically
    return Object.keys(groups).sort().map(agent => ({
      agent,
      slots: groups[agent]
    }));
  }, [expectedSlots]);

  const [entries, setEntries] = useState({});
  const [expandedAgents, setExpandedAgents] = useState({});

  const toggleAgent = (agent) => {
    setExpandedAgents(prev => ({
      ...prev,
      [agent]: !prev[agent]
    }));
  };

  const handleEntryChange = (id, field, value) => {
    setEntries(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || expectedSlots.find(s => s.id === id)),
        [field]: value
      }
    }));
  };

  const [notifications, setNotifications] = useState({});

  const toggleNotification = (id) => {
    setNotifications(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSave = (id) => {
    const entry = entries[id];
    const sendEmail = notifications[id] ?? true; // Default to true
    if (!entry || !entry.invoiceNumber || !entry.amount || !entry.dueDate) return;

    onSaveInvoice({
      ...entry,
      status: 'pending',
      source: 'manual_entry',
      dueDate: entry.dueDate,
      id: `MAN-${Date.now()}-${id}`,
      sendNotification: sendEmail
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
      
      {expectedSlots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          All caught up for this week!
        </div>
      ) : (
        groupedSlots.map(group => {
          const agentColor = getAgentColor(group.agent);
          return (
            <AgentGroup key={group.agent} style={{ borderColor: `${agentColor}33` }}>
              <AgentHeader 
                $isOpen={expandedAgents[group.agent]} 
                onClick={() => toggleAgent(group.agent)}
                style={{ borderLeft: `4px solid ${agentColor}` }}
              >
                <AgentName>
                  {group.agent}
                  <Badge style={{ background: agentColor }}>{group.slots.length}</Badge>
                </AgentName>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {expandedAgents[group.agent] ? 'Hide' : 'Show'} Clients
                </span>
              </AgentHeader>
              
              {expandedAgents[group.agent] && (
                <GridContainer>
                  {group.slots.map(slot => {
                    const entry = entries[slot.id] || slot;
                    const isReady = entry.invoiceNumber && entry.amount && entry.dueDate;
                    return (
                      <Card key={slot.id} style={{ borderColor: `${agentColor}44` }}>
                        <CardHeader>
                          <CompanyName>{slot.company}</CompanyName>
                        </CardHeader>
                        
                        <div>
                          <CycleBadge style={{ background: `${agentColor}22`, color: agentColor, borderColor: `${agentColor}44` }}>
                            {slot.cycle}
                          </CycleBadge>
                          {slot.customLabel && (
                            <div style={{ fontSize: '0.75rem', color: agentColor, marginTop: '0.5rem', fontWeight: '600', opacity: 0.9 }}>
                              {slot.customLabel}
                            </div>
                          )}
                        </div>

                        <CardFooter style={{ borderTopColor: `${agentColor}22` }}>
                          <InputGroup>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '0.35rem', fontWeight: 800, textTransform: 'uppercase' }}>Invoice Number</div>
                              <Input 
                                placeholder="#" 
                                value={entry.invoiceNumber}
                                onChange={e => handleEntryChange(slot.id, 'invoiceNumber', e.target.value)}
                                onFocus={(e) => e.target.style.borderColor = agentColor}
                                onBlur={(e) => e.target.style.borderColor = ''}
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '0.35rem', fontWeight: 800, textTransform: 'uppercase' }}>Amount ($)</div>
                              <Input 
                                type="number"
                                placeholder="0.00" 
                                value={entry.amount}
                                onChange={e => handleEntryChange(slot.id, 'amount', e.target.value)}
                                onFocus={(e) => e.target.style.borderColor = agentColor}
                                onBlur={(e) => e.target.style.borderColor = ''}
                              />
                            </div>
                          </InputGroup>
                          
                          <div style={{ marginTop: '0.25rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: '0.35rem', fontWeight: 800, textTransform: 'uppercase' }}>Due Date</div>
                            <Input 
                              type="date"
                              value={entry.dueDate || ''}
                              onChange={e => handleEntryChange(slot.id, 'dueDate', e.target.value)}
                              onFocus={(e) => e.target.style.borderColor = agentColor}
                              onBlur={(e) => e.target.style.borderColor = ''}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                            <NotificationToggle>
                              <input 
                                type="checkbox" 
                                checked={notifications[slot.id] ?? true} 
                                onChange={() => toggleNotification(slot.id)}
                              />
                              <span>Notify Client</span>
                            </NotificationToggle>

                            {slot.email && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                                to: {slot.email}
                              </div>
                            )}
                          </div>

                          <Button 
                            $color={agentColor}
                            disabled={!isReady}
                            onClick={() => handleSave(slot.id)}
                          >
                            <Save size={16} /> Save & Send
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </GridContainer>
              )}
            </AgentGroup>
          );
        })
      )}
    </Container>
  );
}
