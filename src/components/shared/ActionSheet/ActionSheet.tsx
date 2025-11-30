import { useEffect, useRef, useCallback } from 'react';
import { Title, Text, Muted } from '../Typography';
import './ActionSheet.css';

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface ActionSheetOptionProps {
  /** Option label */
  label: string;
  /** Optional suffix like "(Default)" */
  suffix?: string;
  /** Whether this option is selected */
  selected?: boolean;
  /** Color indicator (optional) */
  color?: string;
  /** Click handler */
  onClick: () => void;
}

export function ActionSheet({
  isOpen,
  onClose,
  title,
  children,
}: ActionSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.classList.add('closing');
      // Wait for animation to complete
      setTimeout(() => {
        dialog.close();
        dialog.classList.remove('closing');
        onClose();
      }, 200);
    }
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (dialog && e.target === dialog) {
      handleClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      handleClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [handleClose]);

  return (
    <dialog
      ref={dialogRef}
      className="action-sheet-dialog"
      onClick={handleBackdropClick}
    >
      <div className="action-sheet">
        <div className="action-sheet-handle" />
        <div className="action-sheet-header">
          <Title size="base">{title}</Title>
        </div>
        <div className="action-sheet-content">{children}</div>
      </div>
    </dialog>
  );
}

export function ActionSheetOption({
  label,
  suffix,
  selected = false,
  color,
  onClick,
}: ActionSheetOptionProps) {
  return (
    <button
      className={`action-sheet-option ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {color && (
        <span
          className="action-sheet-option-color"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="action-sheet-option-label">
        <Text>{label}</Text>
        {suffix && <Muted>{suffix}</Muted>}
      </div>
      {selected && <span className="action-sheet-option-check">✓</span>}
    </button>
  );
}
