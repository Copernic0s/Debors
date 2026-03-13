import React from 'react';
import styled from 'styled-components';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
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

const Panel = styled.section`
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 1rem;
  min-height: 320px;
`;

const PanelTitle = styled.h3`
  margin: 0 0 0.8rem;
  font-size: 0.95rem;
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
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    font-size: 0.8rem;
    padding: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    text-align: left;
  }

  th {
    color: var(--text-muted);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
  return 'pending';
};

const AGENT_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#f87171', '#34d399', '#60a5fa', '#f472b6', '#facc15'];

const tooltipStyle = {
  background: 'rgba(15, 25, 45, 0.96)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  color: '#d9e3f0'
};

export default function ManagerAnalytics({ invoiceRows, aggregatedRows, selectedAgent, onSelectAgent }) {
  const cleanRows = (invoiceRows || []).filter((row) => String(row.invoiceNumber || '').trim());

  const statusMap = {
    pending: 0,
    overdue: 0,
    paid: 0
  };

  cleanRows.forEach((row) => {
    const status = normalizeStatus(row.status);
    if (status === 'no_invoice') return;
    statusMap[status] += Number(row.amount) || 0;
  });

  const statusDonutData = [
    { name: 'Pending', value: statusMap.pending, color: '#f59e0b' },
    { name: 'Overdue', value: statusMap.overdue, color: '#f87171' },
    { name: 'Paid', value: statusMap.paid, color: '#10b981' }
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
  cleanRows.forEach((row) => {
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
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="agent" tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <YAxis tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="open" name="Open Balance" radius={[6, 6, 0, 0]} cursor="pointer">
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
            <Pie data={statusDonutData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
              {statusDonutData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
        <PanelTitle>Weekly Open vs Collected</PanelTitle>
        <PanelHint>Open = Pending + Overdue. Collected = Paid.</PanelHint>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={weekTrendData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <YAxis tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="open" stroke="#f59e0b" strokeWidth={2.2} dot={{ r: 3 }} name="Open Balance" />
            <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.2} dot={{ r: 3 }} name="Collected" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
        <PanelTitle>Top 10 Accounts to Prioritize</PanelTitle>
        <Table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Agent</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {topAccounts.map((item) => (
              <tr key={item.id}>
                <td>{item.company}</td>
                <td>{item.agentId}</td>
                <td>{normalizeStatus(item.status)}</td>
                <td>{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </Grid>
  );
}
