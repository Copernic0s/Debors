import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  AlertCircle,
  CalendarRange,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ClipboardList,
  Download,
  MessageSquare,
  PanelRightOpen,
  Save,
  Search,
  X
} from 'lucide-react';

const TrackerContainer = styled.div`
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid var(--glass-border);
  border-radius: 28px;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  animation: islandEntrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;

  @keyframes islandEntrance {
    from { opacity: 0; transform: translateY(30px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    z-index: 1;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  h3 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--text-main);
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  padding: 0.7rem 1rem;
  font-family: 'Manrope', sans-serif;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(249, 115, 22, 0.4);
    color: var(--brand);
    transform: translateY(-1px);
  }
`;

const PageSizeSelect = styled.select`
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  color: var(--text-main);
  padding: 0.65rem 0.85rem;
  border-radius: 999px;
  font-family: 'Manrope', sans-serif;
  font-size: 0.88rem;
  outline: none;

  option {
    background: #0f172a;
    color: var(--text-main);
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
`;

const SummaryCard = styled.div`
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 1.25rem;
  display: flex;
  gap: 1.15rem;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-4px);
    box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.3);
  }

  svg {
    color: ${(props) => props.$accent || 'var(--brand)'};
    filter: drop-shadow(0 0 8px ${(props) => props.$accent || 'var(--brand-amber)'}44);
    flex-shrink: 0;
  }

  strong {
    display: block;
    font-size: 1.5rem;
    color: var(--text-main);
    font-family: 'Plus Jakarta Sans', sans-serif;
    letter-spacing: -0.02em;
  }

  span {
    color: var(--text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
`;

const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(150px, 0.8fr));
  gap: 0.85rem;

  @media (max-width: 1080px) {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const FieldShell = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  svg {
    position: absolute;
    left: 14px;
    color: var(--text-muted);
    pointer-events: none;
    transition: all 0.3s ease;
  }

  input,
  select {
    width: 100%;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.85rem 1rem;
    border-radius: 14px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.9rem;
    outline: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  input {
    padding-left: 2.8rem;
  }

  input:focus,
  select:focus {
    border-color: var(--brand);
    background: rgba(0, 0, 0, 0.35);
    box-shadow: 0 0 20px rgba(249, 115, 22, 0.1);
  }

  input:focus + svg {
    color: var(--brand);
    transform: scale(1.1);
  }

  option {
    background: #0f172a;
    color: var(--text-main);
  }
`;

const QueuePanel = styled.div`
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.03);
  padding: 1rem 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  h4 {
    margin: 0;
    color: var(--text-main);
    font-size: 1rem;
    font-weight: 800;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const InlineBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid ${(props) => props.$border || 'var(--glass-border)'};
  background: ${(props) => props.$bg || 'rgba(255, 255, 255, 0.04)'};
  color: ${(props) => props.$color || 'var(--text-main)'};
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const TickerBar = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 1080px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const TickerItem = styled.div`
  border-radius: 16px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.025);
  padding: 0.85rem 0.95rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;

  strong {
    color: var(--text-main);
    font-size: 1.05rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.84rem;
  }
`;

const QueueList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const QueueItem = styled.div`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.025);
  border-radius: 16px;
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const QueueTop = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;

  strong {
    color: var(--text-main);
    font-size: 0.95rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
`;

const QueueTask = styled.p`
  margin: 0;
  color: var(--text-main);
  font-size: 0.88rem;
  line-height: 1.45;
`;

const QueueMeta = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;

  span {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
`;

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);

  ::-webkit-scrollbar {
    height: 6px;
  }

  ::-webkit-scrollbar-thumb {
    background: var(--glass-border);
    border-radius: 4px;
  }
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;
  white-space: nowrap;

  th, td {
    padding: 1.25rem 1.15rem;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  tbody tr {
    background: rgba(255, 255, 255, 0.015);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 12px;

    &:hover {
      background: rgba(255, 255, 255, 0.045);
      transform: scale(1.002) translateY(-1px);
    }
  }

  td:first-child { border-top-left-radius: 16px; border-bottom-left-radius: 16px; }
  td:last-child { border-top-right-radius: 16px; border-bottom-right-radius: 16px; }

  td {
    font-size: 0.88rem;
    color: var(--text-main);
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
  }
`;

  th {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-muted);
    text-transform: uppercase;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tbody tr {
    transition: background 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.02);
    }
  }

  td {
    font-size: 0.9rem;
    color: var(--text-main);
  }

  .col-date {
    color: var(--text-muted);
    font-weight: 500;
    min-width: 115px;
  }

  .col-company {
    font-weight: 700;
    color: white;
    min-width: 220px;
  }

  .col-agent {
    min-width: 170px;
    color: var(--text-muted);
    font-weight: 600;
  }

  .col-task {
    white-space: normal;
    min-width: 260px;
    line-height: 1.45;
  }

  .col-notes {
    white-space: normal;
    min-width: 250px;
    color: var(--text-muted);
    font-size: 0.85rem;
    line-height: 1.45;
  }
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: ${(props) => props.$bg};
  color: ${(props) => props.$color};
  border: 1px solid ${(props) => props.$border};
  box-shadow: 0 0 15px ${(props) => props.$glow || 'transparent'};
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
    filter: brightness(1.1);
  }
