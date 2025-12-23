import { useState, useEffect, useMemo } from 'react';
import { optionsApi, holdingsApi } from '@/services/api';
import type { OptionHolding, OptionPrice, OptionTransaction } from '@/types';
import {
  EmptyState,
  LoadingSpinner,
  Button,
  ConfirmDialog,
  InfoTooltip,
} from '@/components/shared';
import {
  Text,
  Ticker,
  MetricLabel,
  MetricValue,
  Badge,
  Muted,
} from '@/components/shared/Typography';
import { formatPrice, formatDate, formatPercent } from '@/utils/format';
import {
  calculateDTE,
  getDTECategory,
  formatDTE,
  calculateOptionValue,
  calculateOptionPL,
  getMoneyness,
  calculateBreakeven,
  calculateMaxProfitLoss,
  estimateProbabilityOfProfit,
} from '@/utils/options';
import { generateAllAlerts, countAlertsBySeverity } from '@/utils/optionAlerts';
import { OptionTransactionModal } from './OptionTransactionModal';
import './OptionsList.css';

const ACTION_LABELS: Record<string, string> = {
  BTO: 'Buy to Open',
  STC: 'Sell to Close',
  STO: 'Sell to Open',
  BTC: 'Buy to Close',
  EXPIRATION: 'Expirace',
  ASSIGNMENT: 'Assignment',
  EXERCISE: 'Exercise',
};

interface OptionsListProps {
  portfolioId: string;
  /** Current stock prices for moneyness calculation */
  stockPrices?: Record<string, number>;
  /** Callback when user wants to edit a transaction */
  onEditTransaction?: (transaction: OptionTransaction) => void;
}

interface EnrichedHolding extends OptionHolding {
  dteCategory: ReturnType<typeof getDTECategory>;
  currentValue?: number;
  pl?: number;
  plPercent?: number;
  moneyness?: 'ITM' | 'ATM' | 'OTM';
}

