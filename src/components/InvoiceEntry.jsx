import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, Save, Check, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
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

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.1);
`;

const Card = styled.div`
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
    border-color: rgba(255, 255, 255, 0.15);
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
  border-radius: var(--radius-md);
  padding: 0.5rem 0.75rem;
  color: var(--text-main);
  width: 100%;

  &:focus {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
  }
  
  &::placeholder {
    color: var(--text-muted);
    opacity: 0.5;
  }
`;

const Button = styled.button`
  background: ${props => props.$color || 'var(--brand)'};
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  transition: all 0.2s;

  &:hover {
    filter: brightness(1.2);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

// Helper to compute actual due date string based on rules and the week label start date
const calculateDueDate = (weekLabel, cycle, isSecondInvoice = false) => {
  // Regex to parse things like "Mar 16 - 22" or "Feb 10-16"
  const match = String(weekLabel || '').match(/^([A-Za-z]+)\s+(\d+)\s*[-\s]*(\d+)$/);
  if (!match) return '';
  const [, monthName, startDay] = match;
  const currentYear = new Date().getFullYear();
  const weekStart = new Date(`${monthName} ${startDay}, ${currentYear}`);
  if (Number.isNaN(weekStart.getTime())) return '';

  const getNextWeekday = (date, targetWeekday) => {
    for (let i = 0; i < 10; i++) {
      const current = new Date(date);
      current.setDate(date.getDate() + i);
      if (current.getDay() === targetWeekday) return current;
    }
    return null;
  };

  const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Option A (Monday -> Sunday) or First Invoice of Twice: Due Tuesday
  if (cycle === BILLING_CYCLES.MONDAY_SUNDAY || (cycle === BILLING_CYCLES.TWICE && !isSecondInvoice)) {
    const nextTuesday = getNextWeekday(weekStart, 2);
    if (nextTuesday) {
      if (Math.floor((nextTuesday - weekStart) / (1000 * 60 * 60 * 24)) < 7) {
        nextTuesday.setDate(nextTuesday.getDate() + 7);
      }
      return toDateKey(nextTuesday);
    }
  }

  // Option B (Thursday -> Wednesday) or Second Invoice of Twice: Due Friday
  if (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY || (cycle === BILLING_CYCLES.TWICE && isSecondInvoice)) {
    const nextFriday = getNextWeekday(weekStart, 5);
    if (nextFriday) {
      if (Math.floor((nextFriday - weekStart) / (1000 * 60 * 60 * 24)) < 7) {
        nextFriday.setDate(nextFriday.getDate() + 7);
      }
      return toDateKey(nextFriday);
    }
  }

  return '';
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
            amount: existing?.amount || '',
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

  const handleSave = (id) => {
    const entry = entries[id];
    if (!entry || !entry.invoiceNumber || !entry.amount) return;

    // Determine if it is the second invoice of a 'Twice' cycle based on slot suffix
    const isSecondInvoice = id.endsWith('-2');
    const computedDueDate = calculateDueDate(entry.weekLabel, entry.cycle, isSecondInvoice);

    onSaveInvoice({
      ...entry,
      status: 'pending',
      source: 'manual_entry',
      dueDate: computedDueDate,
      id: `MAN-${Date.now()}-${entry.company.replace(/[^a-zA-Z0-9]/g, '')}`
    });
    
    // Clear from local entries so it disappears from 'missing' list
    setEntries(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        if (!Array.isArray(jsonData)) {
          toast.error('Invalid JSON format. Expected an array of invoices.');
          return;
        }

        let matchCount = 0;
        const newEntries = { ...entries };

        jsonData.forEach(item => {
          if (!item.invoice_id || !item.amount) return;
          
          // Normalize string to match (remove spaces, symbols)
          const normalizeString = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
          
          const matchingSlot = expectedSlots.find(slot => 
            normalizeString(slot.company) === normalizeString(item.client_name)
          );

          if (matchingSlot) {
            newEntries[matchingSlot.id] = {
              ...(newEntries[matchingSlot.id] || matchingSlot),
              invoiceNumber: item.invoice_id,
              amount: item.amount
            };
            matchCount++;
            
            // Auto-expand the agent group
            if (matchingSlot.agent) {
                setExpandedAgents(prev => ({ ...prev, [matchingSlot.agent]: true }));
            }
          }
        });

        setEntries(newEntries);
        toast.success(`Successfully imported ${matchCount} invoices from CMP!`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse JSON file.');
      }
      
      // Reset input
      e.target.value = null;
    };
    reader.readAsText(file);
  };

  return (
    <Container>
      <Header>
        <Title>Weekly Invoice Entry</Title>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--violet)', color: 'var(--violet)', padding: '0.65rem 1rem', borderRadius: '12px', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s' }}>
              <Upload size={16} />
              Import CMP JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
            <Input 
              value={week} 
              onChange={e => setWeek(e.target.value)} 
              style={{ width: '200px' }} 
              placeholder="Week Label (e.g. Mar 16 - 22)"
            />
        </div>
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
                    const isReady = entry.invoiceNumber && entry.amount;
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
                            <Input 
                              placeholder="Invoice #" 
                              value={entry.invoiceNumber}
                              onChange={e => handleEntryChange(slot.id, 'invoiceNumber', e.target.value)}
                              onFocus={(e) => e.target.style.borderColor = agentColor}
                              onBlur={(e) => e.target.style.borderColor = ''}
                            />
                            <Input 
                              type="number"
                              placeholder="Amount ($)" 
                              value={entry.amount}
                              onChange={e => handleEntryChange(slot.id, 'amount', e.target.value)}
                              onFocus={(e) => e.target.style.borderColor = agentColor}
                              onBlur={(e) => e.target.style.borderColor = ''}
                            />
                          </InputGroup>
                          <Button 
                            $color={agentColor}
                            disabled={!isReady}
                            onClick={() => handleSave(slot.id)}
                          >
                            <Save size={16} /> Save Invoice
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
