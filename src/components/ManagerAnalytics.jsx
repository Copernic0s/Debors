import React, { useMemo, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  UserRound
} from 'lucide-react';
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
  Cell
} from 'recharts';

const STATUS_META = {
  pending: { label: 'Pending', color: '#f59e0b' },
  overdue: { label: 'Overdue', color: '#ef4444' },
  paid: { label: 'Paid', color: '#10b981' },
  inactive: { label: 'Inactive', color: '#a16207' },
  no_invoice: { label: 'No Invoice', color: '#8b5cf6' }
};

const AGENT_COLORS = ['#f97316', '#06b6d4', '#22c55e', '#f43f5e', '#8b5cf6', '#facc15', '#38bdf8', '#fb7185'];
const tooltipStyle = {
  background: 'rgba(8, 18, 34, 0.95)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '16px',
  color: '#ffffff',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
  padding: '12px',
  fontSize: '0.8rem',
  fontFamily: "'Plus Jakarta Sans', sans-serif"
};

const normalizeStatus = (status) => {
  const raw = String(status || '').toLowerCase();
  if (raw === 'overdue') return 'overdue';
  if (raw === 'paid') return 'paid';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'no_invoice') return 'no_invoice';
  return 'pending';
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const formatCompactCurrency = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
};

const getDaysPastDue = (dueDate) => {
  if (!dueDate) return 0;
  const parsed = new Date(String(dueDate).includes('T') ? dueDate : `${dueDate}T17:00:00`);
  if (Number.isNaN(parsed.getTime())) return 0;
  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  return diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
};

const getAgingBucket = (daysPastDue) => {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 7) return '1-7';
  if (daysPastDue <= 14) return '8-14';
  return '15+';
};

const agingLabelToKey = (label) => {
  if (label === 'Current') return 'current';
  if (label === '1-7 days') return '1-7';
  if (label === '8-14 days') return '8-14';
  return '15+';
};

const RechartsVisualFix = createGlobalStyle`
  .recharts-wrapper:focus,
  .recharts-wrapper *:focus,
  .recharts-surface:focus {
    outline: none !important;
  }
`;

const AnalyticsShell = styled.div`
  display: grid;
  gap: 1rem;
`;

const SummaryStrip = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const SummaryCard = styled.div`
  min-height: 100px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
`;

const SummaryLabel = styled.span`
  color: var(--text-muted);
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.06em;
`;

const SummaryValue = styled.strong`
  color: var(--text-main);
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-family: 'Plus Jakarta Sans', sans-serif;
`;

const SummaryMeta = styled.span`
  color: rgba(217, 227, 240, 0.72);
  font-size: 0.82rem;
`;

const UtilityBar = styled.section`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const UtilityGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`;

const UtilityChip = styled.button`
  border: 1px solid ${(props) => (props.$active ? 'rgba(255, 122, 26, 0.4)' : 'rgba(255, 255, 255, 0.08)')};
  background: ${(props) => (props.$active ? 'linear-gradient(135deg, rgba(255, 179, 71, 0.15), rgba(255, 122, 26, 0.2))' : 'rgba(255, 255, 255, 0.04)')};
  color: ${(props) => (props.$active ? 'var(--brand-ice)' : 'var(--text-muted)')};
  border-radius: 12px;
  padding: 0.5rem 1rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: var(--text-main);
    background: ${(props) => (props.$active ? 'linear-gradient(135deg, rgba(255, 179, 71, 0.2), rgba(255, 122, 26, 0.25))' : 'rgba(255, 255, 255, 0.08)')};
    transform: translateY(-2px);
  }
`;

const KPIGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.9rem;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const KpiCard = styled.article`
  position: relative;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: var(--shadow-md);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &:hover {
    transform: translateY(-5px);
    border-color: rgba(249, 115, 22, 0.3);
    background: rgba(255, 255, 255, 0.07);
    box-shadow: 
      0 30px 60px -12px rgba(0, 0, 0, 0.4),
      0 0 20px rgba(249, 115, 22, 0.05);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
  }
`;

const KpiTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const KpiIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => props.$bg || 'rgba(249, 115, 22, 0.12)'};
  color: ${(props) => props.$color || 'var(--brand)'};
  flex-shrink: 0;
`;

const KpiLabel = styled.div`
  color: var(--text-muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.04em;
`;

const KpiValue = styled.strong`
  display: block;
  margin-top: 0.55rem;
  color: var(--text-main);
  font-size: clamp(1.2rem, 1.6vw, 1.8rem);
  line-height: 1.1;
`;

const KpiSubtext = styled.div`
  margin-top: 0.35rem;
  color: rgba(217, 227, 240, 0.72);
  font-size: 0.82rem;
  line-height: 1.45;
`;

const MainGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.95fr);
  gap: 1rem;

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
`;

const Column = styled.div`
  display: grid;
  gap: 1rem;
`;

const Panel = styled.section`
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--glass-border);
  border-radius: 28px;
  padding: 1.75rem;
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle at top right, rgba(249, 115, 22, 0.03), transparent 70%);
    pointer-events: none;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.85rem;
`;

const PanelTitleWrap = styled.div`
  h3 {
    margin: 0;
    color: var(--text-main);
    font-size: 1rem;
  }
`;

const LegendRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const LegendPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(217, 227, 240, 0.78);
  font-size: 0.74rem;
  font-weight: 700;
`;

const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(props) => props.$color};
  flex-shrink: 0;
`;

const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
`;

const FilterChip = styled.button`
  border: 1px solid ${(props) => (props.$active ? 'rgba(255, 122, 26, 0.35)' : 'rgba(255, 255, 255, 0.06)')};
  background: ${(props) => (props.$active ? 'rgba(255, 122, 26, 0.12)' : 'rgba(255, 255, 255, 0.03)')};
  color: ${(props) => (props.$active ? 'var(--brand-ice)' : 'var(--text-muted)')};
  border-radius: 10px;
  padding: 0.45rem 0.9rem;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.08);
  }
`;

const SplitGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 0.95fr);
  gap: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const StatusList = styled.div`
  display: grid;
  gap: 0.65rem;
`;

const StatusRow = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
`;

const StatusBar = styled.div`
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
`;

const StatusFill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  width: ${(props) => props.$width}%;
  background: ${(props) => props.$color};
  border-radius: inherit;
`;

const StatusLabel = styled.div`
  min-width: 84px;
  color: var(--text-main);
  font-size: 0.82rem;
  font-weight: 700;
`;

const StatusValue = styled.div`
  color: rgba(217, 227, 240, 0.82);
  font-size: 0.8rem;
  text-align: right;
  white-space: nowrap;
`;

const AgingGrid = styled.div`
  display: grid;
  gap: 0.7rem;
`;

const AgingCard = styled.div`
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  padding: 0.75rem 0.85rem;
  background: rgba(255, 255, 255, 0.035);
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease, background 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(249, 115, 22, 0.28);
  }

  ${(props) => props.$active && `
    border-color: rgba(249, 115, 22, 0.35);
    background: rgba(249, 115, 22, 0.12);
  `}
`;

const AgingInfo = styled.div`
  display: grid;
  gap: 0.08rem;

  strong {
    color: var(--text-main);
    font-size: 0.88rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.75rem;
  }
`;

const AgingAmount = styled.div`
  color: var(--text-main);
  font-size: 0.88rem;
  font-weight: 800;
  text-align: right;
`;

const ActionList = styled.div`
  display: grid;
  gap: 0.65rem;
`;

const ActionItem = styled.div`
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 14px;
  padding: 0.8rem 0.9rem;
  background: rgba(255, 255, 255, 0.035);
  display: grid;
  gap: 0.3rem;
`;

const ActionTitle = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;

  strong {
    color: var(--text-main);
    font-size: 0.84rem;
  }
`;

