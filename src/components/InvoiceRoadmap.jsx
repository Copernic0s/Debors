import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Calendar, AlertCircle, ArrowRight, CheckCircle2, Clock, Zap, Info, Search, Filter, ChevronDown } from 'lucide-react';
import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const RoadmapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-bottom: 3rem;
  animation: fadeIn 0.6s ease-out;
`;

const FilterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  min-width: 300px;
  
  input {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: 0.8rem 1rem 0.8rem 2.8rem;
    color: var(--text-main);
    font-size: 0.9rem;
    transition: all 0.3s ease;

    &:focus {
      outline: none;
      border-color: var(--brand);
      background: rgba(0, 0, 0, 0.4);
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.1);
    }
  }

  svg {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }
`;

const MiniFilter = styled.div`
  display: flex;
  gap: 0.6rem;
  align-items: center;
`;

const FilterButton = styled.button`
  background: ${props => props.$active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)'};
  border: 1px solid ${props => props.$active ? 'var(--brand)' : 'var(--glass-border)'};
  border-radius: 999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${props => props.$active ? 'var(--brand)' : 'var(--text-muted)'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main);
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.5rem;
`;

const SLACard = styled.div`
  background: ${props => props.$highlight
    ? `linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, ${props.$statusColor}10 100%)`
    : 'rgba(15, 23, 42, 0.4)'};
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.$highlight ? props.$statusColor : 'var(--glass-border)'};
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: ${props => props.$highlight ? `0 10px 30px ${props.$statusColor}15` : 'none'};

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: ${props => props.$statusColor};
  }

  &:hover {
    transform: translateY(-5px);
    border-color: ${props => props.$statusColor};
    box-shadow: 0 15px 40px rgba(0,0,0,0.4), 0 0 20px ${props => props.$statusColor}20;
  }
`;

const CardHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
`;

const CompanyName = styled.h4`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.02em;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
`;

const CycleTag = styled.div`
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  background: rgba(255,255,255,0.05);
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
`;

const TimelineWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
`;

const Milestone = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  opacity: ${props => props.$dim ? 0.4 : 1};

  .icon-box {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${props => props.$active ? props.$color : 'rgba(255,255,255,0.05)'};
    color: ${props => props.$active ? 'white' : 'var(--text-muted)'};
    box-shadow: ${props => props.$active ? `0 0 10px ${props.$color}` : 'none'};
  }

  .content {
    flex: 1;
    
    .label {
      font-size: 0.65rem;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 700;
    }
    
    .value {
      font-size: 0.85rem;
      font-weight: 600;
      color: ${props => props.$active ? 'var(--text-main)' : 'var(--text-muted)'};
    }
  }
`;

const SLAProgress = styled.div`
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 2px;
  margin: 1.5rem 0 1rem;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${props => props.$percent}%;
    background: ${props => props.$color};
    box-shadow: 0 0 10px ${props => props.$color};
    transition: width 1s ease-out;
  }
`;

const ActionFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
`;

const StatusBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.7rem;
  font-weight: 800;
  color: ${props => props.$color};
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: ${props => props.$color}15;
  border: 1px solid ${props => props.$color}40;
  backdrop-filter: blur(4px);
`;

const LoadMoreBtn = styled.button`
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--glass-border);
  color: var(--text-main);
  padding: 1rem 2rem;
  border-radius: var(--radius-lg);
  font-weight: 700;
  cursor: pointer;
  margin: 2rem auto;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255,255,255,0.08);
    border-color: var(--brand);
    transform: translateY(-2px);
  }
`;

const EmptyState = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  color: var(--text-muted);
  background: rgba(15, 23, 42, 0.2);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-xl);
  
  h3 { font-size: 1.2rem; color: var(--text-main); margin-bottom: 0.5rem; }
`;

