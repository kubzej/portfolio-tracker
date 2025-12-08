import { useState, useEffect, useMemo } from 'react';
import { optionsApi } from '@/services/api';
import { portfoliosApi, stocksApi } from '@/services/api';
import type {
  Portfolio,
  Stock,
  OptionTransaction,
  OptionHolding,
  CreateOptionTransactionInput,
  OptionType,
  OptionAction,
} from '@/types';
import {
  Modal,
  Button,
  Input,
  ToggleGroup,
  TextArea,
} from '@/components/shared';
import { Label, Hint, Text, MetricValue } from '@/components/shared/Typography';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import { formatPrice } from '@/utils/format';
import {
  calculateDTE,
  generateOCCSymbol,
  getDTECategory,
} from '@/utils/options';
import './OptionTransactionModal.css';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'CHF', label: 'CHF' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CNY', label: 'CNY' },
  { value: 'CZK', label: 'CZK' },
  { value: 'HKD', label: 'HKD' },
  // Nordics & Central Europe
  { value: 'SEK', label: 'SEK' }, // Sweden
  { value: 'DKK', label: 'DKK' }, // Denmark
  { value: 'NOK', label: 'NOK' }, // Norway
  { value: 'PLN', label: 'PLN' }, // Poland
  { value: 'HUF', label: 'HUF' }, // Hungary
];

// Position opening actions (for new positions)
const OPEN_ACTIONS: OptionAction[] = ['BTO', 'STO'];

// Closing actions for LONG positions (BTO -> STC, Exercise, Expiration)
const LONG_CLOSE_ACTIONS: OptionAction[] = ['STC', 'EXERCISE', 'EXPIRATION'];

// Closing actions for SHORT positions (STO -> BTC, Assignment, Expiration)
const SHORT_CLOSE_ACTIONS: OptionAction[] = ['BTC', 'ASSIGNMENT', 'EXPIRATION'];

const ACTION_LABELS: Record<OptionAction, string> = {
  BTO: 'BTO (Buy to Open)',
  STC: 'STC (Sell to Close)',
  STO: 'STO (Sell to Open)',
  BTC: 'BTC (Buy to Close)',
  EXPIRATION: 'Expirace',
  ASSIGNMENT: 'Assignment',
  EXERCISE: 'Exercise',
};

const ACTION_DESCRIPTIONS: Record<OptionAction, string> = {
  BTO: 'Otevření long pozice (kupujete opci)',
  STC: 'Uzavření long pozice (prodáváte opci)',
  STO: 'Otevření short pozice (vypisujete opci)',
  BTC: 'Uzavření short pozice (odkupujete opci)',
  EXPIRATION: 'Opce expirovala bezcenně',
  ASSIGNMENT: 'Byli jste přiřazeni (short opce)',
  EXERCISE: 'Uplatnili jste opci (long opce)',
};

interface EmptyForm {
  portfolio_id: string;
  symbol: string;
  option_type: OptionType;
  strike_price: number;
  expiration_date: string;
  action: OptionAction;
  contracts: number;
  premium: number | null;
  currency: string;
  fees: number;
  date: string;
  notes: string;
}

const getDefaultExpirationDate = (): string => {
  // Default to next monthly expiration (3rd Friday)
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();

  // Find 3rd Friday of current or next month
  let targetMonth = month;
  let targetYear = year;

  // If we're past the 3rd Friday of this month, go to next month
  const thirdFriday = getThirdFriday(year, month);
  if (today > thirdFriday) {
    targetMonth = month + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
  }

  return getThirdFriday(targetYear, targetMonth).toISOString().split('T')[0];
};

const getThirdFriday = (year: number, month: number): Date => {
  const firstDay = new Date(year, month, 1);
  const firstFriday = new Date(
    year,
    month,
    1 + ((5 - firstDay.getDay() + 7) % 7)
  );
  return new Date(year, month, firstFriday.getDate() + 14);
};

const EMPTY_FORM: EmptyForm = {
  portfolio_id: '',
  symbol: '',
  option_type: 'call',
  strike_price: 0,
  expiration_date: getDefaultExpirationDate(),
  action: 'BTO',
  contracts: 1,
  premium: null,
  currency: 'USD',
  fees: 0,
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

/** Modal mode: open new position, close existing, or edit transaction */
export type ModalMode = 'open' | 'close' | 'edit';

interface OptionTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Modal mode - defaults to 'open' */
  mode?: ModalMode;
  /** Pre-select portfolio */
  portfolioId?: string | null;
  /** Pre-select underlying symbol */
  preselectedSymbol?: string;
  /** If provided and mode='edit', allows editing this transaction */
  transaction?: OptionTransaction | null;
  /** If provided and mode='close', allows closing this holding */
  holding?: OptionHolding | null;
}