const ActionCopy = styled.p`
  margin: 0;
  color: rgba(217, 227, 240, 0.74);
  font-size: 0.78rem;
  line-height: 1.45;
`;

const SeverityPill = styled.span`
  padding: 0.28rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  color: ${(props) => props.$color};
  background: ${(props) => props.$background};
`;

const TableWrap = styled.div`
  overflow: auto;
`;

const TableState = styled.div`
  padding: 1rem 0.5rem 0.25rem;
  color: var(--text-muted);
  font-size: 0.82rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 4px;

  th,
  td {
    padding: 1rem 0.75rem;
    font-size: 0.85rem;
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: var(--text-muted);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 800;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  tbody tr {
    transition: all 0.2s ease;
  }

  tbody tr:hover td {
    background: rgba(255, 255, 255, 0.04);
  }

  tbody tr:hover td:first-child {
    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;
  }
  tbody tr:hover td:last-child {
    border-top-right-radius: 12px;
    border-bottom-right-radius: 12px;
  }
`;

const CompanyButton = styled.button`
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-main);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.18s ease;

  &:hover {
    color: var(--brand);
  }
`;

const AgentMeta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: rgba(217, 227, 240, 0.76);
`;

const EmptyState = styled.div`
  min-height: 260px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 1.5rem;
  color: var(--text-muted);
