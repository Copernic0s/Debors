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

export default function InvoiceRoadmap({ data, onMarkInvoiced }) {
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
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(2);
    return `${day}-${month}-${year}`;
  };

  const getSLADetails = (item) => {
    const cycle = normalizeBillingCycle(item.billingCycle);
    
    const details = {
      period: 'N/A',
      invoiceDate: null,
      dueDate: null,
      percent: 0,
      status: { label: 'Scheduled', color: '#94a3b8', icon: <Clock size={14} />, highlight: false, id: 'scheduled' },
      isRecentlyInvoiced: false
    };

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

    if (cycle === BILLING_CYCLES.MONDAY_SUNDAY) {
      const invDate = new Date(startOfWeek);
      invDate.setDate(startOfWeek.getDate() + 7);
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + 1);
      details.period = 'Mon - Sun';
      details.invoiceDate = invDate;
      details.dueDate = dueDate;
    } else if (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
      const invDate = new Date(startOfWeek);
      invDate.setDate(startOfWeek.getDate() + 3);
      if (currentDay >= 4 || currentDay === 0) invDate.setDate(invDate.getDate() + 7);
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + 1);
      details.period = 'Thu - Wed';
      details.invoiceDate = invDate;
      details.dueDate = dueDate;
    } else if (cycle === BILLING_CYCLES.TWICE) {
      const nextMon = new Date(startOfWeek);
      if (currentDay >= 1) nextMon.setDate(nextMon.getDate() + 7);
      const nextThu = new Date(startOfWeek);
      nextThu.setDate(startOfWeek.getDate() + 3);
      if (currentDay >= 4 || currentDay === 0) nextThu.setDate(nextThu.getDate() + 7);
      const invDate = nextMon < nextThu ? nextMon : nextThu;
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + 1);
      details.period = 'Dual Cycle';
      details.invoiceDate = invDate;
      details.dueDate = dueDate;
    }

    if (details.invoiceDate) {
      // Check if item was ALREADY invoiced for this period
      if (item.lastInvoicedDate) {
        const lastInv = new Date(item.lastInvoicedDate + 'T00:00:00');
        // If lastInvoicedDate is within 6 days of the expected invoiceDate, it's considered done for this cycle
        const diffDays = Math.abs(lastInv - details.invoiceDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 3 || lastInv >= details.invoiceDate) {
           details.isRecentlyInvoiced = true;
        }
      }

      const timeToInv = details.invoiceDate.getTime() - today.getTime();
      const daysToInv = Math.round(timeToInv / (1000 * 60 * 60 * 24));

      if (details.isRecentlyInvoiced) {
        details.percent = 100;
        details.status = { label: 'INVOICED', color: '#10b981', icon: <CheckCircle2 size={14} />, highlight: false, id: 'done' };
      } else if (daysToInv === 0) {
        details.percent = 66;
        details.status = { label: 'GENERATE TODAY', color: '#38bdf8', icon: <Zap size={14} />, highlight: true, id: 'generate' };
      } else if (daysToInv < 0 && today < details.dueDate) {
        details.percent = 85;
        details.status = { label: 'GRACE PERIOD', color: '#818cf8', icon: <Info size={14} />, highlight: true, id: 'grace' };
      } else if (today.getTime() === details.dueDate?.getTime()) {
        details.percent = 100;
        details.status = { label: 'DUE TODAY', color: '#f59e0b', icon: <AlertCircle size={14} />, highlight: true, id: 'due' };
      } else {
        details.percent = 33;
        details.status = { label: 'SCHEDULED', color: '#94a3b8', icon: <Clock size={14} />, highlight: false, id: 'scheduled' };
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
        if (statusFilter === 'priority') return item.sla.status.highlight;
        if (statusFilter === 'done') return item.sla.isRecentlyInvoiced;
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
    const total = data.filter(item => {
      const c = normalizeBillingCycle(item.billingCycle);
      return c !== BILLING_CYCLES.CS_BY_AGENT && c !== BILLING_CYCLES.UNSPECIFIED && c !== BILLING_CYCLES.MULTIPLE;
    }).length;

    const invoiced = data.filter(item => {
      if (!item.lastInvoicedDate) return false;
      const last = new Date(item.lastInvoicedDate + 'T00:00:00');
      const diff = (today - last) / (1000 * 60 * 60 * 24);
      return diff <= 10; 
    }).length;

    const totalAmount = data.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return { total, invoiced, totalAmount, rate: total > 0 ? Math.round((invoiced / total) * 100) : 0 };
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
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--brand)' }}>{usageStats.total} <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-muted)' }}>Active</span></div>
        </div>
        <div style={{ flex: 1, minWidth: '200px', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Billing Rate (Current Cycle)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>{usageStats.rate}% <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-muted)' }}>({usageStats.invoiced} of {usageStats.total})</span></div>
        </div>
        <div style={{ flex: 1, minWidth: '200px', background: 'rgba(217, 70, 239, 0.05)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(217, 70, 239, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Total Billing Exposure</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#d946ef' }}>${usageStats.totalAmount.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-muted)' }}>USD</span></div>
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
          <FilterButton $active={statusFilter === 'priority'} onClick={() => setStatusFilter('priority')}>🔥 Priority</FilterButton>
          <FilterButton $active={statusFilter === 'due'} onClick={() => setStatusFilter('due')}>Vencimientos</FilterButton>
          <FilterButton $active={statusFilter === 'done'} onClick={() => setStatusFilter('done')}>Facturado</FilterButton>
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
                  {item.lastInvoicedDate && (
                    <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '0.2rem', fontWeight: '700' }}>
                      LAST BILL: {formatDate(item.lastInvoicedDate)}
                    </div>
                  )}
                </div>
                <CycleTag>{item.billingCycle}</CycleTag>
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
                
                {item.sla.status.id === 'generate' && !item.sla.isRecentlyInvoiced && (
                   <button 
                     onClick={() => onMarkInvoiced(item)}
                     style={{ 
                       background: 'var(--brand)', 
                       color: 'white', 
                       border: 'none', 
                       borderRadius: '8px', 
                       padding: '0.3rem 0.6rem', 
                       fontSize: '0.7rem', 
                       fontWeight: '800', 
                       cursor: 'pointer',
                       boxShadow: '0 4px 10px rgba(56, 189, 248, 0.3)'
                     }}
                   >
                     Confirm Bill
                   </button>
                )}
                
                {item.sla.isRecentlyInvoiced && (
                  <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800' }}>DONE</div>
                )}
              </ActionFooter>
            </SLACard>
          ))}
        </CardGrid>
      ) : (
        <EmptyState>
          <Zap size={32} opacity={0.3} />
          <h3>No results for these filters</h3>
        </EmptyState>
      )}

      {pageSize < slaData.length && (
        <LoadMoreBtn onClick={() => setPageSize(prev => prev + 12)}>
          <ChevronDown size={18} />
          Load More Companies
        </LoadMoreBtn>
      )}
    </RoadmapContainer>
  );
}
