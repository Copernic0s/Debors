import React from 'react';
import styled from 'styled-components';
import { Calendar, AlertCircle, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { BILLING_CYCLES } from '../constants/billingCycles';

const RoadmapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const SLATable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 0.5rem;
  
  th {
    text-align: left;
    color: var(--text-muted);
    font-size: 0.7rem;
    padding: 0.5rem 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

const SLARow = styled.tr`
  background: rgba(255, 255, 255, 0.02);
  transition: transform 0.2s, background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    transform: scale(1.002);
  }
`;

const SLACell = styled.td`
  padding: 0.8rem 1rem;
  font-size: 0.8rem;
  color: var(--text-main);
  border-top: 1px solid var(--glass-border);
  border-bottom: 1px solid var(--glass-border);

  &:first-child {
    border-left: 1px solid var(--glass-border);
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
    font-weight: 700;
  }

  &:last-child {
    border-right: 1px solid var(--glass-border);
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }
`;

const DateMilestone = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  
  span.label {
    font-size: 0.6rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  span.date {
    font-family: 'Montserrat', sans-serif;
    font-weight: 600;
    color: ${props => props.$active ? 'var(--brand)' : 'inherit'};
  }
`;

const SLAStatus = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  background: ${props => props.$bg};
  color: ${props => props.$color};
  border: 1px solid ${props => props.$border};
`;

const Timeline = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EmptyState = styled.div`
  padding: 3rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  background: rgba(255, 255, 255, 0.01);
  border-radius: var(--radius-xl);
  border: 1px dashed var(--border-color);
`;

export default function InvoiceRoadmap({ data }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;
  };

  const getSLADetails = (item) => {
    const cycle = item.billingCycle;
    const details = {
      period: 'N/A',
      invoiceDate: null,
      dueDate: null,
      status: { label: 'Unknown', bg: 'rgba(149, 164, 187, 0.1)', color: 'var(--text-muted)', border: 'rgba(149, 164, 187, 0.2)', icon: <Clock size={12} /> }
    };

    // Calculate dates based on current week context
    // We assume the Roadmap is for the current/upcoming period
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

    if (cycle === BILLING_CYCLES.MONDAY_SUNDAY) {
      // Period: Mon-Sun. Invoice: Next Mon. Due: Next Tue.
      const invDate = new Date(startOfWeek);
      invDate.setDate(startOfWeek.getDate() + 7); // Next Monday
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + 1); // Next Tuesday
      
      details.period = 'Mon - Sun';
      details.invoiceDate = invDate;
      details.dueDate = dueDate;
    } else if (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
      // Period: Thu-Wed. Invoice: Next Thu. Due: Next Fri.
      // If today is Mon-Wed, we are in the middle of current Thu-Wed period.
      // If today is Thu-Sun, we are looking at next cycle.
      const invDate = new Date(startOfWeek);
      invDate.setDate(startOfWeek.getDate() + 3); // Thursday of same week
      if (currentDay >= 4 || currentDay === 0) invDate.setDate(invDate.getDate() + 7);
      
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + 1);
      
      details.period = 'Thu - Wed';
      details.invoiceDate = invDate;
      details.dueDate = dueDate;
    } else if (cycle === BILLING_CYCLES.TWICE) {
      // Simplified: Show next upcoming generation point
      const nextMon = new Date(startOfWeek);
      if (currentDay >= 1) nextMon.setDate(nextMon.getDate() + 7);
      const nextThu = new Date(startOfWeek);
      nextThu.setDate(startOfWeek.getDate() + 3);
      if (currentDay >= 4 || currentDay === 0) nextThu.setDate(nextThu.getDate() + 7);

      const invDate = nextMon < nextThu ? nextMon : nextThu;
      const dueDate = new Date(invDate);
      dueDate.setDate(invDate.getDate() + 1);

      details.period = 'Dual-Cycle';
      details.invoiceDate = invDate;
      details.dueDate = dueDate;
    }

    if (details.invoiceDate) {
      const timeToInv = details.invoiceDate.getTime() - today.getTime();
      const daysToInv = timeToInv / (1000 * 60 * 60 * 24);

      if (daysToInv === 0) {
        details.status = { label: 'GENERATE TODAY', bg: 'rgba(56, 189, 248, 0.15)', color: 'var(--brand)', border: 'rgba(56, 189, 248, 0.4)', icon: <Calendar size={12} /> };
      } else if (daysToInv < 0 && today < details.dueDate) {
        details.status = { label: 'INVOICE SENT (GRACE)', bg: 'rgba(129, 140, 248, 0.15)', color: 'var(--accent-secondary)', border: 'rgba(129, 140, 248, 0.4)', icon: <CheckCircle2 size={12} /> };
      } else if (today.getTime() === details.dueDate?.getTime()) {
        details.status = { label: 'DUE TODAY', bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--warn)', border: 'rgba(245, 158, 11, 0.4)', icon: <AlertCircle size={12} /> };
      } else {
        details.status = { label: 'SCHEDULED', bg: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: 'var(--glass-border)', icon: <Clock size={12} /> };
      }
    }

    return details;
  };

  const slaData = data
    .filter(item => item.billingCycle && item.billingCycle !== 'CS by agent' && item.billingCycle !== 'Unspecified')
    .map(item => ({
      ...item,
      sla: getSLADetails(item)
    }))
    .sort((a, b) => (a.sla.invoiceDate?.getTime() || 0) - (b.sla.invoiceDate?.getTime() || 0));

  if (slaData.length === 0) {
    return (
      <EmptyState>
        <AlertCircle size={24} opacity={0.5} />
        <p>No companies found with active billing policies. Update remaining "CS by agent" items to activate SLA tracking.</p>
      </EmptyState>
    );
  }

  return (
    <RoadmapContainer>
      <SLATable>
        <thead>
          <tr>
            <th>Company</th>
            <th>Cycle Policy</th>
            <th>Timeline (Period → Inv → Due)</th>
            <th>SLA Status</th>
          </tr>
        </thead>
        <tbody>
          {slaData.map(item => (
            <SLARow key={item.id || item.company}>
              <SLACell>{item.company}</SLACell>
              <SLACell style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.billingCycle}</SLACell>
              <SLACell>
                <Timeline>
                  <DateMilestone>
                    <span className="label">Work Period</span>
                    <span className="date">{item.sla.period}</span>
                  </DateMilestone>
                  <ArrowRight size={12} color="var(--glass-border)" />
                  <DateMilestone $active={item.sla.status.label === 'GENERATE TODAY'}>
                    <span className="label">Invoice Date</span>
                    <span className="date">{formatDate(item.sla.invoiceDate)}</span>
                  </DateMilestone>
                  <ArrowRight size={12} color="var(--glass-border)" />
                  <DateMilestone $active={item.sla.status.label === 'DUE TODAY'}>
                    <span className="label">Due Date</span>
                    <span className="date">{formatDate(item.sla.dueDate)}</span>
                  </DateMilestone>
                </Timeline>
              </SLACell>
              <SLACell>
                <SLAStatus 
                  $bg={item.sla.status.bg} 
                  $color={item.sla.status.color} 
                  $border={item.sla.status.border}
                >
                  {item.sla.status.icon}
                  {item.sla.status.label}
                </SLAStatus>
              </SLACell>
            </SLARow>
          ))}
        </tbody>
      </SLATable>
    </RoadmapContainer>
  );
}