export default function InvoiceRoadmap({ data, onMarkInvoiced, onMarkNoUsage }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState(12);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const currentDay = today.getDay();

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    if (isNaN(d.getTime())) return 'N/A';
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  const getSLADetails = (item) => {
    const cycle = normalizeBillingCycle(item.billingCycle);

    const details = {
      period: 'N/A',
      invoiceDate: null,
      dueDate: null,
      percent: 0,
      status: { label: 'Scheduled', color: '#94a3b8', icon: <Clock size={14} />, highlight: false, id: 'scheduled' },
      isRecentlyInvoiced: false,
      isRecentlyNoUsage: false,
      isTaskCompleted: false
    };

    const getTargetDates = (type, refDate) => {
      const inv = new Date(refDate);
      const day = refDate.getDay();
      let start = new Date(refDate);
      let end = new Date(refDate);
      let due = new Date(refDate);
      let periodStr = '';

      if (type === BILLING_CYCLES.MONDAY_SUNDAY) {
        let diff = day - 1;
        if (diff < 0) diff += 7;
        inv.setDate(refDate.getDate() - diff);
        start.setDate(inv.getDate() - 7);
        end.setDate(inv.getDate() - 1);
        due.setDate(inv.getDate() + 1); 
        periodStr = `${formatDate(start)} - ${formatDate(end)}`;
      } else if (type === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
        let diff = day - 4;
        if (diff < 0) diff += 7;
        inv.setDate(refDate.getDate() - diff);
        start.setDate(inv.getDate() - 7);
        end.setDate(inv.getDate() - 1);
        due.setDate(inv.getDate() + 1); 
        periodStr = `${formatDate(start)} - ${formatDate(end)}`;
      } else if (type === BILLING_CYCLES.TWICE) {
        const invMon = new Date(refDate);
        let diffMon = invMon.getDay() - 1;
        if (diffMon < 0) diffMon += 7;
        invMon.setDate(invMon.getDate() - diffMon);

        const invThu = new Date(refDate);
        let diffThu = invThu.getDay() - 4;
        if (diffThu < 0) diffThu += 7;
        invThu.setDate(invThu.getDate() - diffThu);

        const activeInv = invMon > invThu ? invMon : invThu;
        inv.setTime(activeInv.getTime());

        if (activeInv.getDay() === 1) { // Monday Invoice
          // Covers Thu - Sun
          start.setDate(inv.getDate() - 4); // Thu
          end.setDate(inv.getDate() - 1); // Sun
          due.setDate(inv.getDate() + 1); // Tue
        } else { // Thursday Invoice
          // Covers Mon - Wed
          start.setDate(inv.getDate() - 3); // Mon
          end.setDate(inv.getDate() - 1); // Wed
          due.setDate(inv.getDate() + 1); // Fri
        }
        periodStr = `${formatDate(start)} - ${formatDate(end)}`;
      }
      return { inv, due, start, end, periodStr };
    };

    let target = null;
    let currentRef = new Date(today);
    let iterations = 0;

    // FIND THE EARLIEST UNPROCESSED WINDOW
    while (iterations < 2) {
      target = getTargetDates(cycle, currentRef);

      const isProcessed = (item.lastInvoicedDate && new Date(item.lastInvoicedDate + 'T00:00:00') >= target.inv) ||
        (item.lastNoUsageDate && new Date(item.lastNoUsageDate + 'T00:00:00') >= target.inv);

      if (!isProcessed) break;

      // Use local date string for comparison to avoid UTC shift
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const wasProcessedToday = (item.lastInvoicedDate === todayStr) || (item.lastNoUsageDate === todayStr);

      if (wasProcessedToday && iterations === 0) {
        details.isTaskCompleted = true;
        if (item.lastInvoicedDate === todayStr) details.isRecentlyInvoiced = true;
        else details.isRecentlyNoUsage = true;
        break;
      }

      // Move iteration forward to find NEXT window
      currentRef = new Date(target.inv);
      currentRef.setDate(target.inv.getDate() - 1);
      iterations++;
    }

    if (target) {
      details.invoiceDate = target.inv;
      details.dueDate = target.due;
      details.period = target.periodStr;

      const diff = Math.floor((today - target.inv) / (1000 * 60 * 60 * 24));

      if (details.isTaskCompleted) {
        details.percent = 100;
        details.status = {
          label: details.isRecentlyInvoiced ? 'INVOICED' : 'NO ACTIVITY',
          color: details.isRecentlyInvoiced ? '#10b981' : '#f87171',
          icon: details.isRecentlyInvoiced ? <CheckCircle2 size={14} /> : <Info size={14} />,
          highlight: false,
          id: 'invoiced'
        };
      } else if (diff === 0) {
        details.percent = 66;
        details.status = { label: 'GENERATE TODAY', color: '#38bdf8', icon: <Zap size={14} />, highlight: true, id: 'generation' };
      } else if (diff === 1) {
        details.percent = 85;
        details.status = { label: 'DUE TODAY', color: '#f59e0b', icon: <AlertCircle size={14} />, highlight: true, id: 'overdue' };
      } else if (diff > 1) {
        details.percent = 100;
        details.status = { label: 'OVERDUE', color: '#ef4444', icon: <AlertCircle size={14} />, highlight: true, id: 'overdue' };
      } else if (diff === -1) {
        // One day before invoice
        details.percent = 45;
        details.status = { label: 'CLOSING PERIOD', color: '#fb923c', icon: <Clock size={14} />, highlight: true, id: 'closing' };
      } else {
        // Upcoming window
        details.percent = 33;
        details.status = { label: 'UPCOMING', color: '#94a3b8', icon: <Clock size={14} />, highlight: false, id: 'scheduled' };
      }
    }

    return details;
  };

  const slaData = useMemo(() => {
    return data
      .filter(item => {
        const c = normalizeBillingCycle(item.billingCycle);
        if (c === BILLING_CYCLES.CS_BY_AGENT || c === BILLING_CYCLES.UNSPECIFIED || c === BILLING_CYCLES.MULTIPLE) return false;

        const company = String(item.company || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        if (search && !company.includes(search)) return false;

        return true;
      })
      .map(item => ({
        ...item,
        sla: getSLADetails(item)
      }))
      .filter(item => {
        if (statusFilter === 'all') return true;
        return item.sla.status.id === statusFilter;
      })
      .sort((a, b) => {
        if (a.sla.status.highlight && !b.sla.status.highlight) return -1;
        if (!a.sla.status.highlight && b.sla.status.highlight) return 1;
        return (a.sla.invoiceDate?.getTime() || 0) - (b.sla.invoiceDate?.getTime() || 0);
      });
  }, [data, today, searchTerm, statusFilter]);

  const paginatedData = slaData.slice(0, pageSize);

  const usageStats = useMemo(() => {
    const activeClients = data.filter(item => {
      const c = normalizeBillingCycle(item.billingCycle);
      return c !== BILLING_CYCLES.CS_BY_AGENT && c !== BILLING_CYCLES.UNSPECIFIED && c !== BILLING_CYCLES.MULTIPLE;
    });

    // Determine Monday and Thursday of the current calendar week
    const getWeekBoundaries = (refDate) => {
      const d = new Date(refDate);
      const day = d.getDay();
      
      const mon = new Date(d);
      let monDiff = day - 1;
      if (monDiff < 0) monDiff += 7;
      mon.setDate(d.getDate() - monDiff);

      const thu = new Date(mon);
      thu.setDate(mon.getDate() + 3);

      return { 
        mon: mon.toISOString().split('T')[0], 
        thu: thu.toISOString().split('T')[0] 
      };
    };

    const boundaries = getWeekBoundaries(today);

    let totalAmount = 0;
    let sentAmount = 0;
    let totalCycles = 0;
    let completedCycles = 0;

    activeClients.forEach(item => {
      const cycle = normalizeBillingCycle(item.billingCycle);
      const rawAmount = Number(item.amount) || 0;
      const lastDate = item.lastInvoicedDate || item.lastNoUsageDate || '';
      
      let cyclesInWeek = 1;
      let cyclesDone = 0;

      if (cycle === BILLING_CYCLES.TWICE) {
        cyclesInWeek = 2;
        if (lastDate >= boundaries.thu) cyclesDone = 2;
        else if (lastDate >= boundaries.mon) cyclesDone = 1;
      } else {
        const startDay = (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY) ? boundaries.thu : boundaries.mon;
        if (lastDate >= startDay) cyclesDone = 1;
      }

      totalCycles += cyclesInWeek;
      completedCycles += cyclesDone;
      
      // Projection logic:
      // If 1/2 cycles done of a TWICE week, and we only have 1 row amount so far, project 2x
      let projectedForClient = rawAmount;
      if (cycle === BILLING_CYCLES.TWICE && cyclesDone === 1 && rawAmount > 0) {
        projectedForClient = rawAmount * 2;
      } else if (cycle === BILLING_CYCLES.TWICE && cyclesDone === 0 && rawAmount > 0) {
        // If they have a manual amount but 0 done, we still project 2x the base amount
        projectedForClient = rawAmount * 2;
      }

      totalAmount += projectedForClient;
      
      // Sent amount is what is actually processed
      if (cyclesDone > 0) {
        sentAmount += rawAmount;
      }
    });

    const pendingAmount = totalAmount - sentAmount;

    return { 
      clientCount: activeClients.length,
      total: totalCycles, 
      invoiced: completedCycles, 
      totalAmount, 
      sentAmount,
      pendingAmount,
      rate: totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0 
    };
  }, [data, today]);

  if (slaData.length === 0 && !searchTerm && statusFilter === 'all') {
    return (
      <EmptyState>
        <Zap size={48} color="var(--brand)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3>No Policies Found</h3>
        <p>Update "CS by Agent" items in the Overview tab to activate SLA monitoring for your clients.</p>
      </EmptyState>
    );
  }

  return (
    <RoadmapContainer>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px', background: 'rgba(56, 189, 248, 0.05)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Accounts using Almafuel</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--brand)' }}>{usageStats.clientCount} <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-muted)' }}>Active Clients</span></div>
        </div>
        <div style={{ flex: 1, minWidth: '200px', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Billing Rate (Weekly Events)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{usageStats.rate}% <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-muted)' }}>({usageStats.invoiced} of {usageStats.total})</span></div>
        </div>
        <div style={{ flex: 1, minWidth: '240px', background: 'rgba(217, 70, 239, 0.05)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(217, 70, 239, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Projected Cycle Billing</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#d946ef' }}>${usageStats.totalAmount.toLocaleString()} <span style={{ fontSize: '0.7rem', fontWeight: '400', color: 'var(--text-muted)' }}>USD</span></div>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981' }}>{usageStats.total > 0 ? Math.round((usageStats.sentAmount / usageStats.totalAmount * 100) || 0) : 0}%</div>
          </div>
          
          <div style={{ height: '4px', background: 'rgba(217, 70, 239, 0.1)', borderRadius: '2px', marginBottom: '0.6rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(usageStats.sentAmount / usageStats.totalAmount * 100) || 0}%`, background: '#d946ef', borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.65rem' }}>
            <div style={{ color: '#10b981' }}>Sent: <strong>${usageStats.sentAmount.toLocaleString()}</strong></div>
            <div style={{ color: 'var(--text-muted)' }}>|</div>
            <div style={{ color: '#ef4444' }}>Pending: <strong>${usageStats.pendingAmount.toLocaleString()}</strong></div>
          </div>
        </div>
      </div>

      <FilterBar>
        <SearchBox>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search company in SLA roadmap..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPageSize(12); }}
          />
        </SearchBox>
        <MiniFilter>
          <FilterButton $active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterButton>
          <FilterButton $active={statusFilter === 'overdue'} onClick={() => setStatusFilter('overdue')}>Overdue</FilterButton>
          <FilterButton $active={statusFilter === 'generation'} onClick={() => setStatusFilter('generation')}>Generation</FilterButton>
          <FilterButton $active={statusFilter === 'invoiced'} onClick={() => setStatusFilter('invoiced')}>Processed</FilterButton>
        </MiniFilter>
      </FilterBar>

      {paginatedData.length > 0 ? (
        <CardGrid>
          {paginatedData.map(item => (
            <SLACard key={item.id} $statusColor={item.sla.status.color} $highlight={item.sla.status.highlight}>
              <CardHead>
                <div>
                  <CompanyName>{item.company}</CompanyName>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Sales: {item.agentId}</div>
                </div>
                <CycleTag>{normalizeBillingCycle(item.billingCycle)}</CycleTag>
              </CardHead>

              <TimelineWrapper>
                <Milestone $dim={item.sla.percent > 33}>
                  <div className="icon-box">
                    <Calendar size={14} />
                  </div>
                  <div className="content">
                    <div className="label">Work window</div>
                    <div className="value">{item.sla.period}</div>
                  </div>
                </Milestone>

                <Milestone $active={item.sla.percent === 66} $color={`${item.sla.status.color}40`}>
                  <div className="icon-box">
                    <Zap size={14} />
                  </div>
                  <div className="content">
                    <div className="label">Generation day</div>
                    <div className="value">{formatDate(item.sla.invoiceDate)}</div>
                  </div>
                </Milestone>

                <Milestone $active={item.sla.percent === 100} $color={`${item.sla.status.color}40`}>
                  <div className="icon-box">
                    <AlertCircle size={14} />
                  </div>
                  <div className="content">
                    <div className="label">Due Deadline</div>
                    <div className="value">{formatDate(item.sla.dueDate)}</div>
                  </div>
                </Milestone>
              </TimelineWrapper>

              <SLAProgress $percent={item.sla.percent} $color={item.sla.status.color} />

              <ActionFooter>
                <StatusBadge $color={item.sla.status.color}>
                  {item.sla.status.icon}
                  {item.sla.status.label}
                </StatusBadge>

                {(item.sla.status.id === 'generation' || item.sla.status.id === 'overdue') && !item.sla.isRecentlyInvoiced && !item.sla.isRecentlyNoUsage && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => onMarkNoUsage(item)}
                      title="No usage recorded this week"
                      style={{
                        background: 'rgba(248, 113, 113, 0.1)',
                        color: '#f87171',
                        border: '1px solid rgba(248, 113, 113, 0.3)',
                        borderRadius: '6px',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      No Usage
                    </button>
                    <button
                      onClick={() => onMarkInvoiced(item)}
                      style={{
                        background: 'var(--brand)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(56, 189, 248, 0.3)'
                      }}
                    >
                      Confirm Generat.
                    </button>
                  </div>
                )}

                {(item.sla.isRecentlyInvoiced || item.sla.isRecentlyNoUsage) && (
                  <div style={{ fontSize: '0.7rem', color: item.sla.isRecentlyInvoiced ? '#10b981' : '#f87171', fontWeight: '800' }}>
                    {item.sla.isRecentlyInvoiced ? 'BILL SENT' : 'NO USAGE'}
                  </div>
                )}
              </ActionFooter>
            </SLACard>
          ))}
        </CardGrid>
      ) : (
        <EmptyState>
          <Zap size={32} opacity={0.3} />
          <h3>No matching results</h3>
        </EmptyState>
      )}

      {pageSize < slaData.length && (
        <LoadMoreBtn onClick={() => setPageSize(prev => prev + 12)}>
          <ChevronDown size={18} />
          Show More Accounts
        </LoadMoreBtn>
      )}
    </RoadmapContainer>
  );
}
