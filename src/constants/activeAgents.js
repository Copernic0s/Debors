import activeAgents from '../../config/active-agents.json';

const normalizeAgentName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const activeAgentKeys = new Set(activeAgents.map(normalizeAgentName));

export const isActiveAgent = (agentName) => activeAgentKeys.has(normalizeAgentName(agentName));

export { activeAgents };
