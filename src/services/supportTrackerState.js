const TRACKER_FOLLOW_UP_STORAGE_KEY = 'debors-support-followups-v1';
const ACCESS_FEATURE_OVERRIDE_STORAGE_KEY = 'debors-access-feature-overrides-v1';

const normalizeTrackerKeyPart = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const buildTrackerRowId = (row, index = 0) => {
  if (row?.id) return String(row.id);

  const parts = [
    row?.date,
    row?.company || row?.customer || row?.clientName,
    row?.task,
    row?.agent || row?.agentId
  ]
    .map(normalizeTrackerKeyPart)
    .filter(Boolean);

  return parts.length > 0 ? `tracker-${parts.join('-')}` : `tracker-row-${index}`;
};

export const sanitizeTrackerComments = (comments) =>
  Array.isArray(comments)
    ? comments
        .filter(Boolean)
        .map((comment, index) => ({
          id: comment?.id || `comment-${index}`,
          author: String(comment?.author || 'Internal user').trim(),
          text: String(comment?.text || '').trim(),
          createdAt: comment?.createdAt || new Date().toISOString()
        }))
        .filter((comment) => comment.text)
    : [];

export const normalizeTrackerRows = (rows, followUpsById = {}) =>
  (Array.isArray(rows) ? rows : []).map((row, index) => {
    const id = buildTrackerRowId(row, index);
    const followUp = followUpsById[id] || null;
    const comments = sanitizeTrackerComments(followUp?.comments ?? row?.comments);

    return {
      ...row,
      id,
      status: followUp?.status || row?.status || 'Follow-up',
      owner: String(followUp?.owner ?? row?.owner ?? '').trim(),
      nextAction: String(followUp?.nextAction ?? row?.nextAction ?? '').trim(),
      followUpDue: String(followUp?.followUpDue ?? row?.followUpDue ?? '').trim(),
      comments,
      lastComment: comments.length > 0 ? comments[comments.length - 1] : row?.lastComment || null
    };
  });

export const readTrackerFollowUps = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(TRACKER_FOLLOW_UP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[Support Tracker] Failed to restore saved follow-ups:', error);
    return {};
  }
};

export const writeTrackerFollowUps = (followUpsById) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(TRACKER_FOLLOW_UP_STORAGE_KEY, JSON.stringify(followUpsById));
  } catch (error) {
    console.error('[Support Tracker] Failed to persist follow-ups:', error);
  }
};

export const readAccessFeatureOverrides = () => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(ACCESS_FEATURE_OVERRIDE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[Access Controls] Failed to restore feature overrides:', error);
    return {};
  }
};

export const writeAccessFeatureOverrides = (overrides) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ACCESS_FEATURE_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.error('[Access Controls] Failed to persist feature overrides:', error);
  }
};