`;

const PaginationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const PaginationInfo = styled.span`
  color: var(--text-muted);
  font-size: 0.88rem;
`;

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const PageButton = styled.button`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  border-radius: 10px;
  padding: 0.55rem 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--brand);
    color: var(--brand);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;

  h3 {
    margin: 0 0 1rem 0;
    color: var(--text-muted);
  }

  p {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 0;
  }
`;

const DetailPanel = styled.div`
  border: 1px solid var(--glass-border);
  border-radius: 28px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: var(--shadow-2xl);
  animation: panelSlide 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

  @keyframes panelSlide {
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
`;

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;

  h4 {
    margin: 0 0 0.25rem 0;
    color: var(--text-main);
    font-size: 1rem;
    font-weight: 800;
  }

  p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.84rem;
  }
`;

const DetailMeta = styled.div`
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    color: var(--text-main);
    border-color: rgba(255, 255, 255, 0.25);
  }
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 1rem;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const DetailBlock = styled.div`
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  padding: 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;

  h5 {
    margin: 0;
    font-size: 0.92rem;
    color: var(--text-main);
  }
`;

const DetailText = styled.p`
  margin: 0;
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.5;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const FieldGroup = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  input,
  select,
  textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--glass-border);
    color: var(--text-main);
    padding: 0.78rem 0.9rem;
    border-radius: 12px;
    font-family: 'Manrope', sans-serif;
    font-size: 0.88rem;
    outline: none;
    transition: all 0.2s ease;
    text-transform: none;
    letter-spacing: 0;
  }

  textarea {
    min-height: 104px;
    resize: vertical;
    line-height: 1.45;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: rgba(249, 115, 22, 0.35);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.08);
  }

  option {
    background: #0f172a;
    color: var(--text-main);
  }
`;

const FullWidthField = styled(FieldGroup)`
  grid-column: 1 / -1;
`;

const DetailActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(249, 115, 22, 0.3);
  background: rgba(249, 115, 22, 0.12);
  color: var(--brand);
  padding: 0.72rem 1rem;
  font-family: 'Manrope', sans-serif;
  font-size: 0.88rem;
  font-weight: 800;
  cursor: pointer;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: rgba(249, 115, 22, 0.18);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GhostButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  padding: 0.72rem 1rem;
  font-family: 'Manrope', sans-serif;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
`;

const CommentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const CommentCard = styled.div`
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  padding: 0.8rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  strong {
    color: var(--text-main);
    font-size: 0.82rem;
  }

  span {
    color: var(--text-muted);
    font-size: 0.78rem;
  }

  p {
    margin: 0;
    color: var(--text-main);
    font-size: 0.84rem;
    line-height: 1.45;
  }
`;

const ActionCellButton = styled.button`
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-main);
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;

  &:hover {
    border-color: rgba(249, 115, 22, 0.35);
    color: var(--brand);
  }
`;

