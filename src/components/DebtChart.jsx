import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import styled from 'styled-components';

const ChartContainer = styled.div`
  height: 350px;
  width: 100%;
  margin-top: 2rem;
  padding: 1.5rem;
  animation: fadeIn 0.8s ease-out;
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const ChartTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
`;

const CustomTooltipContainer = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--glass-border);
  padding: 0.8rem 1rem;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px);
`;

const TooltipLabel = styled.p`
  font-weight: 700;
  margin-bottom: 0.25rem;
  color: var(--text-main);
  font-size: 0.85rem;
`;

const TooltipValue = styled.p`
  color: var(--brand);
  font-weight: 600;
  font-size: 0.9rem;
`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <CustomTooltipContainer>
        <TooltipLabel>{label}</TooltipLabel>
        <TooltipValue>Deuda: ${payload[0].value.toLocaleString()}</TooltipValue>
      </CustomTooltipContainer>
    );
  }
  return null;
};

const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#f87171'];

export default function DebtChart({ data }) {
  // Aggregate data by agent
  const agentDebtMap = data.reduce((acc, item) => {
    const agent = String(item.agentId || 'Sin Asignar').trim();
    const amount = Number(item.amount) || 0;
    acc[agent] = (acc[agent] || 0) + amount;
    return acc;
  }, {});

  const chartData = Object.entries(agentDebtMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Show top 10

  return (
    <ChartContainer className="glass-panel">
      <ChartHeader>
        <ChartTitle>Deuda por Agente (Top 10)</ChartTitle>
      </ChartHeader>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            interval={0}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar 
            dataKey="value" 
            radius={[6, 6, 0, 0]} 
            barSize={40}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
