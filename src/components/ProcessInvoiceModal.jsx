import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, Hash, CheckCircle2 } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
`;

const ModalContent = styled.div`
  background: var(--surface-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 440px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  overflow: hidden;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const ModalHeader = styled.div`
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  button {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.4rem;
    border-radius: 50%;
    display: flex;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
    }
  }
`;

const ModalBody = styled.div`
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const CompanyInfo = styled.div`
  text-align: center;
  margin-bottom: 0.5rem;
  
  .label {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
  }
  
  .name {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--brand);
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;

    .icon {
      position: absolute;
      left: 1rem;
      color: var(--text-muted);
    }

    input {
      width: 100%;
      background: rgba(15, 23, 42, 0.3);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 0.85rem 1rem 0.85rem 2.8rem;
      color: var(--text-main);
      font-family: inherit;
      font-size: 1.1rem;
      outline: none;
      transition: all 0.2s;

      &:focus {
        border-color: var(--brand);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        background: rgba(15, 23, 42, 0.5);
      }
      
      &::placeholder {
        color: rgba(148, 163, 184, 0.4);
      }
    }
  }
`;

const Suggestion = styled.div`
  padding: 0.8rem 1rem;
  background: rgba(56, 189, 248, 0.08);
  border: 1px dashed rgba(56, 189, 248, 0.3);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(56, 189, 248, 0.15);
    border-style: solid;
  }

  strong {
    color: var(--brand);
  }
`;

const ModalFooter = styled.div`
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  gap: 1rem;

  button {
    flex: 1;
    padding: 0.8rem;
    font-weight: 700;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--text-muted);

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-main);
    }
  }

  .btn-confirm {
    background: var(--brand);
    border: none;
    color: #0c1220;

    &:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
`;

export default function ProcessInvoiceModal({ isOpen, onClose, onConfirm, companyName, suggestedInv }) {
    const [invNumber, setInvNumber] = useState('');

    useEffect(() => {
        if (isOpen) {
            setInvNumber(suggestedInv || '');
        }
    }, [isOpen, suggestedInv]);

    if (!isOpen) return null;

    const handleConfirm = (e) => {
        e.preventDefault();
        onConfirm(invNumber);
    };

    return (
        <Overlay onClick={onClose}>
            <ModalContent onClick={e => e.stopPropagation()}>
                <ModalHeader>
                    <h3><CheckCircle2 size={20} /> Process Billing</h3>
                    <button onClick={onClose}><X size={18} /></button>
                </ModalHeader>

                <form onSubmit={handleConfirm}>
                    <ModalBody>
                        <CompanyInfo>
                            <div className="label">Processing Invoices For</div>
                            <div className="name">{companyName}</div>
                        </CompanyInfo>

                        <InputGroup>
                            <label>Invoice Number</label>
                            <div className="input-wrapper">
                                <Hash className="icon" size={18} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Enter invoice ID..."
                                    value={invNumber}
                                    onChange={e => setInvNumber(e.target.value)}
                                    onKeyUp={e => e.key === 'Escape' && onClose()}
                                />
                            </div>
                        </InputGroup>

                        {suggestedInv && invNumber !== suggestedInv && (
                            <Suggestion onClick={() => setInvNumber(suggestedInv)}>
                                <Hash size={14} />
                                <span>Found existing invoice: <strong>{suggestedInv}</strong>. Click to auto-fill.</span>
                            </Suggestion>
                        )}
                    </ModalBody>

                    <ModalFooter>
                        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-confirm">
                            Commit & Flip Card
                        </button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Overlay>
    );
}