const CYCLE_CLOSE_DAY = 26;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const normalizeStatusLabel = (status) => {
  const value = String(status || '').trim();
  if (!value) return 'Unspecified';

  const lower = value.toLowerCase();
  if (lower.includes('done') || lower.includes('complete') || lower.includes('listo') || lower.includes('completado')) return 'Completed';
  if (lower.includes('progress') || lower.includes('doing') || lower.includes('working')) return 'In Progress';
  if (lower.includes('pending') || lower.includes('follow') || lower.includes('waiting') || lower.includes('pendiente')) return 'Follow-up';
  return value;
};

const getStatusBadgeProps = (status) => {
  const normalized = normalizeStatusLabel(status).toLowerCase();

  if (normalized === 'completed') {
    return {
      $bg: 'rgba(34, 197, 94, 0.1)',
      $color: '#4ade80',
      $border: 'rgba(34, 197, 94, 0.2)',
      $glow: 'rgba(34, 197, 94, 0.1)',
      icon: <CheckCircle size={14} />
    };
  }

  if (normalized === 'follow-up') {
    return {
      $bg: 'rgba(234, 179, 8, 0.1)',
      $color: '#facc15',
      $border: 'rgba(234, 179, 8, 0.2)',
      $glow: 'rgba(234, 179, 8, 0.1)',
      icon: <AlertCircle size={14} />
    };
  }

  if (normalized === 'in progress') {
    return {
      $bg: 'rgba(56, 189, 248, 0.1)',
      $color: '#38bdf8',
      $border: 'rgba(56, 189, 248, 0.2)',
      $glow: 'rgba(56, 189, 248, 0.1)',
      icon: <Clock3 size={14} />
    };
  }

  return {
    $bg: 'rgba(255, 255, 255, 0.05)',
    $color: 'var(--text-main)',
    $border: 'var(--glass-border)',
    icon: null
  };
};

const parseIsoDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatShortDate = (value) => {
  const parsed = parseIsoDate(value);
  if (!parsed) return value || 'No date';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const sortByNewestDate = (items) =>
  [...items].sort((a, b) => {
    const aDate = String(a.date || '');
    const bDate = String(b.date || '');
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return String(a.company || '').localeCompare(String(b.company || ''));
  });

const getCycleWindow = (referenceDate = new Date()) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();
  const isBeforeOrOnClose = day <= CYCLE_CLOSE_DAY;

  const endDate = isBeforeOrOnClose
    ? new Date(year, month, CYCLE_CLOSE_DAY)
    : new Date(year, month + 1, CYCLE_CLOSE_DAY);

  const startDate = isBeforeOrOnClose
    ? new Date(year, month - 1, CYCLE_CLOSE_DAY + 1)
    : new Date(year, month, CYCLE_CLOSE_DAY + 1);

  const previousEnd = new Date(startDate);
  previousEnd.setDate(startDate.getDate() - 1);

  const previousStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth() - 1, CYCLE_CLOSE_DAY + 1);

  return {
    current: {
      start: startDate,
      end: endDate
    },
    previous: {
      start: previousStart,
      end: previousEnd
    }
  };
};

const isWithinWindow = (dateValue, range) => {
  const parsed = parseIsoDate(dateValue);
  if (!parsed || !range?.start || !range?.end) return false;
  return parsed >= range.start && parsed <= range.end;
};

const getAgingDays = (dateValue) => {
  const parsed = parseIsoDate(dateValue);
  if (!parsed) return null;
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((todayKey - parsed) / MS_PER_DAY));
};

