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

export default function ManagerAnalytics({ invoiceRows, aggregatedRows }) {
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
    const current = byAgent.get(agent) || { agent, pending: 0, overdue: 0, paid: 0 };
    const status = normalizeStatus(row.status);
    if (status !== 'no_invoice') {
      current[status] += Number(row.amount) || 0;
    }
    byAgent.set(agent, current);
  });
  const agentChartData = Array.from(byAgent.values()).sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue));

  const byWeek = new Map();
  cleanRows.forEach((row) => {
    const week = String(row.weekLabel || 'Unknown week');
    const current = byWeek.get(week) || { week, pending: 0, overdue: 0, paid: 0 };
    const status = normalizeStatus(row.status);
    if (status !== 'no_invoice') {
      current[status] += Number(row.amount) || 0;
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
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={agentChartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="agent" tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <YAxis tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
            <Bar dataKey="overdue" stackId="a" fill="#f87171" name="Overdue" radius={[4, 4, 0, 0]} />
            <Bar dataKey="paid" stackId="a" fill="#10b981" name="Paid" radius={[4, 4, 0, 0]} />
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
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
        <PanelTitle>Weekly Trend (Amounts)</PanelTitle>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={weekTrendData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <YAxis tick={{ fill: '#95a4bb', fontSize: 11 }} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="pending" stroke="#f59e0b" strokeWidth={2.2} dot={{ r: 3 }} name="Pending" />
            <Line type="monotone" dataKey="overdue" stroke="#f87171" strokeWidth={2.2} dot={{ r: 3 }} name="Overdue" />
            <Line type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2.2} dot={{ r: 3 }} name="Paid" />
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
