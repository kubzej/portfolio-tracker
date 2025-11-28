import { useState, useEffect } from 'react';
import type { Transaction, UpdateTransactionInput } from '@/types/database';
import { transactionsApi } from '@/services/api';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';

const TRANSACTION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'BUY', label: 'BUY' },
  { value: 'SELL', label: 'SELL' },
];

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: Transaction | null;
}

export function EditTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transaction,
}: EditTransactionModalProps) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [fees, setFees] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      setDate(transaction.date);
      setType(transaction.type);
      setQuantity(transaction.quantity.toString());
      setPricePerShare(transaction.price_per_share.toString());
      setExchangeRate(transaction.exchange_rate_to_czk?.toString() ?? '');
      setFees(transaction.fees?.toString() ?? '0');
      setNotes(transaction.notes ?? '');
      setError(null);
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transaction) return;

    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(pricePerShare);
    const parsedFees = parseFloat(fees) || 0;
    const parsedExchangeRate = exchangeRate
      ? parseFloat(exchangeRate)
      : undefined;

    if (!parsedQuantity || parsedQuantity <= 0) {
      setError('Quantity must be a positive number');
      return;
    }

    if (!parsedPrice || parsedPrice <= 0) {
      setError('Price must be a positive number');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const input: UpdateTransactionInput = {
        date,
        type,
        quantity: parsedQuantity,
        price_per_share: parsedPrice,
        exchange_rate_to_czk: parsedExchangeRate,
        fees: parsedFees,
        notes: notes.trim() || undefined,
      };

      await transactionsApi.update(transaction.id, input);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save transaction'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Transaction" size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-row">
          <BottomSheetSelect
            label="Type"
            options={TRANSACTION_TYPE_OPTIONS}
            value={type}
            onChange={(value) => setType(value as 'BUY' | 'SELL')}
            placeholder="BUY"
          />
          <div className="form-group">
            <label htmlFor="edit-tx-date">Date</label>
            <input
              id="edit-tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="edit-tx-quantity">Quantity</label>
            <input
              id="edit-tx-quantity"
              type="number"
              step="0.000001"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-tx-price">Price per Share</label>
            <input
              id="edit-tx-price"
              type="number"
              step="0.0001"
              min="0"
              value={pricePerShare}
              onChange={(e) => setPricePerShare(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="edit-tx-exchange-rate">Exchange Rate to CZK</label>
            <input
              id="edit-tx-exchange-rate"
              type="number"
              step="0.0001"
              min="0"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="Auto-fetch if empty"
            />
            <span className="form-hint">Leave empty to auto-fetch</span>
          </div>
          <div className="form-group">
            <label htmlFor="edit-tx-fees">Fees</label>
            <input
              id="edit-tx-fees"
              type="number"
              step="0.01"
              min="0"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-tx-notes">Notes</label>
          <textarea
            id="edit-tx-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this transaction..."
            rows={3}
          />
        </div>

        <div className="form-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