`;

const AreaChartVisual = React.memo(function AreaChartVisual({ data, animate }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="manager-open" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="manager-collected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--ok)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--ok)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="week" 
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} 
          axisLine={false} 
          tickLine={false} 
          dy={10}
        />
        <YAxis 
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }} 
          axisLine={false} 
          tickLine={false} 
          tickFormatter={formatCompactCurrency} 
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
        <Area 
          type="monotone" 
          dataKey="open" 
          name="Open Balance" 
          stroke="var(--brand)" 
          strokeWidth={3} 
          fill="url(#manager-open)" 
          isAnimationActive={animate} 
          animationDuration={800} 
        />
        <Area 
          type="monotone" 
          dataKey="collected" 
          name="Collected" 
          stroke="var(--ok)" 
          strokeWidth={3} 
          fill="url(#manager-collected)" 
          isAnimationActive={animate} 
          animationDuration={800} 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

const AgentBarVisual = React.memo(function AgentBarVisual({ data, animate, onSelectAgent }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
        onClick={(state) => {
          const nextAgent = state?.activePayload?.[0]?.payload?.agent;
          if (nextAgent) onSelectAgent?.(nextAgent);
        }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="agent" tick={{ fill: '#95a4bb', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#95a4bb', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="open" name="Open Balance" radius={[8, 8, 0, 0]} isAnimationActive={animate} animationDuration={450}>
          {data.map((entry) => (
            <Cell key={entry.agent} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

const StatusPieVisual = React.memo(function StatusPieVisual({ data, animate }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
          stroke="none"
          isAnimationActive={animate}
          animationDuration={450}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
});

export default function ManagerAnalytics({
  invoiceRows,
  aggregatedRows,
  selectedAgent,
  onSelectAgent,
  onOpenCompanyProfile,
  isManager = true
}) {
  const [quickFilter, setQuickFilter] = useState('all');
  const [drilldown, setDrilldown] = useState({ type: 'all', value: 'all' });

  const analytics = useMemo(() => {
    const baseInvoiceRows = invoiceRows || [];
    const latestWeek = Array.from(new Set(baseInvoiceRows.map((row) => String(row.weekLabel || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .at(-1) || null;

    const openInvoiceRows = baseInvoiceRows.filter((row) => {
      const status = normalizeStatus(row.status);
      return status === 'pending' || status === 'overdue';
    });

    const sortedOpenInvoices = [...openInvoiceRows].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    const topOpenIds = new Set(sortedOpenInvoices.slice(0, 12).map((row) => row.id));
    const allAggregatedRows = aggregatedRows || [];
    const topAggregatedIds = new Set(
      [...allAggregatedRows]
        .filter((row) => {
          const status = normalizeStatus(row.status);
          return status === 'pending' || status === 'overdue';
        })
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        .slice(0, 12)
        .map((row) => row.id)
    );

    const applyQuickFilter = (row, source = 'invoice') => {
      const status = normalizeStatus(row.status);
      if (quickFilter === 'overdue') return status === 'overdue';
      if (quickFilter === 'top_balances') return source === 'invoice' ? topOpenIds.has(row.id) : topAggregatedIds.has(row.id);
      if (quickFilter === 'latest_week') return latestWeek ? String(row.weekLabel || '').trim() === latestWeek : true;
      if (quickFilter === 'high_risk') return status === 'overdue' || getDaysPastDue(row.dueDate) >= 8;
      return true;
    };

    const filteredInvoiceBase = baseInvoiceRows.filter((row) => applyQuickFilter(row, 'invoice'));
    const filteredAggregatedBase = allAggregatedRows.filter((row) => applyQuickFilter(row, 'aggregated'));

    const cleanInvoiceRows = filteredInvoiceBase.filter((row) => {
      const status = normalizeStatus(row.status);
      return status !== 'no_invoice' && status !== 'inactive';
    });

    const statusTotals = {
      pending: 0,
      overdue: 0,
      paid: 0,
      inactive: 0
    };

    const agentMap = new Map();
    const weekMap = new Map();
    const agingMap = new Map([
      ['current', { label: 'Current', count: 0, amount: 0, color: '#06b6d4' }],
      ['1-7', { label: '1-7 days', count: 0, amount: 0, color: '#f59e0b' }],
      ['8-14', { label: '8-14 days', count: 0, amount: 0, color: '#f97316' }],
      ['15+', { label: '15+ days', count: 0, amount: 0, color: '#ef4444' }]
    ]);

    cleanInvoiceRows.forEach((row) => {
      const amount = Number(row.amount) || 0;
      const status = normalizeStatus(row.status);
      const agent = String(row.agentId || 'Unassigned').trim() || 'Unassigned';
      const week = String(row.weekLabel || 'Unknown week');

      statusTotals[status] += amount;

      const currentAgent = agentMap.get(agent) || { agent, open: 0, overdue: 0, paid: 0, accounts: 0 };
      currentAgent.accounts += 1;
      if (status === 'pending' || status === 'overdue') currentAgent.open += amount;
      if (status === 'overdue') currentAgent.overdue += amount;
      if (status === 'paid') currentAgent.paid += amount;
      agentMap.set(agent, currentAgent);

      const currentWeek = weekMap.get(week) || { week, open: 0, collected: 0, overdue: 0 };
      if (status === 'pending' || status === 'overdue') currentWeek.open += amount;
      if (status === 'overdue') currentWeek.overdue += amount;
      if (status === 'paid') currentWeek.collected += amount;
      weekMap.set(week, currentWeek);

      const daysPastDue = status === 'overdue' ? getDaysPastDue(row.dueDate) : 0;
      const bucketKey = status === 'overdue' ? getAgingBucket(daysPastDue) : 'current';
      const bucket = agingMap.get(bucketKey);
      bucket.count += 1;
      bucket.amount += amount;
    });

    const aggregated = filteredAggregatedBase;
    const openPortfolio = aggregated.filter((row) => {
      const status = normalizeStatus(row.status);
      return status === 'pending' || status === 'overdue';
    });

    const totalOpen = openPortfolio.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalOverdue = aggregated
      .filter((row) => normalizeStatus(row.status) === 'overdue')
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalCollected = cleanInvoiceRows
      .filter((row) => normalizeStatus(row.status) === 'paid')
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalAccounts = aggregated.length;
    const overdueAccounts = aggregated.filter((row) => normalizeStatus(row.status) === 'overdue').length;
    const paidAccounts = aggregated.filter((row) => normalizeStatus(row.status) === 'paid').length;
    const averageOpenPerAccount = totalAccounts ? totalOpen / totalAccounts : 0;
    const recoveryRate = totalCollected + totalOpen > 0 ? (totalCollected / (totalCollected + totalOpen)) * 100 : 0;
    const riskShare = totalOpen > 0 ? (totalOverdue / totalOpen) * 100 : 0;

    const agentData = Array.from(agentMap.values())
      .sort((a, b) => b.open - a.open)
      .map((row, index) => ({ ...row, color: AGENT_COLORS[index % AGENT_COLORS.length] }));

    const busiestAgent = agentData[0] || null;
    const mostAtRiskAgent = [...agentData].sort((a, b) => b.overdue - a.overdue)[0] || null;

    const weekTrendData = Array.from(weekMap.values()).sort((a, b) => a.week.localeCompare(b.week));
    const statusChartData = ['pending', 'overdue', 'paid', 'inactive']
      .map((key) => ({
        name: STATUS_META[key].label,
        value: statusTotals[key],
        color: STATUS_META[key].color,
        key
      }))
      .filter((item) => item.value > 0);

    const topAccounts = [...openPortfolio]
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 8)
      .map((row) => ({
        ...row,
        daysPastDue: normalizeStatus(row.status) === 'overdue' ? getDaysPastDue(row.dueDate) : 0
      }));

    const agentWorkload = agentData.slice(0, 6).map((row) => {
      const exposureRate = row.open > 0 ? (row.overdue / row.open) * 100 : 0;
      return {
        ...row,
        exposureRate
      };
    });

    const agingData = Array.from(agingMap.values());
    const largestAgingBucket = [...agingData].sort((a, b) => b.amount - a.amount)[0];

    const actionItems = [];

    if (mostAtRiskAgent && mostAtRiskAgent.overdue > 0) {
      actionItems.push({
        title: `${mostAtRiskAgent.agent} carries the largest overdue stack`,
        body: `${formatCurrency(mostAtRiskAgent.overdue)} is overdue under this queue. It is the cleanest place to focus calls first.`,
        severity: 'high'
      });
    }

    if (largestAgingBucket && largestAgingBucket.label !== 'Current' && largestAgingBucket.amount > 0) {
      actionItems.push({
        title: `Aging pressure is concentrated in ${largestAgingBucket.label}`,
        body: `${largestAgingBucket.count} records account for ${formatCurrency(largestAgingBucket.amount)} in that band. This is a good candidate for a dedicated follow-up block.`,
        severity: largestAgingBucket.label === '15+ days' ? 'high' : 'medium'
      });
    }

    if (recoveryRate < 45) {
      actionItems.push({
        title: 'Collection efficiency is still low',
        body: `${recoveryRate.toFixed(0)}% of the tracked portfolio is landing as collected. Consider surfacing faster reminders for the largest pending balances.`,
        severity: 'medium'
      });
    } else {
      actionItems.push({
        title: 'Collected share is healthy',
        body: `${recoveryRate.toFixed(0)}% of tracked value is already in paid status. The next gain likely comes from trimming overdue concentration, not chasing every account equally.`,
        severity: 'low'
      });
    }

    if (topAccounts[0]) {
      actionItems.push({
        title: `${topAccounts[0].company} is the single biggest open account`,
        body: `It represents ${formatCurrency(topAccounts[0].amount)}. A focused review on this account alone can move the portfolio faster than broad low-value outreach.`,
        severity: normalizeStatus(topAccounts[0].status) === 'overdue' ? 'high' : 'medium'
      });
    }

    const openConcentration = topAccounts.slice(0, 3).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    if (totalOpen > 0 && openConcentration / totalOpen >= 0.45) {
      actionItems.push({
        title: 'Open balance is concentrated in a few accounts',
        body: `${Math.round((openConcentration / totalOpen) * 100)}% of the open balance sits in the top 3 accounts.`,
        severity: 'high'
      });
    }

    const drilldownAccounts = openPortfolio.filter((row) => {
      if (drilldown.type === 'status') return normalizeStatus(row.status) === drilldown.value;
      if (drilldown.type === 'aging') return getAgingBucket(getDaysPastDue(row.dueDate)) === drilldown.value;
      return true;
    }).sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 10);

    return {
      latestWeek,
      totalOpen,
      totalOverdue,
      totalCollected,
      totalAccounts,
      overdueAccounts,
      paidAccounts,
      averageOpenPerAccount,
      recoveryRate,
      riskShare,
      busiestAgent,
      mostAtRiskAgent,
      statusChartData,
      weekTrendData,
      topAccounts,
      drilldownAccounts,
      agentWorkload,
      agingData,
      actionItems: actionItems.slice(0, 4),
      agentData,
      activeFiltersLabel: {
        all: 'All records',
        overdue: 'Overdue only',
        top_balances: 'Top balances',
        latest_week: latestWeek ? latestWeek : 'Latest week',
        high_risk: 'High risk'
      }[quickFilter],
      animateCharts: cleanInvoiceRows.length <= 180
    };
  }, [invoiceRows, aggregatedRows, quickFilter, drilldown]);

  if (!analytics.totalAccounts && !analytics.statusChartData.length) {
    return (
      <>
        <RechartsVisualFix />
        <Panel>
          <EmptyState>
            <div>
              <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>No analytics data yet</h3>
              <p style={{ marginBottom: 0 }}>As soon as invoices and balances load, this section will show agent exposure, aging, collections trend, and follow-up priorities.</p>
            </div>
          </EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <>
      <RechartsVisualFix />
      <AnalyticsShell>
        <SummaryStrip>
          <SummaryCard>
            <SummaryLabel>Selected Scope</SummaryLabel>
            <SummaryValue>{selectedAgent === 'all' ? 'All agents' : selectedAgent}</SummaryValue>
            <SummaryMeta>{analytics.totalAccounts} tracked accounts</SummaryMeta>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>Open Exposure</SummaryLabel>
            <SummaryValue>{formatCurrency(analytics.totalOpen)}</SummaryValue>
            <SummaryMeta>{analytics.overdueAccounts} overdue accounts</SummaryMeta>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>Collected Share</SummaryLabel>
            <SummaryValue>{analytics.recoveryRate.toFixed(0)}%</SummaryValue>
            <SummaryMeta>{formatCurrency(analytics.totalCollected)} paid</SummaryMeta>
          </SummaryCard>
          <SummaryCard>
            <SummaryLabel>Average Per Account</SummaryLabel>
            <SummaryValue>{formatCurrency(analytics.averageOpenPerAccount)}</SummaryValue>
            <SummaryMeta>{formatCurrency(analytics.totalOverdue)} overdue</SummaryMeta>
          </SummaryCard>
        </SummaryStrip>

        {isManager && (
          <UtilityBar>
            <UtilityGroup>
              <UtilityChip type="button" $active={quickFilter === 'all'} onClick={() => setQuickFilter('all')}>
                All
              </UtilityChip>
              <UtilityChip type="button" $active={quickFilter === 'overdue'} onClick={() => setQuickFilter('overdue')}>
                Overdue only
              </UtilityChip>
              <UtilityChip type="button" $active={quickFilter === 'top_balances'} onClick={() => setQuickFilter('top_balances')}>
                Top balances
              </UtilityChip>
              <UtilityChip type="button" $active={quickFilter === 'latest_week'} onClick={() => setQuickFilter('latest_week')}>
                Latest week
              </UtilityChip>
              <UtilityChip type="button" $active={quickFilter === 'high_risk'} onClick={() => setQuickFilter('high_risk')}>
                High risk
              </UtilityChip>
            </UtilityGroup>
          </UtilityBar>
        )}

        <KPIGrid>
          <KpiCard>
            <KpiTop>
              <div>
                <KpiLabel>Total Open Balance</KpiLabel>
                <KpiValue>{formatCurrency(analytics.totalOpen)}</KpiValue>
              </div>
              <KpiIcon $bg="rgba(249, 115, 22, 0.16)" $color="var(--brand)">
                <CircleDollarSign size={20} />
              </KpiIcon>
            </KpiTop>
            <KpiSubtext>Primary exposure still active in the current portfolio scope.</KpiSubtext>
          </KpiCard>

          <KpiCard>
            <KpiTop>
              <div>
                <KpiLabel>Overdue Balance</KpiLabel>
                <KpiValue>{formatCurrency(analytics.totalOverdue)}</KpiValue>
              </div>
              <KpiIcon $bg="rgba(239, 68, 68, 0.16)" $color="var(--danger)">
                <AlertTriangle size={20} />
              </KpiIcon>
            </KpiTop>
            <KpiSubtext>{analytics.riskShare.toFixed(0)}% of open value already missed the due window.</KpiSubtext>
          </KpiCard>

          <KpiCard>
            <KpiTop>
              <div>
                <KpiLabel>Paid Value</KpiLabel>
                <KpiValue>{formatCurrency(analytics.totalCollected)}</KpiValue>
              </div>
              <KpiIcon $bg="rgba(16, 185, 129, 0.16)" $color="var(--success)">
                <CheckCircle2 size={20} />
              </KpiIcon>
            </KpiTop>
            <KpiSubtext>What has already converted to paid status in this slice.</KpiSubtext>
          </KpiCard>

          <KpiCard>
            <KpiTop>
              <div>
                <KpiLabel>Accounts Needing Focus</KpiLabel>
                <KpiValue>{analytics.overdueAccounts}</KpiValue>
              </div>
              <KpiIcon $bg="rgba(56, 189, 248, 0.16)" $color="var(--brand-blue)">
                <Clock3 size={20} />
              </KpiIcon>
            </KpiTop>
            <KpiSubtext>{analytics.paidAccounts} accounts are currently clear or paid.</KpiSubtext>
          </KpiCard>
        </KPIGrid>

        <MainGrid>
          <Column>
            <Panel>
              <PanelHeader>
                <PanelTitleWrap>
                  <h3>{isManager ? 'Agent Exposure Map' : 'My Portfolio Snapshot'}</h3>
                </PanelTitleWrap>
                {isManager && (
                  <LegendRow>
                    <LegendPill>
                      <Dot $color="#f97316" />
                      Open balance
                    </LegendPill>
                  </LegendRow>
                )}
              </PanelHeader>

              {isManager ? (
                <>
                  <FilterRow>
                    <FilterChip type="button" $active={selectedAgent === 'all'} onClick={() => onSelectAgent?.('all')}>
                      All agents
                    </FilterChip>
                    {analytics.agentData.slice(0, 5).map((agent) => (
                      <FilterChip
                        key={agent.agent}
                        type="button"
                        $active={selectedAgent === agent.agent}
                        onClick={() => onSelectAgent?.(agent.agent)}
                      >
                        {agent.agent}
                      </FilterChip>
                    ))}
                  </FilterRow>

                  <AgentBarVisual data={analytics.agentData} animate={analytics.animateCharts} onSelectAgent={onSelectAgent} />
                </>
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topAccounts.slice(0, 6).map((item) => {
                        const status = normalizeStatus(item.status);
                        const meta = STATUS_META[status];
                        return (
                          <tr key={item.id}>
                            <td>
                              <CompanyButton type="button" onClick={() => onOpenCompanyProfile?.(item.company || item.clientName)}>
                                {item.company || item.clientName}
                              </CompanyButton>
                            </td>
                            <td>
                              <SeverityPill $color={meta.color} $background={`${meta.color}22`}>
                                {meta.label}
                              </SeverityPill>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(item.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  {analytics.topAccounts.length === 0 && <TableState>No portfolio balances available in this selection.</TableState>}
                </TableWrap>
              )}
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitleWrap>
                  <h3>Weekly Open vs Collected</h3>
                </PanelTitleWrap>
                <LegendRow>
                  <LegendPill>
                    <Dot $color="#f59e0b" />
                    Open
                  </LegendPill>
                  <LegendPill>
                    <Dot $color="#10b981" />
                    Collected
                  </LegendPill>
                </LegendRow>
              </PanelHeader>

              {analytics.weekTrendData.length > 1 ? (
                <AreaChartVisual data={analytics.weekTrendData} animate={analytics.animateCharts} />
              ) : (
                <TableState>
                  {analytics.latestWeek
                    ? `Current week ${analytics.latestWeek}: ${formatCurrency(analytics.totalOpen)} open and ${formatCurrency(analytics.totalCollected)} collected.`
                    : 'Not enough weekly history yet to draw a trend.'}
                </TableState>
              )}
            </Panel>

            {isManager && (
              <Panel>
                <PanelHeader>
                  <PanelTitleWrap>
                    <h3>Priority Accounts</h3>
                  </PanelTitleWrap>
                </PanelHeader>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Agent</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                        <th style={{ textAlign: 'right' }}>Days late</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topAccounts.map((item) => {
                        const status = normalizeStatus(item.status);
                        const meta = STATUS_META[status];
                        return (
                          <tr key={item.id}>
                            <td>
                              <CompanyButton type="button" onClick={() => onOpenCompanyProfile?.(item.company || item.clientName)}>
                                {item.company || item.clientName}
                              </CompanyButton>
                            </td>
                            <td>
                              <AgentMeta>
                                <UserRound size={14} />
                                {item.agentId || 'Unassigned'}
                              </AgentMeta>
                            </td>
                            <td>
                              <SeverityPill
                                $color={meta.color}
                                $background={`${meta.color}22`}
                              >
                                {meta.label}
                              </SeverityPill>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(item.amount)}</td>
                            <td style={{ textAlign: 'right', color: item.daysPastDue > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700 }}>
                              {item.daysPastDue > 0 ? item.daysPastDue : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              </Panel>
            )}
          </Column>

          <Column>
            <Panel>
              <PanelHeader>
                <PanelTitleWrap>
                  <h3>Status Mix</h3>
                </PanelTitleWrap>
              </PanelHeader>

              <SplitGrid>
                <StatusPieVisual data={analytics.statusChartData} animate={analytics.animateCharts} />
                <StatusList>
                  {analytics.statusChartData.map((item) => {
                    const total = analytics.statusChartData.reduce((sum, entry) => sum + entry.value, 0);
                    const width = total > 0 ? (item.value / total) * 100 : 0;
                    return (
                      <StatusRow key={item.key}>
                        <StatusLabel>{item.name}</StatusLabel>
                        <StatusBar>
                          <StatusFill $width={width} $color={item.color} />
                        </StatusBar>
                        <StatusValue>{formatCurrency(item.value)}</StatusValue>
                      </StatusRow>
                    );
                  })}
                </StatusList>
              </SplitGrid>
            </Panel>

            {isManager && (
              <Panel>
                <PanelHeader>
                  <PanelTitleWrap>
                    <h3>Agent Workload Snapshot</h3>
                  </PanelTitleWrap>
                </PanelHeader>

                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th style={{ textAlign: 'right' }}>Open</th>
                        <th style={{ textAlign: 'right' }}>Overdue</th>
                        <th style={{ textAlign: 'right' }}>Risk %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.agentWorkload.map((item) => (
                        <tr key={item.agent}>
                          <td>{item.agent}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(item.open)}</td>
                          <td style={{ textAlign: 'right', color: item.overdue > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 800 }}>
                            {formatCurrency(item.overdue)}
                          </td>
                          <td style={{ textAlign: 'right' }}>{item.exposureRate.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Panel>
            )}
          </Column>
        </MainGrid>
      </AnalyticsShell>
    </>
  );
}
