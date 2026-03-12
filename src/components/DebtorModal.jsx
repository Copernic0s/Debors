import React, { useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';

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
`;

const createDefaultFormData = () => ({
  id: `DB-${Math.floor(Math.random() * 10000)}`,
  clientName: '',
  amount: '',
  dueDate: new Date().toISOString().split('T')[0],
  status: 'pending',
  agentId: '',
  notes: ''
});

const createFormDataFromDebtor = (debtor) => {
  if (!debtor) return createDefaultFormData();
  return {
    ...createDefaultFormData(),
    ...debtor,
    amount: debtor.amount ?? ''
  };
};

export default function DebtorModal({ isOpen, onClose, onSave, debtor }) {
  const [formData, setFormData] = useState(() => createFormDataFromDebtor(debtor));

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      amount: parseFloat(formData.amount),
      agentId: formData.agentId.trim()
    });
  };

  return (
    <Overlay onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <h3>{debtor ? 'Editar Deuda' : 'Nuevo Deudor'}</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </ModalHeader>
        <ModalBody id="debtor-form" onSubmit={handleSubmit}>
          <FormGroup>
            <label>Nombre del Cliente</label>
            <input
              required
              type="text"
              value={formData.clientName}
              onChange={e => setFormData({ ...formData, clientName: e.target.value })}
              placeholder="Ej. TechCorp Solutions"
            />
          </FormGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormGroup>
              <label>Monto ($)</label>
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
              <label>Vencimiento</label>
              <input
                required
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </FormGroup>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormGroup>
              <label>Estado</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="overdue">En Mora</option>
              </select>
            </FormGroup>
            <FormGroup>
              <label>Agente Asignado (Sales Rep)</label>
              <input
                required
                type="text"
                value={formData.agentId}
                onChange={e => setFormData({ ...formData, agentId: e.target.value })}
                placeholder="Ej. Guidiana Puentes"
              />
            </FormGroup>
          </div>

          <FormGroup>
            <label>Notas (Opcional)</label>
            <textarea
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Acuerdos de pago, promesas, etc..."
            />
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="debtor-form" className="btn btn-primary">Guardar Cambios</button>
        </ModalFooter>
      </ModalContent>
    </Overlay>
  );
}
