const normalizeId = (value) => String(value || '').trim();

const isInvoiceInRunScope = (row, { scopeAgentIds, cutoffDate }) => {
  const agentId = normalizeId(row.agent_id);
  if (!agentId || !scopeAgentIds.includes(agentId)) return false;

  const status = String(row.status || 'pending').toLowerCase();
  const balance = Number(row.remaining_amount ?? row.amount) || 0;
  if (status !== 'paid' || balance > 0) return true;
  return Boolean(row.invoice_date && row.invoice_date >= cutoffDate);
};

const planReconciliation = ({
  currentRows,
  incomingRows,
  status,
  truncated,
  rowsExtracted,
  minRatio = 0.5,
  scopeAgentIds,
  cutoffDate
}) => {
  const inScope = currentRows.filter((row) => isInvoiceInRunScope(row, { scopeAgentIds, cutoffDate }));
  const incomingIds = new Set(incomingRows.map((row) => normalizeId(row.id)));
  const enoughCoverage = rowsExtracted >= inScope.length * minRatio;
  const eligible = status === 'complete'
    && truncated === false
    && rowsExtracted > 0
    && enoughCoverage
    && scopeAgentIds.length > 0;

  return {
    eligible,
    previousCurrentCount: inScope.length,
    closedIds: eligible
      ? inScope.filter((row) => !incomingIds.has(normalizeId(row.id))).map((row) => row.id)
      : []
  };
};

module.exports = { isInvoiceInRunScope, planReconciliation };
