import React from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1rem;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const RechartsVisualFix = createGlobalStyle`
  .recharts-wrapper:focus,
  .recharts-wrapper *:focus,
  .recharts-surface:focus {
    outline: none !important;
  }
`;

const Panel = styled.section`
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  background: rgba(15, 23, 42, 0.3);
  backdrop-filter: blur(24px);
  padding: 1.5rem;
  min-height: 320px;
  animation: fadeIn 0.8s ease-out;
  box-shadow: var(--shadow-lg);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(15, 23, 42, 0.4);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.05);
  }
`;

const PanelTitle = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.01em;
`;

const PanelHint = styled.p`
  margin: 0 0 0.75rem;
  color: var(--text-muted);
  font-size: 0.76rem;
`;

const FilterChip = styled.button`
  border: 1px solid ${(props) => (props.$active ? 'rgba(56, 189, 248, 0.35)' : 'var(--border-color)')};
  background: ${(props) => (props.$active ? 'rgba(56, 189, 248, 0.12)' : 'var(--surface-2)')};
  color: ${(props) => (props.$active ? 'var(--brand)' : 'var(--text-muted)')};
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${(props) => (props.$active ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.05)')};
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    font-size: 0.85rem;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    text-align: left;
  }

  th {
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }
`;

const TableWrapper = styled.div`
  max-height: 280px;
  overflow-y: auto;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
  }
`;

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
}).format(Number(value) || 0);

const normalizeStatus = (status) => {
  const raw = String(status || '').toLowerCase();
  if (raw === 'overdue') return 'overdue';
  if (raw === 'paid') return 'paid';
  if (raw === 'no_invoice') return 'no_invoice';
  if (raw === 'inactive') return 'inactive';
  return 'pending';
};

const AGENT_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#f87171', '#34d399', '#60a5fa', '#f472b6', '#facc15'];

const tooltipStyle = {
  background: 'rgba(15, 25, 45, 0.96)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  color: '#d9e3f0'
};

const AreaChartVisual = ({ data }) => (
  <ResponsiveContainer width="100%" height={280}>
    <AreaChart data={data}>
      <defs>
        <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
        </linearGradient>
        <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="week" tick={{ fill: '#95a4bb', fontSize: 10 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#95a4bb', fontSize: 10 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
      <Legend verticalAlign="top" height={36} />
      <Area type="monotone" dataKey="open" name="Open Balance" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOpen)" />
      <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCollected)" />
    </AreaChart>
  </ResponsiveContainer>
);

export default function ManagerAnalytics({ invoiceRows, aggregatedRows, selectedAgent, onSelectAgent, onOpenCompanyProfile }) {
  const cleanRows = (invoiceRows || []).filter((row) => {
    const status = normalizeStatus(row.status);
    return status !== 'no_invoice' && status !== 'inactive' && (Number(row.amount) > 0 || status === 'paid');
  });

  const statusMap = {
    pending: 0,
    overdue: 0,
    paid: 0,
    inactive: 0
  };

  (invoiceRows || []).forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'no_invoice') return;
    statusMap[status] += Number(row.amount) || 0;
  });

  const statusDonutData = [
    { name: 'Pending', value: statusMap.pending, color: '#f59e0b' },
    { name: 'Overdue', value: statusMap.overdue, color: '#f87171' },
    { name: 'Paid', value: statusMap.paid, color: '#10b981' },
    { name: 'Inactive', value: statusMap.inactive, color: '#94a3b8' }
  ];

  const byAgent = new Map();
  cleanRows.forEach((row) => {
    const agent = String(row.agentId || 'Unassigned').trim() || 'Unassigned';
    const current = byAgent.get(agent) || { agent, pending: 0, overdue: 0, paid: 0, open: 0 };
    const status = normalizeStatus(row.status);
    if (status !== 'no_invoice') {
      current[status] += Number(row.amount) || 0;
      if (status === 'pending' || status === 'overdue') {
        current.open += Number(row.amount) || 0;
      }
    }
    byAgent.set(agent, current);
  });
  const agentChartData = Array.from(byAgent.values())
    .sort((a, b) => b.open - a.open)
    .map((row, idx) => ({ ...row, color: AGENT_COLORS[idx % AGENT_COLORS.length] }));

  const byWeek = new Map();
  const sortedInvoiceRows = [...cleanRows].sort((a, b) => (a.sourceSheetOrder || 0) - (b.sourceSheetOrder || 0));
  
  sortedInvoiceRows.forEach((row) => {
    const week = String(row.weekLabel || 'Unknown week');
    const current = byWeek.get(week) || { week, pending: 0, overdue: 0, paid: 0, open: 0, collected: 0 };
    const status = normalizeStatus(row.status);
    if (status !== 'no_invoice') {
      current[status] += Number(row.amount) || 0;
      if (status === 'pending' || status === 'overdue') {
        current.open += Number(row.amount) || 0;
      }
      if (status === 'paid') {
        current.collected += Number(row.amount) || 0;
      }
    }
    byWeek.set(week, current);
  });
  const weekTrendData = Array.from(byWeek.values());

  const topAccounts = (aggregatedRows || [])
    .filter((row) => normalizeStatus(row.status) !== 'paid')
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 10);

  return (
    <>
      <RechartsVisualFix />
      <Grid>
        <Panel>
          <PanelTitle>Debt Distribution by Agent</PanelTitle>
          <PanelHint>Click a bar to focus the dashboard on that agent.</PanelHint>
          <div style={{ marginBottom: '0.75rem' }}>
            <FilterChip
              type="button"
              $active={selectedAgent === 'all'}
              onClick={() => onSelectAgent?.('all')}
            >
              All agents
            </FilterChip>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={agentChartData}
              onClick={(state) => {
                const nextAgent = state?.activePayload?.[0]?.payload?.agent;
                if (!nextAgent) return;
                onSelectAgent?.(nextAgent);
              }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="agent" tick={{ fill: '#95a4bb', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#95a4bb', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} cursor={{ fill: 'transparent' }} />
              <Legend />
              <Bar dataKey="open" name="Open Balance" radius={[6, 6, 0, 0]} cursor="pointer" activeBar={false}>
                {agentChartData.map((entry) => (
                  <Cell key={entry.agent} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <PanelTitle>Portfolio Status Split</PanelTitle>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusDonutData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3} stroke="none">
                {statusDonutData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>

        <Panel>
          <PanelTitle>Weekly Open vs Collected</PanelTitle>
          <PanelHint>Open = Pending + Overdue totals. Collected = Paid amounts.</PanelHint>
          <AreaChartVisual data={weekTrendData} />
        </Panel>

        <Panel>
          <PanelTitle>Top 10 Accounts to Prioritize</PanelTitle>
          <PanelHint>Click on a company name to view historical data.</PanelHint>
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Agent</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => onOpenCompanyProfile?.(item.company || item.clientName)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--brand)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          textAlign: 'left',
                          fontSize: 'inherit'
                        }}
                      >
                        {item.company}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>{item.agentId}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        padding: '0.15rem 0.5rem', 
                        borderRadius: '12px', 
                        fontSize: '0.7rem', 
                        fontWeight: 700,
                        background: normalizeStatus(item.status) === 'overdue' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: normalizeStatus(item.status) === 'overdue' ? 'var(--danger)' : 'var(--warn)',
                        textTransform: 'uppercase'
                      }}>
                        {normalizeStatus(item.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </Panel>

      </Grid>
    </>
  );
}
