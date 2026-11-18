import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, Clock3, RefreshCw } from 'lucide-react';
import { countRowsRefreshedByRun, countStaleOpenCmpInvoices } from '../utils/cmpFreshness';

const Panel = styled.section`
  margin: 0 2rem 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(85, 214, 255, 0.18);
  border-radius: 8px;
  background: rgba(8, 18, 34, 0.42);

  @media (max-width: 900px) {
    margin: 0 1rem 1rem;
  }
`;

const Heading = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.55rem;
  color: var(--text-main);
  font-size: 0.82rem;
  font-weight: 700;
`;

const Metrics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 1.25rem;
  color: var(--text-muted);
  font-size: 0.76rem;

  strong { color: var(--brand-cyan); }
`;

const Warning = styled.p`
  margin: 0.55rem 0 0;
  color: var(--warn);
  font-size: 0.76rem;
`;

const formatTimestamp = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Bogota'
  }).format(date);
};

export default function CmpFreshnessPanel({
  rows = [],
  totalCurrent = 0,
  latestRunId,
  lastCheckedAt,
  partial = false,
  loadError = ''
}) {
  const refreshed = countRowsRefreshedByRun(rows, latestRunId);
  const staleOpen = countStaleOpenCmpInvoices(rows);

  return (
    <Panel aria-label="CMP data freshness">
      <Heading><RefreshCw size={14} /> CMP data freshness</Heading>
      <Metrics>
        <span>Rows in most recent observed run: <strong>{latestRunId ? refreshed : '--'} / {totalCurrent} current</strong></span>
        <span><Clock3 size={13} style={{ verticalAlign: 'middle' }} /> Most recent invoice check: <strong>{formatTimestamp(lastCheckedAt)}</strong></span>
        <span><AlertTriangle size={13} style={{ verticalAlign: 'middle', color: staleOpen ? 'var(--warn)' : 'var(--text-muted)' }} /> Open invoices not verified in 72+ hours: <strong>{staleOpen}</strong></span>
      </Metrics>
      {partial && (
        <Warning role="status">
          CMP data may be incomplete{loadError ? `: ${loadError}` : '.'} Freshness is calculated from the invoices this account can currently read.
        </Warning>
      )}
    </Panel>
  );
}
