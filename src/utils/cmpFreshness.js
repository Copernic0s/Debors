export const CMP_STALE_AFTER_MS = 72 * 60 * 60 * 1000;

export const isOpenCmpInvoice = (row) => {
  const balance = Number(row?.remainingAmount ?? row?.remaining_amount ?? row?.amount);
  return Number.isFinite(balance) && balance > 0;
};

export const getInvoiceFreshness = (row, now = Date.now(), staleAfterMs = CMP_STALE_AFTER_MS) => {
  const rawTimestamp = row?.syncedAt ?? row?.synced_at;
  const timestamp = rawTimestamp ? new Date(rawTimestamp) : null;
  const verifiedAt = timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null;
  const isOpen = isOpenCmpInvoice(row);
  const ageMs = verifiedAt ? Math.max(0, Number(now) - verifiedAt.getTime()) : null;
  const isUnverified = isOpen && !verifiedAt;

  return {
    verifiedAt,
    ageMs,
    isOpen,
    isUnverified,
    isStale: isOpen && (isUnverified || ageMs > staleAfterMs)
  };
};

export const countRowsRefreshedByRun = (rows = [], runId) => {
  if (!runId) return 0;
  const ids = new Set();
  rows.forEach((row) => {
    if (row?.syncRunId === runId && row.id !== undefined && row.id !== null) {
      ids.add(String(row.id));
    }
  });
  return ids.size;
};

export const countStaleOpenCmpInvoices = (rows = [], now = Date.now()) =>
  rows.filter((row) => getInvoiceFreshness(row, now).isStale).length;
