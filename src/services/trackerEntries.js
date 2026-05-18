import { supabase } from '../lib/supabase';

export const fetchTrackerEntries = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('tracker_entries')
    .select('id,date,company,agent,task,status,notes,created_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) {
    console.error('[Tracker] Failed to fetch tracker_entries:', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};

export const mergeTrackerEntries = (sheetRows, entries) => {
  const base = Array.isArray(sheetRows) ? sheetRows : [];
  const extra = Array.isArray(entries) ? entries : [];
  if (extra.length === 0) return base;

  const existingIds = new Set(base.map((r) => String(r?.id || '').trim()).filter(Boolean));
  const merged = [...base];
  extra.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (!id || existingIds.has(id)) return;
    merged.push({
      id,
      date: row?.date || '',
      company: row?.company || '',
      agent: row?.agent || '',
      task: row?.task || '',
      status: row?.status || '',
      notes: row?.notes || ''
    });
  });
  return merged;
};

