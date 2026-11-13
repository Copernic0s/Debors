const canAccessCmpInvoicePdf = ({ scopes = [], invoiceAgentId, isBillingViewer = false }) => {
  if (isBillingViewer) return false;
  if (scopes.some((scope) => scope.is_manager === true)) return true;
  if (!invoiceAgentId) return false;
  return scopes.some((scope) => scope.agent_id === invoiceAgentId);
};

module.exports = { canAccessCmpInvoicePdf };
