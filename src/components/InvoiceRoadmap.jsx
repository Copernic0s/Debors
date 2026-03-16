import React from 'react';
import styled from 'styled-components';
import { Calendar, AlertCircle } from 'lucide-react';
import { BILLING_CYCLES } from '../constants/billingCycles';

const RoadmapContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const DayGroup = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-lg);
  padding: 1rem;
  border: 1px solid var(--border-color);
`;

const DayHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
  color: var(--brand);
  font-weight: 800;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const CompanyList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const CompanyBadge = styled.div`
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--brand);
    background: rgba(56, 189, 248, 0.1);
  }
`;

const EmptyState = styled.div`
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
`;

export default function InvoiceRoadmap({ data }) {
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu

  // Helper to get day name
  const getDayName = (dayIndex) => {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
  };

  const getNextInvoiceDay = (cycle) => {
    if (cycle === BILLING_CYCLES.MONDAY_SUNDAY) return 1; // Monday
    if (cycle === BILLING_CYCLES.THURSDAY_WEDNESDAY) return 4; // Thursday
    if (cycle === BILLING_CYCLES.TWICE) {
      // If it's Mon-Wed, next is Thu. If it's Thu-Sun, next is Mon.
      return (currentDay >= 1 && currentDay < 4) ? 4 : 1;
    }
    return null;
  };

  const roadmap = {
    1: [], // Monday
    4: []  // Thursday
  };

  data.forEach(item => {
    const cycle = item.billingCycle;
    const nextDay = getNextInvoiceDay(cycle);
    if (nextDay !== null) {
      roadmap[nextDay].push(item);
    }
  });

  const hasData = roadmap[1].length > 0 || roadmap[4].length > 0;

  if (!hasData) {
    return (
      <EmptyState>
        <AlertCircle size={24} opacity={0.5} />
        <p>No companies found with clear billing cycles (A or B). Update "CS by Agent" items to see them here.</p>
      </EmptyState>
    );
  }

  return (
    <RoadmapContainer>
      {[1, 4].map(day => (
        roadmap[day].length > 0 && (
          <DayGroup key={day}>
            <DayHeader>
              <Calendar size={14} />
              {getDayName(day)} Generation ({roadmap[day].length} companies)
            </DayHeader>
            <CompanyList>
              {roadmap[day].map(item => (
                <CompanyBadge key={item.id || item.company}>
                  {item.company}
                </CompanyBadge>
              ))}
            </CompanyList>
          </DayGroup>
        )
      ))}
    </RoadmapContainer>
  );
}
