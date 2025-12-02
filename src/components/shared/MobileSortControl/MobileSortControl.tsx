import { BottomSheetSelect, type SelectOption } from '../BottomSheet';
import './MobileSortControl.css';

export interface SortField {
  value: string;
  label: string;
  defaultDirection?: 'asc' | 'desc';
}

interface MobileSortControlProps {
  label?: string;
  fields: SortField[];
  selectedField: string;
  direction: 'asc' | 'desc';
  onFieldChange: (field: string) => void;
  onDirectionChange: (direction: 'asc' | 'desc') => void;
}

export function MobileSortControl({
  label = 'Řadit podle',
  fields,
  selectedField,
  direction,
  onFieldChange,
  onDirectionChange,
}: MobileSortControlProps) {
  const options: SelectOption[] = fields.map((f) => ({
    value: f.value,
    label: f.label,
  }));

  const toggleDirection = () => {
    onDirectionChange(direction === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="mobile-sort-control">
      <div className="mobile-sort-control__select">
        <BottomSheetSelect
          label={label}
          options={options}
          value={selectedField}
          onChange={onFieldChange}
          className="mobile-sort-control__field-select"
        />
      </div>
      <button
        type="button"
        className="mobile-sort-control__direction"
        onClick={toggleDirection}
        aria-label={direction === 'asc' ? 'Řadit vzestupně' : 'Řadit sestupně'}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sort-direction-icon sort-direction-icon--${direction}`}
        >
          {direction === 'asc' ? (
            <>
              <path d="M12 5v14" />
              <path d="M5 12l7-7 7 7" />
            </>
          ) : (
            <>
              <path d="M12 5v14" />
              <path d="M5 12l7 7 7-7" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
