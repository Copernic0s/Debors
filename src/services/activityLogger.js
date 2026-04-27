import { supabase } from '../lib/supabase';

export const ACTIVITY_LOG_TABLE = 'activity_logs';

const isAndresViewer = (email) => String(email || '').toLowerCase().includes('andres');

const serializeValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value).trim();
};

export const shouldTrackUserActivity = (user) => {
  const email = String(user?.email || '').toLowerCase();
  if (!email) return false;
  return !isAndresViewer(email);
};

export const canViewActivityLogs = (user) => {
  const email = String(user?.email || '').toLowerCase();
  return isAndresViewer(email);
};

export const createActivityEntry = ({
  user,
  actionType,
  details,
  entityType = null,
  entityId = null,
  company = null,
  fieldName = null,
  oldValue = null,
  newValue = null
}) => ({
  user_email: String(user?.email || '').toLowerCase(),
  action_type: String(actionType || '').toUpperCase(),
  details: String(details || '').trim(),
  entity_type: entityType ? String(entityType) : null,
  entity_id: entityId ? String(entityId) : null,
  company: company ? String(company) : null,
  field_name: fieldName ? String(fieldName) : null,
  old_value: serializeValue(oldValue),
  new_value: serializeValue(newValue)
});

export const logActivityEntries = async (entries) => {
  const rows = (Array.isArray(entries) ? entries : [entries])
    .filter(Boolean)
    .filter((entry) => entry.user_email && entry.action_type && entry.details);

  if (!supabase || rows.length === 0) {
    return { success: false, logged: 0 };
  }

  const { error } = await supabase
    .from(ACTIVITY_LOG_TABLE)
    .insert(rows);

  if (error) {
    console.error('[Activity Logs] Insert failed:', error);
    return { success: false, logged: 0, error };
  }

  return { success: true, logged: rows.length };
};

export const logLoginActivity = async (user) => {
  if (!shouldTrackUserActivity(user)) return { success: false, logged: 0 };

  return logActivityEntries(
    createActivityEntry({
      user,
      actionType: 'LOGIN',
      details: `${user.email} logged into the platform`
    })
  );
};

export const fetchActivityLogs = async (limit = 50) => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(ACTIVITY_LOG_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Activity Logs] Fetch failed:', error);
    throw error;
  }

  return data || [];
};
