const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccessCmpInvoicePdf } = require('./cmpPdfAuthorization.cjs');

test('manager can request a CMP invoice PDF', () => {
  assert.equal(canAccessCmpInvoicePdf({ scopes: [{ is_manager: true }], invoiceAgentId: null }), true);
});

test('agent can request a PDF only for an exact assigned agent scope', () => {
  const scopes = [{ agent_id: 'angee rincon', is_manager: false }];
  assert.equal(canAccessCmpInvoicePdf({ scopes, invoiceAgentId: 'angee rincon' }), true);
  assert.equal(canAccessCmpInvoicePdf({ scopes, invoiceAgentId: 'kevin ruiz' }), false);
  assert.equal(canAccessCmpInvoicePdf({ scopes, invoiceAgentId: null }), false);
});

test('billing viewer cannot request PDFs, even if a stale agent scope exists', () => {
  assert.equal(canAccessCmpInvoicePdf({ scopes: [], invoiceAgentId: 'angee rincon', isBillingViewer: true }), false);
  assert.equal(canAccessCmpInvoicePdf({
    scopes: [{ agent_id: 'angee rincon', is_manager: true }],
    invoiceAgentId: 'angee rincon',
    isBillingViewer: true
  }), false);
});
