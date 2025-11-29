import { useEffect, useRef } from 'react';
import { Button } from '../Button';
import { Title, Text, Muted } from '../Typography';
import './BottomSheet.css';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface BottomSheetOptionProps {
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

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="bottom-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottom-sheet-header">
          <Title size="base">{title}</Title>
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </Button>
        </div>
        <div className="bottom-sheet-content">{children}</div>
      </div>
    </div>
  );
}

export function BottomSheetOption({
  label,
  suffix,
  selected = false,
  color,
  onClick,
}: BottomSheetOptionProps) {
  return (
    <button
      className={`bottom-sheet-option ${selected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {color && (
        <span
          className="bottom-sheet-option-color"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="bottom-sheet-option-label">
        <Text>{label}</Text>
        {suffix && <Muted>{suffix}</Muted>}
      </div>
      {selected && <span className="bottom-sheet-option-check">✓</span>}
    </button>
  );
}