export function OptionTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  mode = 'open',
  portfolioId,
  preselectedSymbol,
  transaction,
  holding,
}: OptionTransactionModalProps) {
  const isEditMode = mode === 'edit' && !!transaction;
  const isCloseMode = mode === 'close' && !!holding;
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EmptyForm>(EMPTY_FORM);

  // Determine available actions based on mode
  const availableActions = useMemo(() => {
    if (isEditMode) {
      // In edit mode, allow all actions (user might need to fix a mistake)
      return [
        ...OPEN_ACTIONS,
        ...LONG_CLOSE_ACTIONS,
        ...SHORT_CLOSE_ACTIONS,
      ].filter(
        (action, index, arr) => arr.indexOf(action) === index // unique
      );
    }
    if (isCloseMode) {
      // In close mode, show appropriate closing actions based on position type
      return holding?.position === 'long'
        ? LONG_CLOSE_ACTIONS
        : SHORT_CLOSE_ACTIONS;
    }
    // Open mode - only opening actions
    return OPEN_ACTIONS;
  }, [isEditMode, isCloseMode, holding]);

  // Default action for the mode
  const defaultAction = useMemo(() => {
    if (isEditMode && transaction) return transaction.action;
    if (isCloseMode && holding) {
      return holding.position === 'long' ? 'STC' : 'BTC';
    }
    return 'BTO';
  }, [isEditMode, isCloseMode, transaction, holding]);

  useEffect(() => {
    if (isOpen) {
      loadData();

      if (isEditMode && transaction) {
        // Edit mode - populate from transaction
        setFormData({
          portfolio_id: transaction.portfolio_id,
          symbol: transaction.symbol,
          option_type: transaction.option_type,
          strike_price: transaction.strike_price,
          expiration_date: transaction.expiration_date,
          action: transaction.action,
          contracts: transaction.contracts,
          premium: transaction.premium,
          currency: transaction.currency,
          fees: transaction.fees || 0,
          date: transaction.date,
          notes: transaction.notes || '',
        });
      } else if (isCloseMode && holding) {
        // Close mode - populate from holding
        setFormData({
          portfolio_id: holding.portfolio_id,
          symbol: holding.symbol,
          option_type: holding.option_type,
          strike_price: holding.strike_price,
          expiration_date: holding.expiration_date,
          action: defaultAction,
          contracts: holding.contracts, // Default to closing all
          premium: null,
          currency: 'USD', // Will be set based on portfolio
          fees: 0,
          date: new Date().toISOString().split('T')[0],
          notes: '',
        });
      } else {
        // Open mode - fresh form
        setFormData({
          ...EMPTY_FORM,
          portfolio_id: portfolioId || '',
          symbol: preselectedSymbol?.toUpperCase() || '',
        });
      }
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    mode,
    transaction,
    holding,
    portfolioId,
    preselectedSymbol,
    defaultAction,
  ]);

  const loadData = async () => {
    try {
      const [portfoliosData, stocksData] = await Promise.all([
        portfoliosApi.getAll(),
        stocksApi.getAll(),
      ]);
      setPortfolios(portfoliosData);
      setStocks(stocksData);

      // Set default portfolio
      if (!transaction && !portfolioId && portfoliosData.length > 0) {
        const defaultPortfolio = portfoliosData.find((p) => p.is_default);
        setFormData((prev) => ({
          ...prev,
          portfolio_id: defaultPortfolio?.id || portfoliosData[0].id,
        }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const portfolioOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Vyberte portfolio...' },
      ...portfolios.map((p) => ({ value: p.id, label: p.name })),
    ],
    [portfolios]
  );

  // Create symbol options from existing stocks
  const symbolOptions: SelectOption[] = useMemo(() => {
    const uniqueSymbols = [
      ...new Set(stocks.map((s) => s.ticker.toUpperCase())),
    ];
    return [
      { value: '', label: 'Vyberte podklad...' },
      ...uniqueSymbols.map((s) => ({ value: s, label: s })),
    ];
  }, [stocks]);

  const actionOptions: SelectOption[] = useMemo(() => {
    return availableActions.map((action) => ({
      value: action,
      label: ACTION_LABELS[action],
    }));
  }, [availableActions]);

  // Whether premium is required for this action
  const isPremiumRequired =
    formData.action !== 'EXPIRATION' &&
    formData.action !== 'ASSIGNMENT' &&
    formData.action !== 'EXERCISE';

  // Calculate DTE for the selected expiration
  const dte = calculateDTE(formData.expiration_date);
  const dteCategory = getDTECategory(dte);

  // Calculate total premium
  const totalPremium =
    formData.premium !== null
      ? formData.premium * formData.contracts * 100
      : null;
  const totalWithFees =
    totalPremium !== null ? totalPremium + formData.fees : null;

  // Preview OCC symbol
  const occSymbol =
    formData.symbol && formData.strike_price > 0 && formData.expiration_date
      ? generateOCCSymbol(
          formData.symbol,
          formData.strike_price,
          formData.expiration_date,
          formData.option_type
        )
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.portfolio_id) {
      setError('Vyberte portfolio');
      setLoading(false);
      return;
    }
    if (!formData.symbol) {
      setError('Zadejte podkladové aktivum');
      setLoading(false);
      return;
    }
    if (formData.strike_price <= 0) {
      setError('Zadejte strike price');
      setLoading(false);
      return;
    }
    if (formData.contracts <= 0) {
      setError('Zadejte počet kontraktů');
      setLoading(false);
      return;
    }
    // Close mode validation: can't close more contracts than you have
    if (isCloseMode && holding && formData.contracts > holding.contracts) {
      setError(`Maximálně můžete zavřít ${holding.contracts} kontraktů`);
      setLoading(false);
      return;
    }
    if (
      isPremiumRequired &&
      (formData.premium === null || formData.premium <= 0)
    ) {
      setError('Zadejte prémium');
      setLoading(false);
      return;
    }

    try {
      const input: CreateOptionTransactionInput = {
        portfolio_id: formData.portfolio_id,
        symbol: formData.symbol.toUpperCase(),
        option_type: formData.option_type,
        strike_price: formData.strike_price,
        expiration_date: formData.expiration_date,
        action: formData.action,
        contracts: formData.contracts,
        premium: formData.premium ?? undefined,
        currency: formData.currency,
        fees: formData.fees,
        date: formData.date,
        notes: formData.notes || undefined,
      };

      if (isEditMode && transaction) {
        // Regenerate OCC symbol in case symbol/strike/expiration/type changed
        const newOptionSymbol = generateOCCSymbol(
          formData.symbol,
          formData.strike_price,
          formData.expiration_date,
          formData.option_type
        );

        await optionsApi.updateTransaction(transaction.id, {
          portfolio_id: formData.portfolio_id,
          symbol: formData.symbol.toUpperCase(),
          option_type: formData.option_type,
          strike_price: formData.strike_price,
          expiration_date: formData.expiration_date,
          option_symbol: newOptionSymbol,
          action: formData.action,
          date: formData.date,
          contracts: formData.contracts,
          premium: formData.premium ?? undefined,
          currency: formData.currency,
          fees: formData.fees,
          notes: formData.notes || undefined,
        });
      } else {
        await optionsApi.createTransaction(input);
      }

      // Reset for next transaction (keep portfolio, symbol)
      if (!isEditMode) {
        setFormData((prev) => ({
          ...EMPTY_FORM,
          portfolio_id: prev.portfolio_id,
          symbol: prev.symbol,
          currency: prev.currency,
        }));
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Nepodařilo se ${isEditMode ? 'upravit' : 'vytvořit'} transakci`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue =
      value === '' ? (name === 'premium' ? null : 0) : parseFloat(value);
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  const title = isEditMode
    ? 'Upravit transakci'
    : isCloseMode
    ? 'Zavřít pozici'
    : 'Otevřít novou pozici';

  const submitLabel = isEditMode
    ? loading
      ? 'Ukládám...'
      : 'Uložit změny'
    : isCloseMode
    ? loading
      ? 'Zavírám...'
      : 'Zavřít pozici'
    : loading
    ? 'Přidávám...'
    : 'Otevřít pozici';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="option-transaction-form">
        {error && (
          <div className="form-error">
            <Text color="danger">{error}</Text>
          </div>
        )}

        {/* Portfolio & Symbol */}
        <div className="form-row">
          <BottomSheetSelect
            label="Portfolio"
            options={portfolioOptions}
            value={formData.portfolio_id}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, portfolio_id: value }))
            }
            placeholder="Vyberte portfolio..."
            required
            disabled={isCloseMode}
          />

          <div className="form-group">
            <Label htmlFor="symbol">Podklad *</Label>
            <Input
              id="symbol"
              name="symbol"
              value={formData.symbol}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  symbol: e.target.value.toUpperCase(),
                }))
              }
              placeholder="AAPL"
              required
              disabled={isCloseMode}
              list="symbol-list"
            />
            <datalist id="symbol-list">
              {symbolOptions.slice(1).map((opt) => (
                <option key={opt.value} value={opt.value} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Option Type & Strike */}
        <div className="form-row">
          <div className="form-group">
            <Label>Typ opce *</Label>
            <ToggleGroup
              value={formData.option_type}
              onChange={(value: string) =>
                setFormData((prev) => ({
                  ...prev,
                  option_type: value as OptionType,
                }))
              }
              options={[
                { value: 'call', label: 'CALL' },
                { value: 'put', label: 'PUT' },
              ]}
              disabled={isCloseMode}
            />
          </div>

          <div className="form-group">
            <Label htmlFor="strike_price">Strike *</Label>
            <Input
              id="strike_price"
              name="strike_price"
              type="number"
              min="0"
              step="0.5"
              value={formData.strike_price || ''}
              onChange={handleNumberChange}
              placeholder="0.00"
              required
              disabled={isCloseMode}
            />
          </div>
        </div>

        {/* Expiration & DTE */}
        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="expiration_date">Expirace *</Label>
            <Input
              id="expiration_date"
              name="expiration_date"
              type="date"
              value={formData.expiration_date}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  expiration_date: e.target.value,
                }))
              }
              required
              disabled={isCloseMode}
            />
          </div>

          <div className="form-group dte-preview">
            <Label>DTE</Label>
            <div className={`dte-badge dte-badge--${dteCategory}`}>
              <MetricValue>{dte}</MetricValue>
              <Text size="sm" color="muted">
                dní do expirace
              </Text>
            </div>
          </div>
        </div>

        {/* OCC Symbol Preview */}
        {occSymbol && (
          <div className="occ-preview">
            <Label>OCC Symbol</Label>
            <span className="occ-symbol">{occSymbol}</span>
          </div>
        )}

        {/* Action */}
        <div className="form-row">
          <BottomSheetSelect
            label="Akce"
            options={actionOptions}
            value={formData.action}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                action: value as OptionAction,
              }))
            }
            required
          />
        </div>

        <Hint>{ACTION_DESCRIPTIONS[formData.action]}</Hint>

        {/* Contracts & Premium */}
        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="contracts">Kontrakty *</Label>
            <Input
              id="contracts"
              name="contracts"
              type="number"
              min="1"
              step="1"
              value={formData.contracts || ''}
              onChange={handleNumberChange}
              required
            />
            <Hint>1 kontrakt = 100 akcií</Hint>
          </div>

          <div className="form-group">
            <Label htmlFor="premium">
              Prémium {isPremiumRequired ? '*' : '(volitelné)'}
            </Label>
            <Input
              id="premium"
              name="premium"
              type="number"
              min="0"
              step="0.01"
              value={formData.premium ?? ''}
              onChange={handleNumberChange}
              placeholder="0.00"
              required={isPremiumRequired}
              disabled={!isPremiumRequired}
            />
            <Hint>Cena za 1 akcii (ne za kontrakt)</Hint>
          </div>
        </div>

        {/* Date & Fees */}
        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="date">Datum transakce *</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-group">
            <Label htmlFor="fees">Poplatky</Label>
            <Input
              id="fees"
              name="fees"
              type="number"
              min="0"
              step="0.01"
              value={formData.fees || ''}
              onChange={handleNumberChange}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Currency */}
        <div className="form-row">
          <BottomSheetSelect
            label="Měna"
            options={CURRENCY_OPTIONS}
            value={formData.currency}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, currency: value }))
            }
          />
        </div>

        {/* Notes */}
        <div className="form-group">
          <Label htmlFor="notes">Poznámky</Label>
          <TextArea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, notes: e.target.value }))
            }
            rows={2}
            placeholder="Strategie, důvody..."
          />
        </div>

        {/* Summary */}
        {totalPremium !== null && (
          <div className="transaction-summary">
            <div className="summary-row">
              <Text color="muted">Celkové prémium</Text>
              <MetricValue>
                {formatPrice(totalPremium, formData.currency)}
              </MetricValue>
            </div>
            {formData.fees > 0 && (
              <div className="summary-row">
                <Text color="muted">S poplatky</Text>
                <MetricValue>
                  {formatPrice(totalWithFees!, formData.currency)}
                </MetricValue>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
