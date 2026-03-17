import React, { useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { BILLING_CYCLE_OPTIONS, BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;

  @media (max-width: 768px) {
    align-items: flex-start;
    padding: 1rem;
    overflow-y: auto;
  }
`;

const ModalContent = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: slideUp 0.3s ease-out;

  @media (max-width: 768px) {
    max-width: none;
    width: 100%;
    margin: 0;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ModalHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-main);
  }

  button {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: var(--text-main);
    }
  }
`;

const ModalBody = styled.form`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  input, select, textarea {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
    color: var(--text-main);
    font-family: 'Manrope', inherit;
    font-size: 0.875rem;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }
  
  option {
    background: var(--bg-2);
    color: var(--text-main);
  }
`;

const ModalFooter = styled.div`
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;

  @media (max-width: 768px) {
    padding: 1rem;

    .btn {
      flex: 1;
    }
  }
`;

const createDefaultFormData = () => ({
  id: `DB-${Math.floor(Math.random() * 10000)}`,
  clientName: '',
  company: '',
  amount: '',
  billingCycle: BILLING_CYCLES.UNSPECIFIED,
  customBillingCycle: '',
  dueDate: new Date().toISOString().split('T')[0],
  status: 'pending',
  agentId: '',
  invoiceNumber: '',
  notes: ''
});

const createFormDataFromDebtor = (debtor) => {
  if (!debtor) return createDefaultFormData();

  const incomingCycleRaw = String(debtor.billingCycle || '').trim();
  const incomingCycle = normalizeBillingCycle(incomingCycleRaw);
  const knownCycles = new Set([...BILLING_CYCLE_OPTIONS, BILLING_CYCLES.MULTIPLE]);
  const useCustomCycle = incomingCycleRaw && !knownCycles.has(incomingCycle);

  return {
    ...createDefaultFormData(),
    ...debtor,
    company: debtor.company || debtor.clientName || '',
    clientName: debtor.company || debtor.clientName || '',
    amount: debtor.amount ?? '',
    billingCycle: useCustomCycle ? 'custom' : incomingCycle,
    customBillingCycle: useCustomCycle ? incomingCycleRaw : ''
  };
};

export default function DebtorModal({ isOpen, onClose, onSave, debtor }) {
  const [formData, setFormData] = useState(() => createFormDataFromDebtor(debtor));

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalBillingCycle = formData.billingCycle === 'custom'
      ? formData.customBillingCycle.trim()
      : formData.billingCycle;

    const finalCompany = formData.clientName.trim();

    onSave({
      ...formData,
      company: finalCompany,
      clientName: finalCompany,
      amount: parseFloat(formData.amount),
      agentId: formData.agentId.trim(),
      billingCycle: finalBillingCycle
    });
  };

  return (
    <Overlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <h3>{debtor ? 'Edit Debt' : 'New Debtor'}</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </ModalHeader>
        <ModalBody id="debtor-form" onSubmit={handleSubmit}>
          <FormGroup>
            <label>Invoice Number</label>
            <input
              type="text"
              value={formData.invoiceNumber || ''}
              onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
              placeholder="Ex. INV-123456"
            />
          </FormGroup>

          <FormGroup>
            <label>Company</label>
            <input
              required
              type="text"
              value={formData.clientName}
              onChange={e => setFormData({ ...formData, clientName: e.target.value })}
              placeholder="Ex. TechCorp Solutions"
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <label>Balance ($)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </FormGroup>
            <FormGroup>
              <label>Billing Cycle</label>
              <select
                value={formData.billingCycle}
                onChange={e => setFormData({ ...formData, billingCycle: e.target.value })}
              >
                {BILLING_CYCLE_OPTIONS.map((cycle) => (
                  <option key={cycle} value={cycle}>{cycle}</option>
                ))}
                <option value="custom">Other (custom)</option>
              </select>
            </FormGroup>
          </FormRow>

          {formData.billingCycle === 'custom' && (
            <FormGroup>
              <label>Custom Billing Cycle</label>
              <input
                required
                type="text"
                value={formData.customBillingCycle}
                onChange={e => setFormData({ ...formData, customBillingCycle: e.target.value })}
                placeholder="Ex. Friday cycle / custom agreement"
              />
            </FormGroup>
          )}

          <FormRow>
            <FormGroup>
              <label>Payment Due Date (optional)</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </FormGroup>
            <FormGroup>
              <label>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </FormGroup>
          </FormRow>

          <FormGroup>
            <label>Assigned Agent</label>
            <input
              required
              type="text"
              value={formData.agentId}
              onChange={e => setFormData({ ...formData, agentId: e.target.value })}
              placeholder="Ex. Guidiana Puentes"
            />
          </FormGroup>

          <FormGroup>
            <label>Notes (Optional)</label>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Payment notes, commitments, follow-up comments..."
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="debtor-form" className="btn btn-primary">Save Changes</button>
        </ModalFooter>
      </ModalContent>
    </Overlay>
  );
}
