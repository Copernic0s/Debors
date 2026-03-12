import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, X } from 'lucide-react';

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
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
`;

const ModalContent = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;

  h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-main);
  }

  p {
    color: var(--text-muted);
    font-size: 0.95rem;
  }
`;

const IconCircle = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(248, 113, 113, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--danger);
  margin-bottom: 0.5rem;
`;

const ModalFooter = styled.div`
  padding: 1.25rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  gap: 1rem;
`;

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", isDanger = false }) {
    if (!isOpen) return null;

    return (
        <Overlay onClick={onCancel}>
            <ModalContent onClick={e => e.stopPropagation()}>
                <ModalBody>
                    <IconCircle>
                        <AlertTriangle size={32} />
                    </IconCircle>
                    <h3>{title}</h3>
                    <p>{message}</p>
                </ModalBody>
                <ModalFooter>
                    <button style={{ flex: 1 }} className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button
                        style={{
                            flex: 1,
                            background: isDanger ? 'var(--danger)' : undefined,
                            boxShadow: isDanger ? '0 4px 12px rgba(248, 113, 113, 0.2)' : undefined
                        }}
                        className="btn btn-primary"
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </ModalFooter>
            </ModalContent>
        </Overlay>
    );
}
