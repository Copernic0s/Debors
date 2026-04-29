const MANAGER_ROLE = 'manager';
const AGENT_ROLE = 'agent';

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseDelimitedList = (value) =>
  String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

const parseAgentScopeMap = (rawValue) => {
  const map = new Map();

  String(rawValue || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [emailPart, scopesPart] = entry.split('=');
      const email = String(emailPart || '').trim().toLowerCase();
      if (!email) return;
      map.set(email, parseDelimitedList(scopesPart));
    });

  return map;
};

const normalizeScopeValue = (value) => String(value || '').trim().toLowerCase();

const hasPrivilegedIdentityFallback = (email) => {
  const localPart = String(email || '').split('@')[0] || '';
  return localPart.includes('andres') || localPart.includes('kevin');
};

const canViewActivityLogsFallback = (email) => {
  const localPart = String(email || '').split('@')[0] || '';
  return localPart.includes('andres');
};

const getSpecialAgentScopeFallback = (email) => {
  if (email === 'hector.lomeli@theunitedtransports.com') {
    return ['hector lomeli', 'héctor lomelí'];
  }
  return [];
};

export const resolveAccessProfile = (user) => {
  const email = String(user?.email || '').trim().toLowerCase();
  const operationsEmails = new Set(
    [
      ...parseCsv(import.meta.env.VITE_OPERATIONS_EMAILS),
      ...parseCsv(import.meta.env.VITE_MANAGER_EMAILS)
    ].map((item) => item.toLowerCase())
  );
  const agentScopeMap = parseAgentScopeMap(import.meta.env.VITE_AGENT_SCOPE_MAP);

  const metadataRole = String(
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    ''
  ).trim().toLowerCase();

  const metadataAgentIds = [
    ...parseDelimitedList(user?.app_metadata?.agent_scope),
    ...parseDelimitedList(user?.user_metadata?.agent_scope),
    ...parseCsv(user?.app_metadata?.agent_ids),
    ...parseCsv(user?.user_metadata?.agent_ids),
    user?.app_metadata?.agent_id,
    user?.user_metadata?.agent_id,
    user?.app_metadata?.agent_name,
    user?.user_metadata?.agent_name
  ]
    .map(normalizeScopeValue)
    .filter(Boolean);

  const configuredAgentIds = (agentScopeMap.get(email) || []).map(normalizeScopeValue).filter(Boolean);
  const fallbackAgentIds = getSpecialAgentScopeFallback(email).map(normalizeScopeValue).filter(Boolean);
  const agentScope = Array.from(new Set([...metadataAgentIds, ...configuredAgentIds, ...fallbackAgentIds]));

  const normalizedRole = metadataRole === 'operations_access' ? MANAGER_ROLE : metadataRole === 'collections_access' ? AGENT_ROLE : metadataRole;
  const isManager = normalizedRole === MANAGER_ROLE || operationsEmails.has(email) || hasPrivilegedIdentityFallback(email);
  const role = isManager ? MANAGER_ROLE : AGENT_ROLE;

  return {
    role,
    email,
    agentScope,
    accessLabel: isManager ? 'Control Access' : 'Assigned Portfolio',
    canEditData: isManager,
    canDeleteData: isManager,
    canResetData: isManager,
    canSyncData: isManager,
    canUseInvoiceEntry: isManager,
    canEditInvoiceDetails: isManager,
    canCommentOnly: !isManager,
    canViewAllData: isManager,
    canViewSupportTracker: true,
    canViewInvoiceEntry: isManager,
    canViewActivityLogs: canViewActivityLogsFallback(email),
    hasScopedPortfolio: isManager ? true : agentScope.length > 0
  };
};

export const userCanAccessAgent = (accessProfile, agentId) => {
  if (accessProfile?.canViewAllData) return true;
  return accessProfile?.agentScope?.includes(normalizeScopeValue(agentId));
};

export { MANAGER_ROLE, AGENT_ROLE };
