import { useState, useRef, useEffect, ReactNode } from 'react';
import './InfoTooltip.css';

interface InfoTooltipProps {
  /** Simple text content */
  text?: string;
  /** Rich content (JSX) - use this for formatted tooltips */
  children?: ReactNode;
  /** Position of the popup */
  position?: 'top' | 'bottom';
}

export function InfoTooltip({
  text,
  children,
  position = 'top',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const content = children || <p>{text}</p>;

  return (
    <div className="info-tooltip" ref={wrapperRef}>
      <button
        className="info-tooltip__trigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label="More information"
        aria-expanded={isOpen}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="info-tooltip__backdrop"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`info-tooltip__popup info-tooltip__popup--${position}`}
          >
            <div className="info-tooltip__content">{content}</div>
            <button
              className="info-tooltip__close"
              onClick={() => setIsOpen(false)}
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
