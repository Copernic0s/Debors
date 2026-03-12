import React from 'react';
import { DollarSign, AlertCircle, Users, ClipboardList } from 'lucide-react';
import styled from 'styled-components';

const DashboardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  animation: fadeIn 0.5s ease-out;
`;

const StatCard = styled.div`
  padding: 1.5rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }
`;

const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.span`
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const StatValue = styled.span`
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--text-primary);
`;

const IconWrapper = styled.div`
  padding: 0.75rem;
  border-radius: 12px;
  background-color: ${props => props.$bgColor || 'rgba(255, 255, 255, 0.1)'};
  color: ${props => props.$color || 'white'};
`;

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(value);
};

export default function Dashboard({ metrics }) {
    return (
        <DashboardGrid>
            <StatCard className="glass-panel">
                <StatInfo>
                    <StatLabel>Total Active Debt</StatLabel>
                    <StatValue>{formatCurrency(metrics.totalDebt)}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(59, 130, 246, 0.2)" $color="var(--accent-color)">
                    <DollarSign size={24} />
                </IconWrapper>
            </StatCard>

            <StatCard className="glass-panel">
                <StatInfo>
                    <StatLabel>Total Overdue</StatLabel>
                    <StatValue style={{ color: 'var(--danger)' }}>{formatCurrency(metrics.totalOverdue)}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(239, 68, 68, 0.2)" $color="var(--danger)">
                    <AlertCircle size={24} />
                </IconWrapper>
            </StatCard>

            <StatCard className="glass-panel">
                <StatInfo>
                    <StatLabel>Active Clients</StatLabel>
                    <StatValue>{metrics.activeClients}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(245, 158, 11, 0.2)" $color="var(--warn)">
                    <Users size={24} />
                </IconWrapper>
            </StatCard>

            <StatCard className="glass-panel">
                <StatInfo>
                    <StatLabel>Overdue Accounts</StatLabel>
                    <StatValue style={{ color: 'var(--danger)' }}>{metrics.overdueAccounts}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(248, 113, 113, 0.15)" $color="var(--danger)">
                    <ClipboardList size={24} />
                </IconWrapper>
            </StatCard>
        </DashboardGrid>
    );
}
