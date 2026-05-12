import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, Save, Check, X, Upload, Terminal, Play } from 'lucide-react';
import toast from 'react-hot-toast';
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

const TerminalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const TerminalWindow = styled.div`
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  font-family: 'Fira Code', 'Courier New', monospace;
`;

const TerminalHeader = styled.div`
  background: #1e293b;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #334155;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
`;

const TerminalBody = styled.div`
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  color: #22c55e;
  font-size: 0.85rem;
  line-height: 1.5;
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

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [botRunning, setBotRunning] = useState(false);
  const terminalEndRef = React.useRef(null);

  React.useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const handleSave = (id) => {
    const entry = entries[id];
    if (!entry || !entry.invoiceNumber || !entry.amount || !entry.dueDate) return;

    onSaveInvoice({
      ...entry,
      status: 'pending',
      source: 'manual_entry',
      dueDate: entry.dueDate,
      id: `MAN-${Date.now()}-${id}`,
      sendNotification: false
    });
    
    // Clear from local entries so it disappears from 'missing' list
    setEntries(prev => {
      const next = {...prev};
      delete next[id];
      return next;
    });
  };

  const runScraperBot = () => {
    setTerminalOpen(true);
    setTerminalLogs(['> Initializing connection to local bot server...']);
    setBotRunning(true);

    const source = new EventSource('/api/run-cmp-bot');

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.message) {
        setTerminalLogs(prev => [...prev, `> ${data.message}`]);
      }
      
      if (data.error) {
        setTerminalLogs(prev => [...prev, `[ERROR] ${data.error}`]);
        source.close();
        setBotRunning(false);
      }

      if (data.done) {
        setTerminalLogs(prev => [...prev, '> Bot execution finished. Fetching results...']);
        source.close();
        fetchAndApplyResults();
      }
    };

    source.onerror = (err) => {
      console.error('SSE Error:', err);
      setTerminalLogs(prev => [...prev, '[ERROR] Connection to bot server failed. Ensure server.js is running.']);
      source.close();
      setBotRunning(false);
    };
  };

  const processJsonData = (jsonData) => {
    if (!Array.isArray(jsonData)) {
      toast.error('Invalid JSON format. Expected an array of invoices.');
      return;
    }

    let matchCount = 0;
    const newEntries = { ...entries };
    const validMatches = []; // To save automatically

    jsonData.forEach(item => {
      if (!item.invoice_id || !item.amount) return;
      
      // Filter out already PAID invoices (no need to track them if they are paid on CMP)
      if (String(item.invoice_status).trim().toUpperCase() === 'PAID') return;
      
      // 1. Protection against stale invoices (older than 14 days)
      if (item.date) {
        const invoiceDate = new Date(item.date);
        const today = new Date();
        const diffDays = Math.ceil(Math.abs(today - invoiceDate) / (1000 * 60 * 60 * 24)); 
        if (diffDays > 14) return; // Skip old invoices
      }

      // 2. Protection against duplicate invoices (already saved in Zoho)
      const existingRecord = existingData.find(d => String(d.invoiceNumber).trim() === String(item.invoice_id).trim());
      if (existingRecord) {
         let needsUpdate = false;
         const updatedRecord = { ...existingRecord };
         
         // Fix unspecified billing cycle
         if (item.billing_cycle && String(item.billing_cycle).trim() !== '' && (!existingRecord.billingCycle || existingRecord.billingCycle === 'Unspecified' || existingRecord.billingCycle === 'unspecified')) {
             updatedRecord.billingCycle = item.billing_cycle;
             needsUpdate = true;
         }
         
         // Fix due date
         if (item.due_date && String(item.due_date).trim() !== '' && item.due_date !== 'None' && existingRecord.dueDate !== item.due_date) {
             updatedRecord.dueDate = item.due_date;
             needsUpdate = true;
         }

         if (needsUpdate) {
             onSaveInvoice({
                ...updatedRecord,
                source: 'bot_update',
                sendNotification: false
             });
         }
         return; // Skip the rest of the flow since it's already an existing invoice
      }

      // Normalize string to match (remove spaces, symbols, and common suffixes)
      const normalizeString = (str) => {
        let cleaned = String(str).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        cleaned = cleaned.replace(/\b(llc|inc|corp|co|ltd|limited)\b/g, '');
        return cleaned.replace(/\s+/g, ''); // strip all spaces at the end
      };
      
      // Find the first slot for this company that hasn't been filled yet
      const matchingSlot = expectedSlots.find(slot => {
        const isCompanyMatch = normalizeString(slot.company) === normalizeString(item.client_name);
        const isSlotEmpty = !newEntries[slot.id] || !newEntries[slot.id].invoiceNumber;
        return isCompanyMatch && isSlotEmpty;
      });

      if (matchingSlot) {
        const updatedEntry = {
          ...(newEntries[matchingSlot.id] || matchingSlot),
          invoiceNumber: item.invoice_id,
          amount: item.amount
        };
        
        // Correct the billing cycle if the bot found one
        if (item.billing_cycle && String(item.billing_cycle).trim() !== '') {
           updatedEntry.billingCycle = item.billing_cycle;
           updatedEntry.cycle = item.billing_cycle; // Update UI slot too
        }

        // Correct the due date if the bot found one
        if (item.due_date && String(item.due_date).trim() !== '' && item.due_date !== 'None') {
           updatedEntry.dueDate = item.due_date;
        }

        newEntries[matchingSlot.id] = updatedEntry;
        validMatches.push({ id: matchingSlot.id, entry: updatedEntry });
        matchCount++;
        
        // Auto-expand the agent group
        if (matchingSlot.agentId) {
            setExpandedAgents(prev => ({ ...prev, [matchingSlot.agentId]: true }));
        }
      } else {
        // If no empty slot is available, find ANY existing record for this company to clone their base data
        const baseRecord = existingData.find(d => normalizeString(d.company || d.clientName) === normalizeString(item.client_name));
        
        if (baseRecord) {
           const newId = `BOT-NEW-${Date.now()}-${Math.random().toString(36).substring(7)}`;
           const newEntry = {
              ...baseRecord,
              id: newId,
              invoiceNumber: item.invoice_id,
              amount: item.amount,
              status: 'pending',
              source: 'bot_extraction'
           };
           
           if (item.billing_cycle && String(item.billing_cycle).trim() !== '') {
               newEntry.billingCycle = item.billing_cycle;
               newEntry.cycle = item.billing_cycle;
           }
           
           if (item.due_date && String(item.due_date).trim() !== '' && item.due_date !== 'None') {
               newEntry.dueDate = item.due_date;
           }
           
           newEntries[newId] = newEntry;
           validMatches.push({ id: newId, entry: newEntry });
           matchCount++;
        }
      }
    });

    setEntries(newEntries);
    
    // Auto-Save all matched entries
    if (matchCount > 0) {
       toast.success(`Successfully extracted ${matchCount} new pending invoices! Auto-saving...`);
       validMatches.forEach(({ id, entry }) => {
         onSaveInvoice({
            ...entry,
            status: 'pending',
            source: 'bot_extraction',
            dueDate: entry.dueDate,
            id: `BOT-${Date.now()}-${id}`,
            sendNotification: false
         });
       });
       
       // Clear them from local entries since they are saved
       setEntries(prev => {
         const next = {...prev};
         validMatches.forEach(({ id }) => delete next[id]);
         return next;
       });
       
       toast.success(`All ${matchCount} invoices pushed to Zoho!`);
    } else {
       toast('Bot finished, but no new pending invoices found.', { icon: 'ℹ️' });
    }
    
    // --- Deductive PAID Logic ---
    let autoPaidCount = 0;
    
    existingData.forEach(d => {
       const currentStatus = String(d.status || '').trim().toLowerCase();
       const invoiceNum = String(d.invoiceNumber || '').trim();
       
       if (currentStatus === 'pending' && invoiceNum && invoiceNum !== 'Marked as Sent') {
          // Check if this invoice is still in the bot's pending list
          const isStillPending = jsonData.some(item => 
              String(item.invoice_id).trim() === invoiceNum
          );
          
          if (!isStillPending) {
             // It's no longer pending on CMP! Auto-mark as paid.
             autoPaidCount++;
             onSaveInvoice({
                ...d,
                status: 'paid',
                amount: 0,
                source: 'bot_deduction',
                sendNotification: false
             });
          }
       }
    });
    
    if (autoPaidCount > 0) {
       setTimeout(() => {
          toast.success(`Auto-marked ${autoPaidCount} older invoices as PAID based on CMP data!`, { duration: 5000 });
       }, 1500);
    }
    // ----------------------------
  };

  const fetchAndApplyResults = () => {
     fetch('/api/cmp-results')
       .then(res => res.json())
       .then(data => {
          setTerminalLogs(prev => [...prev, `> Results fetched! Applying...`]);
          setTimeout(() => {
             setTerminalOpen(false);
             setBotRunning(false);
             processJsonData(data);
          }, 1000);
       })
       .catch(err => {
          setTerminalLogs(prev => [...prev, `[ERROR] Failed to fetch results JSON: ${err.message}`]);
          setBotRunning(false);
       });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        processJsonData(jsonData);
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
            <Button onClick={runScraperBot} disabled={botRunning} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', width: 'auto', padding: '0.65rem 1.25rem', borderRadius: '12px' }}>
              <Terminal size={16} /> Run Auto-Scraper
            </Button>
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
                          
                            {slot.email && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                                Associated Email: {slot.email}
                              </div>
                            )}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                            <button 
                              type="button"
                              style={{ 
                                flex: 0.8,
                                background: 'rgba(255, 255, 255, 0.05)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                color: 'var(--text-muted)', 
                                padding: '0.75rem', 
                                borderRadius: '12px', 
                                fontSize: '0.8rem', 
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              onClick={() => {
                                onSaveInvoice({
                                  ...slot,
                                  status: 'pending',
                                  source: 'manual_entry',
                                  billingCycle: slot.cycle,
                                  dueDate: entry.dueDate || slot.dueDate || new Date().toISOString().split('T')[0],
                                  amount: 0,
                                  invoiceNumber: 'Marked as Sent',
                                  id: `MAN-${Date.now()}-${slot.id}`,
                                  sendNotification: false
                                });
                                setEntries(prev => {
                                  const next = {...prev};
                                  delete next[slot.id];
                                  return next;
                                });
                              }}
                            >
                              Already Sent
                            </button>
                            
                            <Button 
                              style={{ flex: 1.2, marginTop: 0 }}
                              $color={agentColor}
                              disabled={!isReady}
                              onClick={() => handleSave(slot.id)}
                            >
                              <Save size={16} /> Save & Send
                            </Button>
                          </div>
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

      {terminalOpen && (
        <TerminalOverlay onClick={(e) => { if (e.target === e.currentTarget && !botRunning) setTerminalOpen(false); }}>
          <TerminalWindow>
            <TerminalHeader>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Terminal size={16} color="#22c55e" />
                <span>CMP Automated Scraper Terminal</span>
              </div>
              {!botRunning && (
                <button onClick={() => setTerminalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              )}
            </TerminalHeader>
            <TerminalBody>
              {terminalLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: '0.25rem', opacity: log.includes('ERROR') ? 1 : 0.8, color: log.includes('ERROR') ? '#ef4444' : '#22c55e' }}>{log}</div>
              ))}
              <div ref={terminalEndRef} />
              {botRunning && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', opacity: 0.5 }}>
                  <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Processing...
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
              )}
            </TerminalBody>
          </TerminalWindow>
        </TerminalOverlay>
      )}
    </Container>
  );
}
