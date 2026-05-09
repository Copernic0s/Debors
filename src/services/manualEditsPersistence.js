export const MANUAL_EDITS_TABLE = 'manual_edits';

const STREAK_PATTERN = /\[streak:(\d+)\]/;

export const mapDbEditToManualEdit = (edit) => ({
  ...edit,
  company: edit.company,
  clientName: edit.company,
  agentId: edit.agent_id,
  dueDate: edit.due_date,
  billingCycle: edit.billing_cycle,
  lastInvoicedDate: edit.last_invoiced_date,
  lastNoUsageDate: edit.last_no_usage_date,
  email: edit.email || '',
  noUsageCount: (edit.notes || '').match(STREAK_PATTERN)?.[1]
    ? Number((edit.notes || '').match(STREAK_PATTERN)[1])
    : (Number(edit.no_usage_count) || 0),
  invoiceNumber: edit.invoice_number,
  notes: (edit.notes || '').replace(STREAK_PATTERN, '').trim(),
  __isNew: edit.is_new,
  __deleted: edit.is_deleted
});

export const buildManualEditUpserts = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.id)
    .map((row) => ({
      id: String(row.id),
      company: row.company || row.clientName || null,
      agent_id: row.agentId || null,
      amount: Number(row.amount) || 0,
      status: String(row.status || 'pending'),
      due_date: row.dueDate || null,
      last_invoiced_date: row.lastInvoicedDate || null,
      last_no_usage_date: row.lastNoUsageDate || null,
      billing_cycle: row.billingCycle || null,
      invoice_number: row.invoiceNumber || null,
      is_new: Boolean(row.__isNew),
      is_deleted: Boolean(row.__deleted),
      updated_at: new Date().toISOString(),
      notes:
        (row.notes || '').replace(STREAK_PATTERN, '').trim() +
        (row.noUsageCount > 0 ? ` [streak:${row.noUsageCount}]` : '')
    }));

export const findLegacyDueDateRepairs = (manualEdits) =>
  Object.values(manualEdits || {})
    .filter((edit) => edit.lastInvoicedDate && (!edit.dueDate || String(edit.dueDate).trim() === ''))
    .map((item) => {
      const invDate = new Date(`${item.lastInvoicedDate}T00:00:00`);
      invDate.setDate(invDate.getDate() + 1);
      const due = invDate.toISOString().split('T')[0];
      return { ...item, dueDate: due };
    });
