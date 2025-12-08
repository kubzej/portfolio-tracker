import { useState, useEffect, useMemo } from 'react';
import { stocksApi, transactionsApi, portfoliosApi } from '@/services/api';
import type {
  Stock,
  Portfolio,
  Transaction,
  CreateTransactionInput,
  TransactionType,
  AvailableLot,
} from '@/types/database';
import {
  Modal,
  Button,
  Input,
  ToggleGroup,
  TextArea,
  EmptyState,
} from '@/components/shared';
import {
  Label,
  Hint,
  Text,
  MetricValue,
  MetricLabel,
} from '@/components/shared/Typography';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import { formatPrice, formatDate, formatShares } from '@/utils/format';
import './TransactionModal.css';

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

const EMPTY_FORM: CreateTransactionInput = {
  stock_id: '',
  portfolio_id: '',
  date: new Date().toISOString().split('T')[0],
  type: 'BUY',
  quantity: 0,
  price_per_share: 0,
  currency: 'USD',
  exchange_rate_to_czk: undefined,
  fees: 0,
  notes: '',
  source_transaction_id: null,
};

// Sell mode: entire position, specific lot, or partial lot
type SellMode = 'entire' | 'lot' | 'partial';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** If provided, modal is in edit mode. Otherwise, it's add mode. */
  transaction?: Transaction | null;
  /** Pre-select portfolio (for add mode) */
  portfolioId?: string | null;
  /** Pre-select stock (for add mode) */
  preselectedStockId?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transaction,
  portfolioId,
  preselectedStockId,
}: TransactionModalProps) {
  const isEditMode = !!transaction;
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateTransactionInput>(EMPTY_FORM);

  // Sell-specific state
  const [availableLots, setAvailableLots] = useState<AvailableLot[]>([]);
  const [sellMode, setSellMode] = useState<SellMode>('entire');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [lotsLoading, setLotsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();

      if (transaction) {
        // Edit mode - populate form with transaction data
        setFormData({
          stock_id: transaction.stock_id,
          portfolio_id: transaction.portfolio_id,
          date: transaction.date,
          type: transaction.type,
          quantity: transaction.quantity,
          price_per_share: transaction.price_per_share,
          currency: transaction.currency || 'USD',
          exchange_rate_to_czk: transaction.exchange_rate_to_czk ?? undefined,
          fees: transaction.fees ?? 0,
          notes: transaction.notes ?? '',
          source_transaction_id: transaction.source_transaction_id,
        });
        // Set sell mode based on existing transaction
        if (transaction.type === 'SELL') {
          setSellMode(transaction.source_transaction_id ? 'lot' : 'entire');
          setSelectedLotId(transaction.source_transaction_id);
        }
      } else {
        // Add mode - reset form with preselected values
        setFormData({
          ...EMPTY_FORM,
          stock_id: preselectedStockId || '',
          portfolio_id: portfolioId || '',
        });
        setSellMode('entire');
        setSelectedLotId(null);
      }
      setError(null);
      setAvailableLots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, transaction, portfolioId, preselectedStockId]);

  // Load available lots when switching to SELL mode or changing stock/portfolio
  useEffect(() => {
    if (
      formData.type === 'SELL' &&
      formData.stock_id &&
      formData.portfolio_id
    ) {
      loadAvailableLots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.type, formData.stock_id, formData.portfolio_id]);

  const loadAvailableLots = async () => {
    if (!formData.stock_id || !formData.portfolio_id) return;

    setLotsLoading(true);
    try {
      const lots = await transactionsApi.getAvailableLots(
        formData.stock_id,
        formData.portfolio_id
      );
      setAvailableLots(lots);

      // Auto-select first lot if switching to lot mode and nothing selected
      if (lots.length > 0 && !selectedLotId && sellMode === 'lot') {
        setSelectedLotId(lots[0].id);
      }
    } catch (err) {
      console.error('Failed to load available lots:', err);
    } finally {
      setLotsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [stocksData, portfoliosData] = await Promise.all([
        stocksApi.getAll(),
        portfoliosApi.getAll(),
      ]);
      setStocks(stocksData);
      setPortfolios(portfoliosData);

      // Only set defaults in add mode
      if (!transaction) {
        // If we have stocks and no preselected one, select the first and use its currency
        if (stocksData.length > 0 && !preselectedStockId) {
          setFormData((prev) => ({
            ...prev,
            stock_id: prev.stock_id || stocksData[0].id,
            currency: stocksData[0].currency || 'USD',
          }));
        } else if (preselectedStockId) {
          const selectedStock = stocksData.find(
            (s) => s.id === preselectedStockId
          );
          if (selectedStock) {
            setFormData((prev) => ({
              ...prev,
              currency: selectedStock.currency || 'USD',
            }));
          }
        }

        // Set default portfolio if none provided
        if (!portfolioId && portfoliosData.length > 0) {
          const defaultPortfolio = portfoliosData.find((p) => p.is_default);
          setFormData((prev) => ({
            ...prev,
            portfolio_id:
              prev.portfolio_id ||
              (defaultPortfolio?.id ?? portfoliosData[0].id),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const stockOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Vyberte akcii...' },
      ...stocks.map((s) => ({
        value: s.id,
        label: `${s.ticker} - ${s.name}`,
      })),
    ],
    [stocks]
  );

  const portfolioOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Vyberte portfolio...' },
      ...portfolios.map((p) => ({ value: p.id, label: p.name })),
    ],
    [portfolios]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation for SELL
    if (formData.type === 'SELL' && !isEditMode) {
      if (formData.quantity <= 0) {
        setError('Zadejte počet akcií k prodeji');
        setLoading(false);
        return;
      }
      if (formData.quantity > maxSellQuantity) {
        setError(
          `Nemůžete prodat více akcií než máte k dispozici (${formatShares(
            maxSellQuantity
          )})`
        );
        setLoading(false);
        return;
      }
    }

    try {
      if (isEditMode && transaction) {
        await transactionsApi.update(transaction.id, {
          date: formData.date,
          type: formData.type,
          quantity: formData.quantity,
          price_per_share: formData.price_per_share,
          exchange_rate_to_czk: formData.exchange_rate_to_czk,
          fees: formData.fees,
          notes: formData.notes || undefined,
        });
      } else {
        await transactionsApi.create(formData);
      }

      if (!isEditMode) {
        // Reset form but keep stock, portfolio, and date
        setFormData((prev) => ({
          ...prev,
          type: 'BUY',
          quantity: 0,
          price_per_share: 0,
          fees: 0,
          notes: '',
          source_transaction_id: null,
        }));
        setSellMode('entire');
        setSelectedLotId(null);
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? 0 : parseFloat(value),
    }));
  };

  // Special handler for quantity that respects max limit for SELL
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    setFormData((prev) => ({
      ...prev,
      quantity: value,
    }));
  };

  const handleTypeChange = (type: TransactionType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      source_transaction_id: null,
      quantity: 0,
    }));
    // Reset sell mode when switching types
    if (type === 'BUY') {
      setSellMode('entire');
      setSelectedLotId(null);
    }
  };

  const handleSellModeChange = (mode: SellMode) => {
    setSellMode(mode);

    if (mode === 'entire') {
      // Sell all - use total available shares
      const totalShares = availableLots.reduce(
        (sum, lot) => sum + lot.remaining_shares,
        0
      );
      setFormData((prev) => ({
        ...prev,
        quantity: totalShares,
        source_transaction_id: null,
      }));
      setSelectedLotId(null);
    } else if (mode === 'lot' && availableLots.length > 0) {
      // Select first lot by default
      const firstLot = availableLots[0];
      setSelectedLotId(firstLot.id);
      setFormData((prev) => ({
        ...prev,
        quantity: firstLot.remaining_shares,
        source_transaction_id: firstLot.id,
      }));
    } else if (mode === 'partial') {
      // Partial - need to select lot first
      if (availableLots.length > 0) {
        const firstLot = availableLots[0];
        setSelectedLotId(firstLot.id);
        setFormData((prev) => ({
          ...prev,
          quantity: 0, // User enters custom quantity
          source_transaction_id: firstLot.id,
        }));
      }
    }
  };

  const handleLotSelect = (lotId: string) => {
    const lot = availableLots.find((l) => l.id === lotId);
    if (!lot) return;

    setSelectedLotId(lotId);
    setFormData((prev) => ({
      ...prev,
      source_transaction_id: lotId,
      quantity: sellMode === 'lot' ? lot.remaining_shares : prev.quantity,
    }));
  };

  const selectedLot = availableLots.find((l) => l.id === selectedLotId);
  const totalAvailableShares = availableLots.reduce(
    (sum, lot) => sum + lot.remaining_shares,
    0
  );
  const maxSellQuantity =
    sellMode === 'entire'
      ? totalAvailableShares
      : selectedLot?.remaining_shares || 0;

  // Calculate totals for display
  const totalAmount = formData.quantity * formData.price_per_share;
  const totalWithFees = totalAmount + (formData.fees || 0);
  const totalInCzk = formData.exchange_rate_to_czk
    ? totalWithFees * formData.exchange_rate_to_czk
    : null;

  const title = isEditMode ? 'Upravit transakci' : 'Přidat transakci';
  const submitLabel = isEditMode
    ? loading
      ? 'Ukládám...'
      : 'Uložit změny'
    : loading
    ? 'Přidávám...'
    : `Přidat ${formData.type === 'BUY' ? 'nákup' : 'prodej'}`;

  // Check if user has required data
  const hasNoPortfolios = portfolios.length === 0;
  const hasNoStocks = stocks.length === 0;
  const cannotAddTransaction = !isEditMode && (hasNoPortfolios || hasNoStocks);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      {cannotAddTransaction ? (
        <div className="transaction-modal-empty">
          {hasNoPortfolios ? (
            <EmptyState
              title="Žádná portfolia"
              description="Nejprve musíte vytvořit portfolio, než můžete přidávat transakce."
              action={{
                label: 'Zavřít',
                onClick: onClose,
              }}
            />
          ) : (
            <EmptyState
              title="Žádné akcie"
              description="Nejprve musíte přidat akcii, než můžete přidávat transakce. Použijte tlačítko 'Přidat akcii' v navigaci."
              action={{
                label: 'Zavřít',
                onClick: onClose,
              }}
            />
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="transaction-modal-form">
          {error && (
            <div className="form-error">
              <Text color="danger">{error}</Text>
            </div>
          )}

          {/* Transaction Type Toggle */}
          <ToggleGroup
            value={formData.type}
            onChange={(value: string) =>
              handleTypeChange(value as TransactionType)
            }
            options={[
              { value: 'BUY', label: 'NÁKUP' },
              { value: 'SELL', label: 'PRODEJ' },
            ]}
            variant="transaction"
          />

          <div className="form-row form-row--first">
            <BottomSheetSelect
              label="Portfolio"
              options={portfolioOptions}
              value={formData.portfolio_id}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, portfolio_id: value }))
              }
              placeholder="Vyberte portfolio..."
              required
              disabled={isEditMode || !!portfolioId}
            />

            <BottomSheetSelect
              label="Akcie"
              options={stockOptions}
              value={formData.stock_id}
              onChange={(value) => {
                const selectedStock = stocks.find((s) => s.id === value);
                setFormData((prev) => ({
                  ...prev,
                  stock_id: value,
                  currency: selectedStock?.currency || prev.currency,
                }));
              }}
              placeholder="Vyberte akcii..."
              required
              disabled={isEditMode}
            />
          </div>

          {/* Sell Mode Selection - only show when SELL and has lots */}
          {formData.type === 'SELL' &&
            !isEditMode &&
            formData.stock_id &&
            formData.portfolio_id && (
              <div className="sell-section">
                {lotsLoading ? (
                  <Text color="muted">Načítám dostupné pozice...</Text>
                ) : availableLots.length === 0 ? (
                  <div className="sell-no-lots">
                    <Text color="danger">
                      Nemáte žádné akcie k prodeji v tomto portfoliu.
                    </Text>
                  </div>
                ) : (
                  <>
                    <div className="sell-mode-toggle">
                      <Label>Způsob prodeje</Label>
                      <ToggleGroup
                        value={sellMode}
                        onChange={(value: string) =>
                          handleSellModeChange(value as SellMode)
                        }
                        options={[
                          {
                            value: 'entire',
                            label: `Celá pozice (${formatShares(
                              totalAvailableShares
                            )})`,
                          },
                          { value: 'lot', label: 'Celý lot' },
                          { value: 'partial', label: 'Část lotu' },
                        ]}
                        size="sm"
                      />
                    </div>

                    {/* Lot selection for lot/partial modes */}
                    {(sellMode === 'lot' || sellMode === 'partial') && (
                      <div className="sell-lots-list">
                        <Label>Vyberte lot</Label>
                        <div className="lots-grid">
                          {availableLots.map((lot) => (
                            <button
                              key={lot.id}
                              type="button"
                              className={`lot-card ${
                                selectedLotId === lot.id
                                  ? 'lot-card--selected'
                                  : ''
                              }`}
                              onClick={() => handleLotSelect(lot.id)}
                            >
                              <div className="lot-card-header">
                                <Text weight="semibold">
                                  {formatDate(lot.date)}
                                </Text>
                                <MetricValue size="sm">
                                  {formatShares(lot.remaining_shares)} ks
                                </MetricValue>
                              </div>
                              <div className="lot-card-body">
                                <div className="lot-card-row">
                                  <MetricLabel>Nákupní cena</MetricLabel>
                                  <Text>
                                    {formatPrice(
                                      lot.price_per_share,
                                      lot.currency
                                    )}
                                  </Text>
                                </div>
                                {lot.quantity !== lot.remaining_shares && (
                                  <div className="lot-card-row">
                                    <MetricLabel>Původně</MetricLabel>
                                    <Text color="muted">
                                      {formatShares(lot.quantity)} ks
                                    </Text>
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Show max quantity hint for partial mode */}
                    {sellMode === 'partial' && selectedLot && (
                      <Hint>
                        Max. {formatShares(selectedLot.remaining_shares)} ks z
                        tohoto lotu
                      </Hint>
                    )}
                  </>
                )}
              </div>
            )}

          <div className="form-row">
            <div className="form-group">
              <Label htmlFor="date">Datum *</Label>
              <Input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                fullWidth
              />
            </div>

            <div className="form-group">
              <Label htmlFor="quantity">
                Množství *
                {formData.type === 'SELL' && maxSellQuantity > 0 && (
                  <Text as="span" size="sm" color="muted">
                    {' '}
                    (max {formatShares(maxSellQuantity)})
                  </Text>
                )}
              </Label>
              <Input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleQuantityChange}
                onBlur={() => {
                  // Clamp value to max on blur for SELL
                  if (
                    formData.type === 'SELL' &&
                    maxSellQuantity > 0 &&
                    formData.quantity > maxSellQuantity
                  ) {
                    setFormData((prev) => ({
                      ...prev,
                      quantity: maxSellQuantity,
                    }));
                  }
                }}
                placeholder="0"
                step="0.000001"
                min="0"
                max={
                  formData.type === 'SELL' && maxSellQuantity > 0
                    ? maxSellQuantity
                    : undefined
                }
                required
                fullWidth
                disabled={
                  formData.type === 'SELL' &&
                  (sellMode === 'entire' || sellMode === 'lot')
                }
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <Label htmlFor="price_per_share">Cena za akcii *</Label>
              <Input
                type="number"
                id="price_per_share"
                name="price_per_share"
                value={formData.price_per_share || ''}
                onChange={handleNumberChange}
                placeholder="0.00"
                step="0.0001"
                min="0"
                required
                fullWidth
              />
            </div>

            <BottomSheetSelect
              label="Měna"
              options={CURRENCY_OPTIONS}
              value={formData.currency || 'USD'}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, currency: value || 'USD' }))
              }
              placeholder="USD"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <Label htmlFor="exchange_rate_to_czk">Kurz k CZK</Label>
              <Input
                type="number"
                id="exchange_rate_to_czk"
                name="exchange_rate_to_czk"
                value={formData.exchange_rate_to_czk || ''}
                onChange={handleNumberChange}
                placeholder="např. 23.50"
                step="0.0001"
                min="0"
                fullWidth
              />
              <Hint>Nechte prázdné pro auto-doplnění</Hint>
            </div>

            <div className="form-group">
              <Label htmlFor="fees">Poplatky ({formData.currency})</Label>
              <Input
                type="number"
                id="fees"
                name="fees"
                value={formData.fees || ''}
                onChange={handleNumberChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                fullWidth
              />
            </div>
          </div>

          {/* Total display */}
          <div className="transaction-totals">
            <div className="total-row">
              <Label>Celková částka</Label>
              <MetricValue>
                {totalAmount.toFixed(2)} {formData.currency}
                {formData.fees ? ` + ${formData.fees.toFixed(2)} poplatky` : ''}
              </MetricValue>
            </div>
            {totalInCzk !== null && (
              <div className="total-row">
                <Label>Celkem v CZK</Label>
                <MetricValue>{totalInCzk.toFixed(2)} Kč</MetricValue>
              </div>
            )}
          </div>

          <div className="form-group notes-section">
            <Label htmlFor="notes">Poznámky</Label>
            <TextArea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Jakékoli poznámky k této transakci..."
              rows={2}
              fullWidth
            />
          </div>

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {submitLabel}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
