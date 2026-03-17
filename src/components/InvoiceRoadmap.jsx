import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Calendar, AlertCircle, ArrowRight, CheckCircle2, Clock, Zap, Info } from 'lucide-react';
import { BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const RoadmapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-bottom: 3rem;
`;

const SectionHeader = styled.div`
  margin-bottom: 2.5rem;
  
  h2 {
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: var(--text-main);
  }
  
  p {
    color: var(--text-muted);
    font-size: 0.9rem;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.5rem;
`;

const SLACard = styled.div`
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(20px);
  border: 1px solid ${props => props.$highlight ? 'var(--brand)' : 'var(--glass-border)'};
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

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
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
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

export default function InvoiceRoadmap({ data }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const currentDay = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

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
    // Normalización de ciclo para evitar N/A
    const cycle = normalizeBillingCycle(item.billingCycle);
    
    const details = {
      period: 'N/A',
      invoiceDate: null,
      dueDate: null,
      percent: 0,
      status: { label: 'Scheduled', color: 'var(--text-muted)', icon: <Clock size={14} />, highlight: false }
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
      const timeToInv = details.invoiceDate.getTime() - today.getTime();
      const daysToInv = Math.round(timeToInv / (1000 * 60 * 60 * 24));

      if (daysToInv === 0) {
        details.percent = 66;
        details.status = { label: 'GENERATE TODAY', color: 'var(--brand)', icon: <Zap size={14} />, highlight: true };
      } else if (daysToInv < 0 && today < details.dueDate) {
        details.percent = 85;
        details.status = { label: 'GRACE PERIOD', color: '#818cf8', icon: <Info size={14} />, highlight: true };
      } else if (today.getTime() === details.dueDate?.getTime()) {
        details.percent = 100;
        details.status = { label: 'DUE TODAY', color: 'var(--warn)', icon: <AlertCircle size={14} />, highlight: true };
      } else {
        details.percent = 33;
        details.status = { label: 'SCHEDULED', color: 'var(--text-muted)', icon: <Clock size={14} />, highlight: false };
      }
    }

    return details;
  };

  const slaData = useMemo(() => {
    return data
      .filter(item => {
        const c = normalizeBillingCycle(item.billingCycle);
        return c !== BILLING_CYCLES.CS_BY_AGENT && c !== BILLING_CYCLES.UNSPECIFIED && c !== BILLING_CYCLES.MULTIPLE;
      })
      .map(item => ({
        ...item,
        sla: getSLADetails(item)
      }))
      .sort((a, b) => {
        // Prioritize due today or generate today
        if (a.sla.status.highlight && !b.sla.status.highlight) return -1;
        if (!a.sla.status.highlight && b.sla.status.highlight) return 1;
        return (a.sla.invoiceDate?.getTime() || 0) - (b.sla.invoiceDate?.getTime() || 0);
      });
  }, [data, today]);

  if (slaData.length === 0) {
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
      <SectionHeader>
        <h2>Billing SLA Monitor</h2>
        <p>A proactive view of your billing lifecycle. Cards move through stages automatically based on ALMAFUEL policies.</p>
      </SectionHeader>

      <CardGrid>
        {slaData.map(item => (
          <SLACard key={item.id} $statusColor={item.sla.status.color} $highlight={item.sla.status.highlight}>
            <CardHead>
              <div>
                <CompanyName>{item.company}</CompanyName>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Agent: {item.agentId}</div>
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

              <Milestone $active={item.sla.percent === 66} $color="rgba(56, 189, 248, 0.2)">
                <div className="icon-box">
                  <Zap size={14} />
                </div>
                <div className="content">
                  <div className="label">Generation day</div>
                  <div className="value">{formatDate(item.sla.invoiceDate)}</div>
                </div>
              </Milestone>

              <Milestone $active={item.sla.percent === 100} $color="rgba(245, 158, 11, 0.2)">
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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {item.sla.status.highlight ? 'Action Required' : 'On Track'}
              </div>
            </ActionFooter>
          </SLACard>
        ))}
      </CardGrid>
    </RoadmapContainer>
  );
}