const csvEscape = (value) => {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const buildCsv = (rows) => {
  const header = ['Date', 'Company', 'Agent', 'Task', 'Status', 'Owner', 'Next Action', 'Follow-up Due', 'Latest Comment', 'Notes'];
  const body = rows.map((item) => [
    item.date || '',
    item.company || '',
    item.agentLabel || item.agent || '',
    item.task || '',
    item.statusLabel || '',
    item.owner || '',
    item.nextAction || '',
    item.followUpDue || '',
    item.lastComment?.text || '',
    item.notes || ''
  ]);

  return [header, ...body].map((row) => row.map(csvEscape).join(',')).join('\n');
};

const downloadCsv = (filename, rows) => {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SupportTracker = ({
  data = [],
  canManageEntries = false,
  canComment = false,
  currentUserEmail = '',
  onSaveFollowUp
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('current-cycle');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [detailDraft, setDetailDraft] = useState({
    status: 'Follow-up',
    owner: '',
    nextAction: '',
    followUpDue: '',
    newComment: ''
  });

  const cycleWindow = useMemo(() => getCycleWindow(new Date()), []);

  const normalizedData = useMemo(
    () =>
      sortByNewestDate(
        data.map((item, index) => ({
          ...item,
          id: item.id || `tracker-row-${index}`,
          statusLabel: normalizeStatusLabel(item.status),
          agentLabel: String(item.agent || 'Unassigned').trim() || 'Unassigned',
          agingDays: getAgingDays(item.date),
          owner: String(item.owner || '').trim(),
          nextAction: String(item.nextAction || '').trim(),
          followUpDue: String(item.followUpDue || '').trim(),
          comments: Array.isArray(item.comments) ? item.comments : [],
          lastComment: Array.isArray(item.comments) && item.comments.length > 0 ? item.comments[item.comments.length - 1] : item.lastComment || null
        }))
      ),
    [data]
  );

  const filterOptions = useMemo(() => {
    const statuses = Array.from(new Set(normalizedData.map((item) => item.statusLabel).filter(Boolean))).sort();
    const agents = Array.from(new Set(normalizedData.map((item) => item.agentLabel).filter(Boolean))).sort();

    return { statuses, agents };
  }, [normalizedData]);

  const filteredData = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return normalizedData.filter((item) => {
      const matchesSearch = term === '' ||
        String(item.company || '').toLowerCase().includes(term) ||
        String(item.task || '').toLowerCase().includes(term) ||
        String(item.notes || '').toLowerCase().includes(term) ||
        String(item.agentLabel || '').toLowerCase().includes(term) ||
        String(item.owner || '').toLowerCase().includes(term) ||
        String(item.nextAction || '').toLowerCase().includes(term) ||
        item.comments.some((comment) => String(comment?.text || '').toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'all' || item.statusLabel === statusFilter;
      const matchesAgent = agentFilter === 'all' || item.agentLabel === agentFilter;

      let matchesDate = true;
      if (dateFilter === 'current-cycle') {
        matchesDate = isWithinWindow(item.date, cycleWindow.current);
      } else if (dateFilter === 'previous-cycle') {
        matchesDate = isWithinWindow(item.date, cycleWindow.previous);
      } else if (dateFilter === 'last-30') {
        matchesDate = typeof item.agingDays === 'number' && item.agingDays <= 30;
      }

      return matchesSearch && matchesStatus && matchesAgent && matchesDate;
    });
  }, [normalizedData, searchTerm, statusFilter, agentFilter, dateFilter, cycleWindow]);

  const summary = useMemo(() => {
    const openItems = filteredData.filter((item) => item.statusLabel !== 'Completed').length;
    const attentionItems = filteredData.filter((item) =>
      item.statusLabel !== 'Completed' && typeof item.agingDays === 'number' && item.agingDays >= 7
    ).length;

    return {
      total: filteredData.length,
      openItems,
      attentionItems
    };
  }, [filteredData]);

  const cycleSummary = useMemo(() => {
    const currentCycleRows = normalizedData.filter((item) => isWithinWindow(item.date, cycleWindow.current));
    const openItems = currentCycleRows.filter((item) => item.statusLabel !== 'Completed').length;
    const accountsTouched = new Set(currentCycleRows.map((item) => item.company).filter(Boolean)).size;
    const agentsActive = new Set(currentCycleRows.map((item) => item.agentLabel).filter(Boolean)).size;
    const rowsWithComments = currentCycleRows.filter((item) => item.comments.length > 0).length;
    const endKey = new Date(cycleWindow.current.end);
    const today = new Date();
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntilClose = Math.ceil((endKey - todayKey) / MS_PER_DAY);

    return {
      openItems,
      accountsTouched,
      agentsActive,
      rowsWithComments,
      daysUntilClose
    };
  }, [normalizedData, cycleWindow]);

  const focusQueue = useMemo(() => {
    return sortByNewestDate(
      filteredData.filter((item) => item.statusLabel !== 'Completed')
    ).sort((a, b) => {
      const aScore = (a.statusLabel === 'Follow-up' ? 2 : 1) + (typeof a.agingDays === 'number' && a.agingDays >= 7 ? 2 : 0);
      const bScore = (b.statusLabel === 'Follow-up' ? 2 : 1) + (typeof b.agingDays === 'number' && b.agingDays >= 7 ? 2 : 0);
      return bScore - aScore;
    }).slice(0, 5);
  }, [filteredData]);

  const currentCycleRows = useMemo(
    () => normalizedData.filter((item) => isWithinWindow(item.date, cycleWindow.current)),
    [normalizedData, cycleWindow]
  );

  const selectedRecord = useMemo(
    () => normalizedData.find((item) => item.id === selectedRecordId) || null,
    [normalizedData, selectedRecordId]
  );

  const openRecord = (item) => {
    setSelectedRecordId(item.id);
    setDetailDraft({
      status: item.statusLabel || 'Follow-up',
      owner: item.owner || '',
      nextAction: item.nextAction || '',
      followUpDue: item.followUpDue || '',
      newComment: ''
    });
  };

  const handleSaveDetail = async () => {
    if (!selectedRecord || !onSaveFollowUp) return;
    const trimmedComment = detailDraft.newComment.trim();
    const nextComments = trimmedComment
      ? [
          ...(selectedRecord.comments || []),
          {
            id: `${selectedRecord.id}-${Date.now()}`,
            text: trimmedComment,
            author: currentUserEmail || 'Internal user',
            createdAt: new Date().toISOString()
          }
        ]
      : (selectedRecord.comments || []);

    await onSaveFollowUp({
      id: selectedRecord.id,
      company: selectedRecord.company,
      agent: selectedRecord.agentLabel,
      status: detailDraft.status,
      owner: detailDraft.owner,
      nextAction: detailDraft.nextAction,
      followUpDue: detailDraft.followUpDue,
      comments: nextComments
    });

    setDetailDraft((prev) => ({
      ...prev,
      newComment: ''
    }));
  };

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(pageStart, pageStart + pageSize);

  if (!data || data.length === 0) {
    return (
      <TrackerContainer>
        <EmptyState>
          <h3>No Support Logs Found</h3>
          <p>Add a "Tracker" sheet to your Zoho document with Date, Customer, Task, Status, Notes, and Agent columns.</p>
        </EmptyState>
      </TrackerContainer>
    );
  }

  const cycleStatusLabel = cycleSummary.daysUntilClose < 0
    ? 'Cycle closed'
    : cycleSummary.daysUntilClose === 0
      ? 'Closes today'
      : `${cycleSummary.daysUntilClose} day${cycleSummary.daysUntilClose === 1 ? '' : 's'} to close`;

  return (
    <TrackerContainer>
      <HeaderRow>
        <h3>Support Tracker</h3>

        <HeaderActions>
          <PageSizeSelect
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={30}>30 per page</option>
          </PageSizeSelect>

          <SecondaryButton type="button" onClick={() => downloadCsv('support-tracker-current-view.csv', filteredData)}>
            <Download size={16} />
            Export current view
          </SecondaryButton>

          <SecondaryButton type="button" onClick={() => downloadCsv('support-cycle-close.csv', currentCycleRows)}>
            <Download size={16} />
            Export cycle close
          </SecondaryButton>
        </HeaderActions>
      </HeaderRow>

      <SummaryGrid>
        <SummaryCard $accent="var(--brand)">
          <ClipboardList size={20} />
          <div>
            <strong>{summary.total}</strong>
            <span>Visible logs</span>
          </div>
        </SummaryCard>

        <SummaryCard $accent="#38bdf8">
          <Clock3 size={20} />
          <div>
            <strong>{summary.openItems}</strong>
            <span>Open items</span>
          </div>
        </SummaryCard>

        <SummaryCard $accent="#facc15">
          <AlertCircle size={20} />
          <div>
            <strong>{summary.attentionItems}</strong>
            <span>Need follow-up</span>
          </div>
        </SummaryCard>

        <SummaryCard $accent="#8b5cf6">
          <MessageSquare size={20} />
          <div>
            <strong>{currentCycleRows.filter((item) => item.comments.length > 0).length}</strong>
            <span>Items with comments</span>
          </div>
        </SummaryCard>
      </SummaryGrid>

      <FilterGrid>
        <FieldShell>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search company, task, notes, or agent..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </FieldShell>

        <FieldShell>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            {filterOptions.statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </FieldShell>

        <FieldShell>
          <select
            value={agentFilter}
            onChange={(e) => {
              setAgentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All agents</option>
            {filterOptions.agents.map((agent) => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
        </FieldShell>

        <FieldShell>
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="current-cycle">Current cycle</option>
            <option value="previous-cycle">Previous cycle</option>
            <option value="last-30">Last 30 days</option>
            <option value="all">All dates</option>
          </select>
        </FieldShell>
      </FilterGrid>

      <TickerBar>
        <TickerItem>
          <span>Cycle status</span>
          <InlineBadge
            $bg="rgba(249, 115, 22, 0.1)"
            $color="var(--brand)"
            $border="rgba(249, 115, 22, 0.2)"
          >
            <CalendarRange size={13} />
            {cycleStatusLabel}
          </InlineBadge>
        </TickerItem>
        <TickerItem>
          <span>Open this cycle</span>
          <strong>{cycleSummary.openItems}</strong>
        </TickerItem>
        <TickerItem>
          <span>Accounts touched</span>
          <strong>{cycleSummary.accountsTouched}</strong>
        </TickerItem>
        <TickerItem>
          <span>Agents active</span>
          <strong>{cycleSummary.agentsActive}</strong>
        </TickerItem>
        <TickerItem>
          <span>Commented this cycle</span>
          <strong>{cycleSummary.rowsWithComments}</strong>
        </TickerItem>
      </TickerBar>

      <QueuePanel>
        <SectionHeader>
          <h4>Follow-up Queue</h4>
          <InlineBadge>{focusQueue.length} active</InlineBadge>
        </SectionHeader>

        <QueueList>
          {focusQueue.length === 0 && (
            <PaginationInfo>No open follow-ups in this view.</PaginationInfo>
          )}

          {focusQueue.map((item) => {
            const badgeProps = getStatusBadgeProps(item.statusLabel);
            return (
              <QueueItem key={`focus-${item.id}`}>
                <QueueTop>
                  <div>
                    <strong>{item.company || 'Unknown'}</strong>
                    <span>{formatShortDate(item.date)} · {item.agentLabel}</span>
                  </div>
                  <StatusBadge {...badgeProps}>
                    {badgeProps.icon} {item.statusLabel}
                  </StatusBadge>
                </QueueTop>

                <QueueTask>{item.nextAction || item.task || 'No task provided'}</QueueTask>

                <QueueMeta>
                  <span>{typeof item.agingDays === 'number' ? `${item.agingDays} day${item.agingDays === 1 ? '' : 's'} open` : 'No aging data'}</span>
                  <span>{item.followUpDue ? `Due ${formatShortDate(item.followUpDue)}` : (item.owner ? `Owner ${item.owner}` : (item.lastComment?.text || item.notes || 'No notes'))}</span>
                </QueueMeta>

                <div>
                  <ActionCellButton type="button" onClick={() => openRecord(item)}>
                    <PanelRightOpen size={14} />
                    Follow-up
                  </ActionCellButton>
                </div>
              </QueueItem>
            );
          })}
        </QueueList>
      </QueuePanel>

      {selectedRecord && (
        <DetailPanel>
          <DetailHeader>
            <div>
              <h4>{selectedRecord.company || 'Unknown company'}</h4>
              <p>{selectedRecord.agentLabel} · {formatShortDate(selectedRecord.date)} · {selectedRecord.task || 'No task provided'}</p>
            </div>

            <DetailMeta>
              <StatusBadge {...getStatusBadgeProps(detailDraft.status)}>
                {getStatusBadgeProps(detailDraft.status).icon} {detailDraft.status}
              </StatusBadge>
              <CloseButton type="button" onClick={() => setSelectedRecordId('')}>
                <X size={16} />
              </CloseButton>
            </DetailMeta>
          </DetailHeader>

          <DetailGrid>
            <DetailBlock>
              <h5>Follow-up details</h5>
              <DetailText>{selectedRecord.notes || 'No tracker notes from source.'}</DetailText>

              <FormGrid>
                <FieldGroup>
                  Status
                  <select
                    value={detailDraft.status}
                    disabled={!canManageEntries}
                    onChange={(e) => setDetailDraft((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </FieldGroup>

                <FieldGroup>
                  Owner
                  <input
                    type="text"
                    placeholder="Assigned owner"
                    value={detailDraft.owner}
                    disabled={!canManageEntries}
                    onChange={(e) => setDetailDraft((prev) => ({ ...prev, owner: e.target.value }))}
                  />
                </FieldGroup>

                <FieldGroup>
                  Follow-up due
                  <input
                    type="date"
                    value={detailDraft.followUpDue}
                    disabled={!canManageEntries}
                    onChange={(e) => setDetailDraft((prev) => ({ ...prev, followUpDue: e.target.value }))}
                  />
                </FieldGroup>

                <FullWidthField>
                  Next action
                  <textarea
                    placeholder="Define the next collection or support step..."
                    value={detailDraft.nextAction}
                    disabled={!canManageEntries}
                    onChange={(e) => setDetailDraft((prev) => ({ ...prev, nextAction: e.target.value }))}
                  />
                </FullWidthField>

                <FullWidthField>
                  Comment
                  <textarea
                    placeholder={canComment ? 'Leave an internal note for the next touchpoint...' : 'Comments are not available for this user.'}
                    value={detailDraft.newComment}
                    disabled={!canComment}
                    onChange={(e) => setDetailDraft((prev) => ({ ...prev, newComment: e.target.value }))}
                  />
                </FullWidthField>
              </FormGrid>
            </DetailBlock>

            <DetailBlock>
              <h5>Comment history</h5>
              <CommentList>
                {selectedRecord.comments.length === 0 && (
                  <DetailText>No internal comments yet.</DetailText>
                )}
                {selectedRecord.comments.slice().reverse().map((comment) => (
                  <CommentCard key={comment.id || `${comment.author}-${comment.createdAt}`}>
                    <strong>{comment.author || 'Internal user'}</strong>
                    <span>{formatDateTime(comment.createdAt)}</span>
                    <p>{comment.text || ''}</p>
                  </CommentCard>
                ))}
              </CommentList>
            </DetailBlock>
          </DetailGrid>

          <DetailActions>
            <GhostButton type="button" onClick={() => setSelectedRecordId('')}>
              Close
            </GhostButton>
            <PrimaryButton
              type="button"
              disabled={!canComment && !canManageEntries}
              onClick={handleSaveDetail}
            >
              <Save size={16} />
              Save follow-up
            </PrimaryButton>
          </DetailActions>
        </DetailPanel>
      )}

      <TableWrapper>
        <StyledTable>
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Agent</th>
              <th>Task</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => {
              const badgeProps = getStatusBadgeProps(item.statusLabel);

              return (
                <tr key={item.id}>
                  <td className="col-date">{item.date || 'No date'}</td>
                  <td className="col-company">{item.company || 'Unknown'}</td>
                  <td className="col-agent">{item.agentLabel}</td>
                  <td className="col-task">{item.task || 'No task provided'}</td>
                  <td>
                    <StatusBadge {...badgeProps}>
                      {badgeProps.icon} {item.statusLabel}
                    </StatusBadge>
                  </td>
                  <td className="col-notes">{item.notes || 'No notes'}</td>
                  <td>
                    <ActionCellButton type="button" onClick={() => openRecord(item)}>
                      <PanelRightOpen size={14} />
                      {item.comments.length > 0 || item.nextAction || item.followUpDue ? 'Update' : 'Open'}
                    </ActionCellButton>
                  </td>
                </tr>
              );
            })}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No matches found for your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </StyledTable>
      </TableWrapper>

      <PaginationRow>
        <PaginationInfo>
          Showing {filteredData.length === 0 ? 0 : pageStart + 1} to {Math.min(pageStart + pageSize, filteredData.length)} of {filteredData.length} records
        </PaginationInfo>

        <PaginationControls>
          <PageButton type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
            <ChevronLeft size={16} />
            Previous
          </PageButton>
          <PaginationInfo>Page {currentPage} of {totalPages}</PaginationInfo>
          <PageButton type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
            Next
            <ChevronRight size={16} />
          </PageButton>
        </PaginationControls>
      </PaginationRow>
    </TrackerContainer>
  );
};

export default SupportTracker;
