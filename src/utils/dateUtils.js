export const getDayStartLocal = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  const dayStart = getDayStartLocal();
  const parsed = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed < dayStart;
};

export const getDueDateStatus = (status, dueDate) => {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'paid' || raw === 'no_invoice') return raw;
  if (raw.includes('paid') || raw.includes('pagado') || raw.includes('cobrado')) return 'paid';
  if (raw.includes('overdue') || raw.includes('mora') || raw.includes('vencido')) return 'overdue';
  if (isOverdue(dueDate)) return 'overdue';
  return 'pending';
};
