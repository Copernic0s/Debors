import React from 'react';
import styled from 'styled-components';
import { Bot, FileText, Loader2, CheckCircle2, AlertCircle, Zap, RefreshCw, Database } from 'lucide-react';

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
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--brand-cyan);
    background: rgba(255, 255, 255, 0.08);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SyncSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
`;

const SyncLabel = styled.span`
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 700;
  letter-spacing: 0.02em;
`;

const SyncButtonsGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const SyncBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid ${props => props.$borderColor || 'rgba(255, 255, 255, 0.12)'};
  color: ${props => props.$color || 'var(--text-main)'};

  &:hover:not(:disabled) {
    background: ${props => props.$bgColorHover || 'rgba(255, 255, 255, 0.08)'};
    border-color: ${props => props.$hoverBorderColor || 'var(--brand-cyan)'};
    transform: translateY(-2px);
    box-shadow: 0 4px 15px ${props => props.$glowColor || 'rgba(85, 214, 255, 0.15)'};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.4;
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
  syncAllBusy,
  onRunSync
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
          ? 'Sync All: refreshing Zoho, then CMP scraper runs in Chrome.'
          : cmpStatus?.message || 'Chrome runs in the background. Status updates every few seconds.'}
      </Message>

      <SyncSection>
        <SyncLabel>Trigger Sync Depth:</SyncLabel>
        <SyncButtonsGroup>
          <SyncBtn
            type="button"
            onClick={() => onRunSync && onRunSync('fast')}
            disabled={running || syncAllBusy || !runnerApiBase}
            $color="#e6fffa"
            $borderColor="rgba(16, 185, 129, 0.25)"
            $hoverBorderColor="#10b981"
            $bgColorHover="rgba(16, 185, 129, 0.1)"
            $glowColor="rgba(16, 185, 129, 0.2)"
          >
            <Zap size={13} color="#10b981" />
            Fast Sync (15d)
          </SyncBtn>
          <SyncBtn
            type="button"
            onClick={() => onRunSync && onRunSync('normal')}
            disabled={running || syncAllBusy || !runnerApiBase}
            $color="#fffaf0"
            $borderColor="rgba(255, 122, 26, 0.25)"
            $hoverBorderColor="var(--brand)"
            $bgColorHover="rgba(255, 122, 26, 0.1)"
            $glowColor="rgba(255, 122, 26, 0.2)"
          >
            <RefreshCw size={12} color="var(--brand-amber)" />
            Standard Sync (120d)
          </SyncBtn>
          <SyncBtn
            type="button"
            onClick={() => onRunSync && onRunSync('deep')}
            disabled={running || syncAllBusy || !runnerApiBase}
            $color="#fff5f5"
            $borderColor="rgba(239, 68, 68, 0.25)"
            $hoverBorderColor="var(--danger)"
            $bgColorHover="rgba(239, 68, 68, 0.1)"
            $glowColor="rgba(239, 68, 68, 0.2)"
          >
            <Database size={13} color="var(--danger)" />
            Deep Sync (365d)
          </SyncBtn>
        </SyncButtonsGroup>
      </SyncSection>

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
