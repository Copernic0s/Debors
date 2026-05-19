import React from 'react';
import styled from 'styled-components';
import { Bot, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const Panel = styled.div`
  margin: 0 2rem 1rem;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  border: 1px solid rgba(85, 214, 255, 0.2);
  background: rgba(8, 18, 34, 0.55);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  @media (max-width: 900px) {
    margin: 0 1rem 1rem;
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Title = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: var(--text-main);
  font-size: 0.9rem;
`;

const Message = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.45;
`;

const Meta = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--text-muted);

  strong {
    color: var(--brand-cyan);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: var(--brand-cyan);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${(p) => (p.$tone === 'ok' ? '#34d399' : p.$tone === 'err' ? '#f87171' : '#fbbf24')};
  background: ${(p) =>
    p.$tone === 'ok'
      ? 'rgba(52, 211, 153, 0.12)'
      : p.$tone === 'err'
        ? 'rgba(248, 113, 113, 0.12)'
        : 'rgba(251, 191, 36, 0.12)'};
`;

const formatTime = (value) => {
  if (!value) return '--';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export default function CmpSyncPanel({
  runnerApiBase,
  cmpStatus,
  onRefreshStatus,
  onShowLog,
  lastCmpSyncAt,
  cmpInvoiceCount,
  syncAllBusy
}) {
  const running = Boolean(cmpStatus?.running);
  const phase = String(cmpStatus?.phase || 'idle');
  const error = cmpStatus?.error;
  const tone = error ? 'err' : running ? 'warn' : phase === 'done' ? 'ok' : 'warn';

  return (
    <Panel>
      <Row>
        <Title>
          <Bot size={16} color="var(--brand-cyan)" />
          CMP sync
          <StatusPill $tone={tone}>
            {running ? <Loader2 size={12} className="spin" /> : error ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
            {running ? 'Running' : error ? 'Error' : phase === 'done' ? 'Ready' : 'Idle'}
          </StatusPill>
        </Title>
        <Actions>
          <ActionBtn type="button" onClick={onShowLog} disabled={!runnerApiBase}>
            <FileText size={14} />
            Log
          </ActionBtn>
          <ActionBtn type="button" onClick={onRefreshStatus} disabled={!runnerApiBase}>
            Refresh status
          </ActionBtn>
        </Actions>
      </Row>

      <Message>
        {syncAllBusy
          ? 'Sync All: refreshing Zoho, then CMP scraper runs in Chrome (Profile 8, minimized).'
          : cmpStatus?.message || 'Chrome runs in the background. Status updates every few seconds.'}
      </Message>

      <Meta>
        <span>Page: <strong>{cmpStatus?.page || 0}</strong></span>
        <span>Invoices found: <strong>{cmpStatus?.invoicesFound ?? 0}</strong></span>
        <span>Stored in cloud: <strong>{cmpInvoiceCount ?? 0}</strong></span>
        <span>Last CMP upload: <strong>{formatTime(lastCmpSyncAt)}</strong></span>
      </Meta>

      <style>{`
        .spin { animation: cmpSpin 1s linear infinite; }
        @keyframes cmpSpin { 100% { transform: rotate(360deg); } }
      `}</style>
    </Panel>
  );
}
