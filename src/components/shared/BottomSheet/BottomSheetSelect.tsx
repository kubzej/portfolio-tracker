import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import './BottomSheetSelect.css';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface BottomSheetSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  title?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function BottomSheetSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  label,
  title,
  required,
  disabled,
  className = '',
}: BottomSheetSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="bottom-sheet-select-label">
          {label} {required && '*'}
        </label>
      )}

      {/* Desktop: native select */}
      {!isMobile && (
        <select
          className="native-select-trigger"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {!selectedOption && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {/* Mobile: button + bottom sheet */}
      {isMobile && (
        <>
          <button
            type="button"
            className={`bottom-sheet-select-trigger ${
              disabled ? 'disabled' : ''
            } ${!selectedOption ? 'placeholder' : ''}`}
            onClick={() => !disabled && setIsOpen(true)}
            disabled={disabled}
          >
            {selectedOption?.color && (
              <span
                className="select-color-dot"
                style={{ backgroundColor: selectedOption.color }}
              />
            )}
            <span className="select-text">
              {selectedOption?.label || placeholder}
            </span>
            <svg
              className="select-chevron"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <BottomSheet
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title={title || label || 'Select'}
          >
            <div className="bottom-sheet-options">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`bottom-sheet-option ${
                    value === option.value ? 'selected' : ''
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.color && (
                    <span
                      className="option-color"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="option-label">{option.label}</span>
                  {value === option.value && (
                    <span className="option-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
