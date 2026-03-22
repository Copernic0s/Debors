import React from 'react';
import { Clock3, AlertCircle, Users, ClipboardList } from 'lucide-react';
import styled from 'styled-components';

const DashboardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  animation: fadeIn 0.5s ease-out;
`;

const StatCard = styled.div`
  padding: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid var(--glass-border);
  position: relative;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  }

  &:hover {
    transform: translateY(-8px);
    border-color: var(--brand);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.15);
    background: rgba(30, 41, 59, 0.5);
  }
`;


const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.span`
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.6rem;
`;

const StatValue = styled.span`
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.02em;
`;

const IconWrapper = styled.div`
  padding: 0.85rem;
  border-radius: 16px;
  background-color: ${props => props.$bgColor || 'rgba(255, 255, 255, 0.05)'};
  color: ${props => props.$color || 'white'};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
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
            <StatCard className="glass-card">
                <StatInfo>
                    <StatLabel>Total Pending</StatLabel>
                    <StatValue>{formatCurrency(metrics.currentBalance)}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(56, 189, 248, 0.15)" $color="var(--brand-blue)">
                    <Clock3 size={24} />
                </IconWrapper>
            </StatCard>
 
            <StatCard className="glass-card">
                <StatInfo>
                    <StatLabel>Total Overdue</StatLabel>
                    <StatValue style={{ color: 'var(--brand)' }}>{formatCurrency(metrics.totalOverdue)}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(249, 115, 22, 0.2)" $color="var(--brand)">
                    <AlertCircle size={24} />
                </IconWrapper>
            </StatCard>
 
            <StatCard className="glass-card">
                <StatInfo>
                    <StatLabel>Active Clients</StatLabel>
                    <StatValue>{metrics.activeClients}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(99, 102, 241, 0.15)" $color="var(--brand-indigo)">
                    <Users size={24} />
                </IconWrapper>
            </StatCard>
 
            <StatCard className="glass-card">
                <StatInfo>
                    <StatLabel>Overdue Accounts</StatLabel>
                    <StatValue style={{ color: 'var(--danger)' }}>{metrics.overdueAccounts}</StatValue>
                </StatInfo>
                <IconWrapper $bgColor="rgba(239, 68, 68, 0.15)" $color="var(--danger)">
                    <ClipboardList size={24} />
                </IconWrapper>
            </StatCard>
        </DashboardGrid>
    );
}
