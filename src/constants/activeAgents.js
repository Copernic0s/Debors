import activeAgents from '../../config/active-agents.json';

const normalizeAgentName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const activeAgentByKey = new Map(activeAgents.map((agent) => [normalizeAgentName(agent), agent]));

export const canonicalActiveAgent = (agentName) => activeAgentByKey.get(normalizeAgentName(agentName)) || null;

export const canonicalActiveAgents = (agentNames) => Array.from(new Set(
  String(agentNames || '')
    .split(',')
    .map((agentName) => canonicalActiveAgent(agentName.trim()))
    .filter(Boolean)
));

export const isActiveAgent = (agentName) => canonicalActiveAgent(agentName) !== null;

export { activeAgents };
