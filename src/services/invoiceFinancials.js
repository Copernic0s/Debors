const toCents = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

export const centsToAmount = (cents) => Number(cents || 0) / 100;

export const invoiceFinancials = (row = {}) => {
  const status = String(row.status || '').toLowerCase();
  const settled = status === 'paid' || status === 'inactive';
  const amount = toCents(row.amount);
  const invoicedInput = toCents(row.totalAmount);
  const paidInput = toCents(row.totalPaid);
  const remainingInput = toCents(row.remainingAmount);

  const invoiced = invoicedInput ?? amount ?? 0;
  const due = settled
    ? 0
    : remainingInput ?? (
      paidInput !== null && invoicedInput !== null
        ? Math.max(invoicedInput - paidInput, 0)
        : amount ?? 0
    );
  const paid = paidInput ?? (settled ? invoiced : Math.max(invoiced - due, 0));
  const financialMismatch = invoicedInput !== null &&
    Math.abs(invoiced - paid - due) > 1;

  return { invoiced, paid, due, financialMismatch };
};

export const sortInvoicesNewestFirst = (rows = []) => [...rows].sort((a, b) => {
  const timestamp = (row) => {
    const value = row.invoiceDate || row.lastInvoicedDate || row.dueDate || row.syncedAt;
    const parsed = value ? Date.parse(value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return timestamp(b) - timestamp(a) ||
    String(a.invoiceNumber || a.id).localeCompare(String(b.invoiceNumber || b.id));
});