export function OptionsList({
  portfolioId,
  stockPrices: externalStockPrices = {},
  onEditTransaction,
}: OptionsListProps) {
  const [holdings, setHoldings] = useState<OptionHolding[]>([]);
  const [prices, setPrices] = useState<Record<string, OptionPrice>>({});
  const [internalStockPrices, setInternalStockPrices] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingHolding, setClosingHolding] = useState<OptionHolding | null>(
    null
  );

  // Handler for closing an option position
  const handleCloseOption = (holding: OptionHolding) => {
    setClosingHolding(holding);
  };

  const handleCloseModalSuccess = () => {
    setClosingHolding(null);
    loadData();
  };

  // Merge external and internal stock prices (external takes precedence)
  const stockPrices = useMemo(
    () => ({
      ...internalStockPrices,
      ...externalStockPrices,
    }),
    [internalStockPrices, externalStockPrices]
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const holdingsData = await optionsApi.getHoldings(portfolioId);
      setHoldings(holdingsData);

      // Load prices for all option symbols
      if (holdingsData.length > 0) {
        const symbols = holdingsData.map((h: OptionHolding) => h.option_symbol);
        const pricesData = await optionsApi.getPrices(symbols);
        const pricesMap: Record<string, OptionPrice> = {};
        pricesData.forEach((p: OptionPrice) => {
          pricesMap[p.option_symbol] = p;
        });
        setPrices(pricesMap);

        // Load underlying stock prices from holdings
        const uniqueSymbols = [
          ...new Set(holdingsData.map((h: OptionHolding) => h.symbol)),
        ];
        const portfolioSummary = await holdingsApi.getPortfolioSummary(
          portfolioId
        );
        const stockPricesMap: Record<string, number> = {};
        portfolioSummary.forEach((h) => {
          if (h.current_price !== null && uniqueSymbols.includes(h.ticker)) {
            stockPricesMap[h.ticker] = h.current_price;
          }
        });
        setInternalStockPrices(stockPricesMap);
      }
    } catch (err) {
      console.error('[OptionsList] Error loading data:', err);
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se načíst opce'
      );
    } finally {
      setLoading(false);
    }
  };

  // Enrich holdings with calculated data
  const enrichedHoldings: EnrichedHolding[] = useMemo(() => {
    return holdings.map((holding) => {
      const dteCategory = getDTECategory(holding.dte);
      const price = prices[holding.option_symbol];
      const stockPrice = stockPrices[holding.symbol];

      // Use price from cache if available (fresher), otherwise from holding
      const currentPrice = price?.price ?? holding.current_price;

      const result: EnrichedHolding = {
        ...holding,
        dteCategory,
        // Override with fresh price data if available
        current_price: currentPrice,
        bid: price?.bid ?? holding.bid,
        ask: price?.ask ?? holding.ask,
        delta: price?.delta ?? holding.delta,
        gamma: price?.gamma ?? holding.gamma,
        theta: price?.theta ?? holding.theta,
        vega: price?.vega ?? holding.vega,
        implied_volatility:
          price?.implied_volatility ?? holding.implied_volatility,
      };

      if (currentPrice !== null) {
        result.currentValue = calculateOptionValue(
          holding.contracts,
          currentPrice
        );
        if (holding.avg_premium !== null) {
          result.pl = calculateOptionPL(
            holding.position,
            holding.contracts,
            holding.avg_premium,
            currentPrice
          );
          if (holding.total_cost !== 0) {
            result.plPercent = (result.pl / Math.abs(holding.total_cost)) * 100;
          }
        }
      }

      if (stockPrice) {
        result.moneyness = getMoneyness(
          holding.option_type,
          stockPrice,
          holding.strike_price
        );
      }

      return result;
    });
  }, [holdings, prices, stockPrices]);

  // Generate alerts for all holdings
  const alerts = useMemo(() => {
    return generateAllAlerts(
      enrichedHoldings.map((h) => ({
        option_symbol: h.option_symbol,
        symbol: h.symbol,
        option_type: h.option_type,
        position: h.position,
        strike_price: h.strike_price,
        dte: h.dte,
        moneyness: h.moneyness,
        plPercent: h.plPercent,
        theta: h.theta,
        contracts: h.contracts,
        current_price: h.current_price,
      }))
    );
  }, [enrichedHoldings]);

  const alertCounts = useMemo(() => countAlertsBySeverity(alerts), [alerts]);

  // Group by expiration
  const groupedByExpiration = useMemo(() => {
    const groups: Record<string, EnrichedHolding[]> = {};
    enrichedHoldings.forEach((holding) => {
      const key = holding.expiration_date;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(holding);
    });

    // Sort groups by expiration date
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [enrichedHoldings]);

  // Calculate totals
  const totals = useMemo(() => {
    let longInvested = 0; // Kolik jsem zaplatil za long pozice
    let shortReceived = 0; // Kolik jsem dostal za short pozice
    let longCount = 0;
    let shortCount = 0;
    let expiringThisWeek = 0;

    enrichedHoldings.forEach((h) => {
      if (h.position === 'long') {
        longCount++;
        // total_cost je kladné číslo (kolik jsem zaplatil)
        longInvested += h.total_cost || 0;
      } else {
        shortCount++;
        // total_cost je kladné číslo (kolik jsem dostal jako kredit)
        shortReceived += h.total_cost || 0;
      }
      if (h.dte <= 7) expiringThisWeek++;
    });

    // Čistá pozice: kladná = mám kredit, záporná = jsem v debitu
    const netPosition = shortReceived - longInvested;

    return {
      longInvested,
      shortReceived,
      netPosition,
      longCount,
      shortCount,
      expiringThisWeek,
    };
  }, [enrichedHoldings]);

  if (loading) {
    return (
      <div className="options-list-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Chyba"
        description={error}
        action={{ label: 'Zkusit znovu', onClick: loadData }}
      />
    );
  }

  return (
    <div className="options-list">
      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="options-alerts">
          <div className="options-alerts-header">
            <Text size="sm" weight="medium">
              Upozornění
            </Text>
            {alertCounts.danger > 0 && (
              <Badge variant="sell">{alertCounts.danger}</Badge>
            )}
            {alertCounts.warning > 0 && (
              <Badge variant="warning">{alertCounts.warning}</Badge>
            )}
          </div>
          <div className="options-alerts-list">
            {alerts.slice(0, 5).map((alert, idx) => (
              <div key={`${alert.optionSymbol}-${alert.type}-${idx}`}>
                <Text
                  as="span"
                  size="sm"
                  weight="medium"
                  color={alert.severity === 'danger' ? 'danger' : 'secondary'}
                >
                  {alert.severity === 'danger'
                    ? 'KRITICKÉ'
                    : alert.severity === 'warning'
                    ? 'VAROVÁNÍ'
                    : 'INFO'}
                </Text>
                <Text as="span" size="sm" color="muted">
                  {' '}
                  {alert.message}
                </Text>
              </div>
            ))}
            {alerts.length > 5 && (
              <Text size="sm" color="muted">
                +{alerts.length - 5} dalších
              </Text>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {enrichedHoldings.length > 0 && (
        <div className="options-summary">
          <div className="options-summary-grid">
            <div className="options-summary-item">
              <MetricLabel>Pozice</MetricLabel>
              <MetricValue>{enrichedHoldings.length}</MetricValue>
              <Text size="sm" color="muted">
                {totals.longCount} long / {totals.shortCount} short
              </Text>
            </div>
            <div className="options-summary-item">
              <MetricLabel>Čistá pozice</MetricLabel>
              <MetricValue
                sentiment={
                  totals.netPosition > 0
                    ? 'positive'
                    : totals.netPosition < 0
                    ? 'negative'
                    : 'neutral'
                }
              >
                {totals.netPosition >= 0 ? '+' : ''}
                {formatPrice(totals.netPosition, 'USD')}
              </MetricValue>
              <Text size="sm" color="muted">
                {totals.netPosition >= 0 ? 'kredit' : 'debit'}
              </Text>
            </div>
            {totals.longCount > 0 && (
              <div className="options-summary-item">
                <MetricLabel>Investováno</MetricLabel>
                <MetricValue>
                  {formatPrice(totals.longInvested, 'USD')}
                </MetricValue>
                <Text size="sm" color="muted">
                  long pozice
                </Text>
              </div>
            )}
            {totals.shortCount > 0 && (
              <div className="options-summary-item">
                <MetricLabel>Přijato</MetricLabel>
                <MetricValue>
                  {formatPrice(totals.shortReceived, 'USD')}
                </MetricValue>
                <Text size="sm" color="muted">
                  short pozice
                </Text>
              </div>
            )}
            {totals.expiringThisWeek > 0 && (
              <div className="options-summary-item options-summary-item--warning">
                <MetricLabel>Expiruje brzy</MetricLabel>
                <MetricValue>{totals.expiringThisWeek}</MetricValue>
                <Text size="sm" color="muted">
                  do 7 dní
                </Text>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Holdings List */}
      {enrichedHoldings.length === 0 ? (
        <EmptyState
          title="Žádné opční pozice"
          description="Začněte přidáním první opční transakce přes tlačítko v hlavičce"
        />
      ) : (
        <div className="options-groups">
          {groupedByExpiration.map(([expDate, holdingsInGroup]) => {
            const dte = calculateDTE(expDate);
            const dteCategory = getDTECategory(dte);

            return (
              <div key={expDate} className="options-group">
                <div className={`group-header group-header--${dteCategory}`}>
                  <Text weight="semibold">{formatDate(expDate)}</Text>
                  <Badge
                    variant={
                      dteCategory === 'critical'
                        ? 'sell'
                        : dteCategory === 'warning'
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {formatDTE(dte)}
                  </Badge>
                </div>

                <div className="options-cards">
                  {holdingsInGroup.map((holding) => (
                    <OptionCard
                      key={holding.option_symbol}
                      holding={holding}
                      stockPrice={stockPrices[holding.symbol]}
                      onEdit={onEditTransaction}
                      onClose={handleCloseOption}
                      onRefresh={loadData}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Close Option Modal */}
      <OptionTransactionModal
        isOpen={closingHolding !== null}
        onClose={() => setClosingHolding(null)}
        onSuccess={handleCloseModalSuccess}
        mode="close"
        portfolioId={portfolioId}
        holding={closingHolding}
      />
    </div>
  );
}

// Individual option card component
interface OptionCardProps {
  holding: EnrichedHolding;
  stockPrice?: number;
  onEdit?: (transaction: OptionTransaction) => void;
  onClose?: (holding: OptionHolding) => void;
  onRefresh?: () => void;
}

function OptionCard({
  holding,
  stockPrice,
  onEdit,
  onClose,
  onRefresh,
}: OptionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [transactions, setTransactions] = useState<OptionTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<OptionTransaction | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const isLong = holding.position === 'long';
  const typeLabel = holding.option_type === 'call' ? 'C' : 'P';

  // Calculate additional metrics
  const breakeven =
    holding.avg_premium !== null
      ? calculateBreakeven(
          holding.option_type,
          holding.strike_price,
          holding.avg_premium
        )
      : null;

  const maxProfitLoss =
    holding.avg_premium !== null
      ? calculateMaxProfitLoss(
          holding.option_type,
          holding.position,
          holding.strike_price,
          holding.avg_premium,
          holding.contracts
        )
      : null;

  const probabilityOfProfit = estimateProbabilityOfProfit(
    holding.delta,
    holding.position
  );

  // Load transactions when expanded
  useEffect(() => {
    if (expanded && transactions.length === 0) {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      // Get transactions for this specific option (by option_symbol)
      const allTx = await optionsApi.getTransactions(holding.portfolio_id);
      const filtered = allTx.filter(
        (tx) => tx.option_symbol === holding.option_symbol
      );
      setTransactions(filtered);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await optionsApi.deleteTransaction(deleteConfirm.id);
      setDeleteConfirm(null);
      // Reload transactions
      await loadTransactions();
      // Refresh parent list
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Collapsed Header - simple summary */}
      <div
        className={`option-card ${expanded ? 'option-card--expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Identity */}
        <div className="option-identity">
          <Ticker>{holding.symbol}</Ticker>
          <Badge variant={holding.option_type === 'call' ? 'buy' : 'sell'}>
            {typeLabel} ${holding.strike_price}
          </Badge>
          <Badge variant={isLong ? 'info' : 'warning'}>
            {isLong ? 'LONG' : 'SHORT'}
          </Badge>
        </div>

        {/* Value & Cost */}
        <div className="option-metric">
          <MetricValue>
            {holding.currentValue !== undefined ? (
              <>
                {formatPrice(holding.currentValue, 'USD')}
                <Text size="xs" color="muted">
                  {' '}
                  / {formatPrice(holding.total_cost, 'USD')}
                </Text>
              </>
            ) : (
              <Text size="sm">{formatPrice(holding.total_cost, 'USD')}</Text>
            )}
          </MetricValue>
        </div>

        {/* P/L */}
        <div className="option-metric">
          {holding.pl !== undefined ? (
            <MetricValue
              sentiment={
                holding.pl > 0
                  ? 'positive'
                  : holding.pl < 0
                  ? 'negative'
                  : 'neutral'
              }
            >
              {holding.pl >= 0 ? '+' : ''}
              {formatPrice(holding.pl, 'USD')}
              {holding.plPercent !== undefined && (
                <Text
                  size="xs"
                  color={
                    holding.plPercent > 0
                      ? 'success'
                      : holding.plPercent < 0
                      ? 'danger'
                      : 'muted'
                  }
                >
                  {' '}
                  ({holding.plPercent >= 0 ? '+' : ''}
                  {formatPercent(holding.plPercent)})
                </Text>
              )}
            </MetricValue>
          ) : (
            <MetricValue>
              <Muted>—</Muted>
            </MetricValue>
          )}
        </div>

        {/* Expand indicator */}
        <div className="option-expand">
          <Text size="sm" color="muted">
            {expanded ? '▲' : '▼'}
          </Text>
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="option-detail">
          {/* Metrics Grid */}
          <div className="option-detail-grid">
            {/* Underlying Price */}
            {stockPrice !== undefined && (
              <div className="detail-item">
                <MetricLabel>Cena podkladu ({holding.symbol})</MetricLabel>
                <MetricValue>{formatPrice(stockPrice, 'USD')}</MetricValue>
              </div>
            )}

            {/* Break-even */}
            <div className="detail-item">
              <MetricLabel>Break-even</MetricLabel>
              <MetricValue>
                {breakeven !== null ? (
                  formatPrice(breakeven, 'USD')
                ) : (
                  <Muted>—</Muted>
                )}
              </MetricValue>
            </div>

            {/* Current Price */}
            <div className="detail-item">
              <MetricLabel>Aktuální cena</MetricLabel>
              <MetricValue>
                {holding.current_price !== null ? (
                  <>
                    {formatPrice(holding.current_price, 'USD')}
                    {holding.avg_premium !== null && (
                      <Text size="xs" color="muted">
                        {' '}
                        (avg: {formatPrice(holding.avg_premium, 'USD')})
                      </Text>
                    )}
                  </>
                ) : (
                  <Muted>—</Muted>
                )}
              </MetricValue>
            </div>

            {/* Max Profit */}
            <div className="detail-item">
              <MetricLabel>Max Profit</MetricLabel>
              <MetricValue sentiment="positive">
                {maxProfitLoss ? (
                  maxProfitLoss.maxProfit === 'unlimited' ? (
                    '∞'
                  ) : (
                    formatPrice(maxProfitLoss.maxProfit, 'USD')
                  )
                ) : (
                  <Muted>—</Muted>
                )}
              </MetricValue>
            </div>

            {/* Max Loss */}
            <div className="detail-item">
              <MetricLabel>Max Loss</MetricLabel>
              <MetricValue sentiment="negative">
                {maxProfitLoss ? (
                  maxProfitLoss.maxLoss === 'unlimited' ? (
                    '∞'
                  ) : (
                    formatPrice(maxProfitLoss.maxLoss, 'USD')
                  )
                ) : (
                  <Muted>—</Muted>
                )}
              </MetricValue>
            </div>

            {/* Probability of Profit */}
            {probabilityOfProfit !== null && (
              <div className="detail-item">
                <MetricLabel>
                  Pravděpodobnost zisku
                  <InfoTooltip text="Odvozeno z Delta. Přibližný odhad pravděpodobnosti, že opce bude zisková při expiraci." />
                </MetricLabel>
                <MetricValue>~{probabilityOfProfit.toFixed(0)}%</MetricValue>
              </div>
            )}

            {/* Contracts */}
            <div className="detail-item">
              <MetricLabel>Kontrakty</MetricLabel>
              <MetricValue>{holding.contracts}×</MetricValue>
            </div>
          </div>

          {/* Greeks Section */}
          {(holding.delta !== null ||
            holding.gamma !== null ||
            holding.theta !== null ||
            holding.vega !== null) && (
            <div className="option-greeks-section">
              <div className="greeks-header">
                <Text size="sm" weight="medium">
                  Greeks
                </Text>
                <InfoTooltip position="bottom">
                  <div className="greeks-tooltip">
                    <strong>Řecká písmena (Greeks)</strong>
                    <p>Měří citlivost ceny opce na různé faktory:</p>
                    <dl>
                      <dt>Δ Delta (0 až ±1)</dt>
                      <dd>
                        Změna ceny opce při pohybu podkladu o $1.
                        <br />• Call: 0.5 = ATM, {'>'} 0.7 = ITM, {'<'} 0.3 =
                        OTM
                        <br />• Tip: Delta ≈ pravděpodobnost expirace ITM
                      </dd>
                      <dt>Γ Gamma</dt>
                      <dd>Rychlost změny Delty. Nejvyšší u ATM opcí.</dd>
                      <dt>Θ Theta</dt>
                      <dd>
                        Denní ztráta hodnoty časem (time decay).
                        <br />• Long: pracuje proti vám
                        <br />• Short: pracuje pro vás
                      </dd>
                      <dt>V Vega</dt>
                      <dd>Změna ceny při změně IV o 1%.</dd>
                    </dl>
                  </div>
                </InfoTooltip>
              </div>
              <div className="option-greeks">
                {holding.delta !== null && (
                  <div className="greek-item">
                    <Text size="xs" color="muted">
                      Δ
                    </Text>
                    <Text size="sm">{holding.delta.toFixed(2)}</Text>
                  </div>
                )}
                {holding.gamma !== null && (
                  <div className="greek-item">
                    <Text size="xs" color="muted">
                      Γ
                    </Text>
                    <Text size="sm">{holding.gamma.toFixed(4)}</Text>
                  </div>
                )}
                {holding.theta !== null && (
                  <div className="greek-item">
                    <Text size="xs" color="muted">
                      Θ
                    </Text>
                    <Text
                      size="sm"
                      color={holding.theta < 0 ? 'danger' : 'success'}
                    >
                      {formatPrice(
                        holding.theta * holding.contracts * 100,
                        'USD'
                      )}
                      /den
                    </Text>
                  </div>
                )}
                {holding.vega !== null && (
                  <div className="greek-item">
                    <Text size="xs" color="muted">
                      V
                    </Text>
                    <Text size="sm">{holding.vega.toFixed(2)}</Text>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transactions Section */}
          <div className="option-transactions-section">
            <div className="option-transactions-header">
              <Text size="sm" weight="medium">
                Transakce
              </Text>
              {onClose && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(holding);
                  }}
                >
                  Uzavřít pozici
                </Button>
              )}
            </div>
            {loadingTx ? (
              <div className="option-transactions-loading">
                <LoadingSpinner size="sm" />
              </div>
            ) : transactions.length === 0 ? (
              <Text color="muted" size="sm">
                Žádné transakce
              </Text>
            ) : (
              <div className="transactions-list">
                {transactions.map((tx) => (
                  <div key={tx.id} className="transaction-row">
                    <div className="transaction-content">
                      <div className="transaction-info">
                        <Badge
                          variant={
                            tx.action === 'BTO' || tx.action === 'BTC'
                              ? 'buy'
                              : tx.action === 'STO' || tx.action === 'STC'
                              ? 'sell'
                              : 'info'
                          }
                        >
                          {ACTION_LABELS[tx.action] || tx.action}
                        </Badge>
                        <Text size="sm">{formatDate(tx.date)}</Text>
                        <Text size="sm">
                          {tx.contracts}× @{' '}
                          {formatPrice(tx.premium || 0, 'USD')}
                        </Text>
                      </div>
                      {tx.notes && (
                        <div className="transaction-notes">
                          <Text size="xs" color="muted">
                            {tx.notes}
                          </Text>
                        </div>
                      )}
                    </div>
                    <div className="transaction-actions">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(tx);
                          }}
                        >
                          Upravit
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(tx);
                        }}
                      >
                        Smazat
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Smazat transakci?"
        message={`Opravdu chcete smazat transakci ${
          deleteConfirm ? ACTION_LABELS[deleteConfirm.action] : ''
        }?`}
        confirmLabel={deleting ? 'Mažu...' : 'Smazat'}
        cancelLabel="Zrušit"
        variant="danger"
      />
    </>
  );
}
