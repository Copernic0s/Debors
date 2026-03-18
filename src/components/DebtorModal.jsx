import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, RefreshCw } from 'lucide-react';
import { BILLING_CYCLE_OPTIONS, BILLING_CYCLES, normalizeBillingCycle } from '../constants/billingCycles';
import ConfirmDialog from './ConfirmDialog';

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
  max-height: 90vh;
  display: flex;
  flex-direction: column;
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
  padding: 1rem 1.5rem;
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
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;

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
  gap: 0.35rem;

  label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  input, select, textarea {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.6rem 0.85rem;
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
    min-height: 60px;
  }
  
  option {
    background: var(--bg-2);
    color: var(--text-main);
  }
`;

const ModalFooter = styled.div`
  padding: 1rem 1.5rem;
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
  const knownCycles = new Set([...BILLING_CYCLE_OPTIONS, BILLING_CYCLES.MULTIPLE, BILLING_CYCLES.CS_BY_AGENT]);
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

export default function DebtorModal({ isOpen, onClose, onSave, onReset, debtor }) {
  const [formData, setFormData] = useState(() => createFormDataFromDebtor(debtor));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sun, 1: Mon, ..., 4: Thu, 5: Fri, 6: Sat

    let targetDueDay = null; // Day to set as due

    if (formData.billingCycle === BILLING_CYCLES.MONDAY_SUNDAY) {
      targetDueDay = 2; // Tuesday
    } else if (formData.billingCycle === BILLING_CYCLES.THURSDAY_WEDNESDAY) {
      targetDueDay = 5; // Friday
    } else if (formData.billingCycle === BILLING_CYCLES.TWICE) {
      // Twice: Monday statement (Thu-Sun) -> Due Tue. Thursday statement (Mon-Wed) -> Due Fri.
      // Logic: If today is Mon, Tue, Wed -> We are likely preparing for Thursday's invoice -> Due Fri.
      // If today is Thu, Fri, Sat, Sun -> We are likely preparing for Monday's invoice -> Due Tue.
      if (dayOfWeek >= 1 && dayOfWeek <= 3) targetDueDay = 5; // Mon-Wed -> Due Friday
      else targetDueDay = 2; // Thu-Sun -> Due Tuesday
    }

    if (targetDueDay !== null) {
      const resultDate = new Date(today);
      let diff = targetDueDay - today.getDay();
      if (diff <= 0) diff += 7; // Next occurrence
      resultDate.setDate(today.getDate() + diff);
      
      const suggestedDue = resultDate.toISOString().split('T')[0];
      if (formData.dueDate !== suggestedDue) {
        setFormData(prev => ({ ...prev, dueDate: suggestedDue }));
      }
    }
  }, [formData.billingCycle]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    let finalBillingCycle = formData.billingCycle === 'custom'
      ? formData.customBillingCycle.trim()
      : formData.billingCycle;

    if (formData.billingCycle === BILLING_CYCLES.TWICE) {
      finalBillingCycle = BILLING_CYCLES.TWICE;
    }

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
          <h3>{debtor ? 'Edit Debt Details' : 'New Debtor'}</h3>
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
                <option value={BILLING_CYCLES.MONDAY_SUNDAY}>{BILLING_CYCLES.MONDAY_SUNDAY}</option>
                <option value={BILLING_CYCLES.THURSDAY_WEDNESDAY}>{BILLING_CYCLES.THURSDAY_WEDNESDAY}</option>
                <option value={BILLING_CYCLES.TWICE}>Twice (custom days)</option>
                <option value="custom">Other (custom)</option>
              </select>
            </FormGroup>
          </FormRow>

          {formData.billingCycle === BILLING_CYCLES.TWICE && (
            <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.1)', fontSize: '0.75rem' }}>
              <div style={{ fontWeight: '700', color: 'var(--brand)', marginBottom: '0.4rem' }}>Twice Weekly Rule</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
                <li><strong>Thu Invoice:</strong> Mon-Wed trans (Due Fri 5pm)</li>
                <li><strong>Mon Invoice:</strong> Thu-Sun trans (Due Tue 5pm)</li>
              </ul>
            </div>
          )}

          {formData.billingCycle === BILLING_CYCLES.MONDAY_SUNDAY && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>
              * Invoice on Monday (Mon-Sun trans). Due Tuesday 5 PM ET.
            </div>
          )}
          
          {formData.billingCycle === BILLING_CYCLES.THURSDAY_WEDNESDAY && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>
              * Invoice on Thursday (Thu-Wed trans). Due Friday 5 PM ET.
            </div>
          )}

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
          {debtor && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ 
                marginRight: 'auto', 
                color: 'var(--brand)', 
                borderColor: 'rgba(56, 189, 248, 0.4)',
                background: 'rgba(56, 189, 248, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onClick={() => setShowResetConfirm(true)}
            >
              <RefreshCw size={14} /> Restaurar Datos Zoho
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="debtor-form" className="btn btn-primary">Save Changes</button>
        </ModalFooter>
      </ModalContent>

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          onReset(debtor.id);
          setShowResetConfirm(false);
        }}
        title="¿Restaurar datos de Zoho?"
        message="¿Estás seguro de que quieres descartar los cambios manuales y restaurar los datos del Sheet para este registro?"
        confirmText="Restaurar"
        cancelText="Cancelar"
      />
    </Overlay>
  );
}
