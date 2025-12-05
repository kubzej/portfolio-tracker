import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSnapshots,
  getSnapshotWithHoldings,
  getResearchTracked,
  getChanges,
  getSignalHistory,
  removeResearchTracked,
  type DailySnapshot,
  type SnapshotHolding,
  type ResearchTracked,
} from '@/services/api/tracker';
import type { SignalType } from '@/utils/recommendations';
import {
  LoadingSpinner,
  EmptyState,
  ErrorState,
  Tabs,
  SignalBadge,
  MobileSortControl,
  MetricCard,
  ToggleGroup,
  type SortField as MobileSortField,
} from '@/components/shared';
import type { ToggleOption } from '@/components/shared/ToggleGroup';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import {
  SectionTitle,
  Text,
  Ticker,
  StockName,
  Caption,
  Muted,
  Badge,
  MetricLabel,
  MetricValue,
  SortIcon,
} from '@/components/shared/Typography';
import { useSortable } from '@/hooks';
import { formatCurrency, formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import './Tracker.css';

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'snapshots' | 'changes' | 'research' | 'signals';
type SourceFilter = 'all' | 'portfolio' | 'research';
type TimeRange = '7d' | '30d' | '90d' | 'all';

type SortFieldKey =
  | 'ticker'
  | 'current_price'
  | 'composite_score'
  | 'primary_signal'
  | 'weight'
  | 'unrealized_gain_pct';

const SORT_FIELDS: MobileSortField[] = [
  { value: 'ticker', label: 'Ticker', defaultDirection: 'asc' },
  { value: 'current_price', label: 'Cena', defaultDirection: 'desc' },
  { value: 'composite_score', label: 'Skóre', defaultDirection: 'desc' },
  { value: 'weight', label: 'Váha', defaultDirection: 'desc' },
  { value: 'unrealized_gain_pct', label: 'Zisk %', defaultDirection: 'desc' },
];

const TABS = [
  { value: 'snapshots', label: 'Snapshoty' },
  { value: 'changes', label: 'Změny' },
  { value: 'research', label: 'Sledované' },
  { value: 'signals', label: 'Historie' },
];

const SOURCE_FILTER_OPTIONS: ToggleOption[] = [
  { value: 'all', label: 'Vše' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'research', label: 'Sledované' },
];

const TIME_RANGE_OPTIONS: ToggleOption[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'Vše' },
];

// Approximate USD to CZK rate (in production, this would come from an API)
const USD_TO_CZK = 24;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface TrackerProps {
  onOpenResearch?: (
    ticker: string,
    stockName?: string,
    finnhubTicker?: string
  ) => void;
}

export function Tracker({ onOpenResearch }: TrackerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('snapshots');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [portfolioFilter, setPortfolioFilter] = useState<string>('all');
  const [availablePortfolios, setAvailablePortfolios] = useState<string[]>([]);
  const [availableSnapshots, setAvailableSnapshots] = useState<DailySnapshot[]>(
    []
  );
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [latestSnapshot, setLatestSnapshot] = useState<DailySnapshot | null>(
    null
  );
  const [holdings, setHoldings] = useState<SnapshotHolding[]>([]);
  const [changes, setChanges] = useState<
    Array<{ snapshot_date: string; holding: SnapshotHolding }>
  >([]);
  const [researchTracked, setResearchTracked] = useState<ResearchTracked[]>([]);
  const [signalHistory, setSignalHistory] = useState<
    Array<{
      id: string;
      ticker: string;
      stock_name: string | null;
      signal_type: string;
      price_at_signal: number;
      created_at: string;
      source: string | null;
      price_1d: number | null;
      price_1w: number | null;
      price_1m: number | null;
      price_3m: number | null;
    }>
  >([]);

  // Recalculate weights when specific portfolio is selected
  const holdingsWithRecalculatedWeight = useMemo(() => {
    // If 'all' portfolios selected, use original weights from DB
    if (portfolioFilter === 'all') {
      return holdings;
    }

    // Calculate total value of filtered holdings
    const totalValue = holdings.reduce((sum, h) => {
      return sum + (h.current_value || 0);
    }, 0);

    // Recalculate weight for each holding
    return holdings.map((h) => ({
      ...h,
      weight:
        totalValue > 0 && h.current_value !== null
          ? (h.current_value / totalValue) * 100
          : null,
    }));
  }, [holdings, portfolioFilter]);

  // Sorting for holdings
  const getHoldingValue = useCallback(
    (item: SnapshotHolding, field: SortFieldKey) => {
      switch (field) {
        case 'ticker':
          return item.ticker;
        case 'current_price':
          return item.current_price;
        case 'composite_score':
          return item.composite_score;
        case 'primary_signal':
          return item.primary_signal;
        case 'weight':
          return item.weight;
        case 'unrealized_gain_pct':
          return item.unrealized_gain_pct;
        default:
          return null;
      }
    },
    []
  );

  const {
    sortedData: sortedHoldings,
    sortField,
    sortDirection,
    handleSort,
    setSort,
  } = useSortable<SnapshotHolding, SortFieldKey>(
    holdingsWithRecalculatedWeight,
    getHoldingValue,
    {
      defaultField: 'ticker',
      ascendingFields: ['ticker'],
    }
  );

  // Calculate date range
  const getDateRange = useCallback(() => {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case 'all':
        start.setFullYear(start.getFullYear() - 5);
        break;
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [timeRange]);

  // Reset portfolio filter when switching to research-only
  useEffect(() => {
    if (sourceFilter === 'research') {
      setPortfolioFilter('all');
    }
  }, [sourceFilter]);

  // Load data based on active tab
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    timeRange,
    sourceFilter,
    portfolioFilter,
    selectedSnapshotDate,
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();

      switch (activeTab) {
        case 'snapshots': {
          const snapshots = await getSnapshots(undefined, undefined, 30);
          setAvailableSnapshots(snapshots);

          const snapshotDate =
            selectedSnapshotDate || snapshots[0]?.snapshot_date;
          const snapshot =
            snapshots.find((s) => s.snapshot_date === snapshotDate) ||
            snapshots[0] ||
            null;
          setLatestSnapshot(snapshot);

          if (!selectedSnapshotDate && snapshot) {
            setSelectedSnapshotDate(snapshot.snapshot_date);
          }

          if (snapshot) {
            const snapshotData = await getSnapshotWithHoldings(
              snapshot.snapshot_date
            );
            let filteredHoldings = snapshotData?.holdings || [];

            const portfolioNames = [
              ...new Set(
                filteredHoldings
                  .filter((h) => h.source === 'portfolio' && h.portfolio_name)
                  .map((h) => h.portfolio_name as string)
              ),
            ].sort();
            setAvailablePortfolios(portfolioNames);

            if (sourceFilter !== 'all') {
              filteredHoldings = filteredHoldings.filter(
                (h) => h.source === sourceFilter
              );
            }

            if (portfolioFilter !== 'all') {
              filteredHoldings = filteredHoldings.filter(
                (h) => h.portfolio_name === portfolioFilter
              );
            }

            setHoldings(filteredHoldings);
          } else {
            setHoldings([]);
            setAvailablePortfolios([]);
          }
          break;
        }

        case 'changes': {
          const changesData = await getChanges(
            startDate,
            endDate,
            sourceFilter === 'all' ? undefined : sourceFilter
          );
          setChanges(
            changesData.map((c) => ({
              snapshot_date: c.snapshot_date,
              holding: c.holding,
            }))
          );
          break;
        }

        case 'research': {
          const tracked = await getResearchTracked('active');
          setResearchTracked(tracked);
          break;
        }

        case 'signals': {
          const signals = await getSignalHistory(
            undefined,
            sourceFilter === 'all' ? undefined : sourceFilter,
            200
          );
          setSignalHistory(signals);
          break;
        }
      }
    } catch (err) {
      console.error('Error loading tracker data:', err);
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se načíst data'
      );
    } finally {
      setLoading(false);
    }
  };

  // Portfolio options for BottomSheetSelect
  const portfolioOptions: SelectOption[] = [
    { value: 'all', label: 'Všechna portfolia' },
    ...availablePortfolios.map((name) => ({ value: name, label: name })),
  ];

  // Snapshot date options for BottomSheetSelect
  const snapshotOptions: SelectOption[] = availableSnapshots.map((s) => ({
    value: s.snapshot_date,
    label: formatDate(s.snapshot_date),
  }));

  // ============================================================================
  // RENDER: SNAPSHOTS TAB
  // ============================================================================

  const renderSnapshotsTab = () => {
    if (!latestSnapshot) {
      return (
        <EmptyState
          title="Žádné snapshoty"
          description="Zatím nebyly vytvořeny žádné denní snapshoty."
        />
      );
    }

    return (
      <div className="tracker-tab-content">
        {/* Summary metrics */}
        <div className="tracker-summary">
          <div className="summary-header">
            {availableSnapshots.length > 1 ? (
              <BottomSheetSelect
                value={selectedSnapshotDate || ''}
                onChange={setSelectedSnapshotDate}
                options={snapshotOptions}
                placeholder="Vybrat datum"
                title="Snapshot"
              />
            ) : (
              <SectionTitle>
                {formatDate(latestSnapshot.snapshot_date)}
              </SectionTitle>
            )}
          </div>

          <div className="summary-grid">
            <MetricCard
              label="Celková hodnota"
              value={
                latestSnapshot.portfolio_total_value
                  ? formatCurrency(
                      latestSnapshot.portfolio_total_value * USD_TO_CZK,
                      'CZK'
                    )
                  : null
              }
              size="lg"
            />
            <MetricCard
              label="Pozic celkem"
              value={latestSnapshot.portfolio_positions_count}
              size="lg"
            />
            <MetricCard
              label="Sledovaných akcií"
              value={latestSnapshot.research_tracked_count}
              size="lg"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="tracker-filters">
          <ToggleGroup
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v as SourceFilter)}
            options={SOURCE_FILTER_OPTIONS}
            size="sm"
          />

          {sourceFilter !== 'research' && availablePortfolios.length > 1 && (
            <BottomSheetSelect
              value={portfolioFilter}
              onChange={setPortfolioFilter}
              options={portfolioOptions}
              placeholder="Portfolio"
              title="Filtr portfolia"
            />
          )}

          <span className="filter-count">{holdings.length} pozic</span>

          <div className="mobile-only">
            <MobileSortControl
              fields={SORT_FIELDS}
              selectedField={sortField}
              direction={sortDirection}
              onFieldChange={(field) => {
                const config = SORT_FIELDS.find((f) => f.value === field);
                setSort(
                  field as SortFieldKey,
                  config?.defaultDirection || 'desc'
                );
              }}
              onDirectionChange={(dir) => setSort(sortField, dir)}
            />
          </div>
        </div>

        {/* Holdings */}
        {holdings.length === 0 ? (
          <EmptyState
            title="Žádné pozice"
            description="V tomto snapshotu nejsou žádné pozice."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="tracker-table-wrapper">
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th
                      className="sortable"
                      onClick={() => handleSort('ticker')}
                    >
                      Akcie{' '}
                      <SortIcon
                        direction={
                          sortField === 'ticker' ? sortDirection : 'none'
                        }
                        active={sortField === 'ticker'}
                      />
                    </th>
                    <th>Zdroj</th>
                    <th
                      className="sortable text-right"
                      onClick={() => handleSort('current_price')}
                    >
                      Cena (USD){' '}
                      <SortIcon
                        direction={
                          sortField === 'current_price' ? sortDirection : 'none'
                        }
                        active={sortField === 'current_price'}
                      />
                    </th>
                    <th className="text-right">Hodnota CZK</th>
                    <th
                      className="sortable text-right"
                      onClick={() => handleSort('weight')}
                    >
                      Váha{' '}
                      <SortIcon
                        direction={
                          sortField === 'weight' ? sortDirection : 'none'
                        }
                        active={sortField === 'weight'}
                      />
                    </th>
                    <th
                      className="sortable text-right"
                      onClick={() => handleSort('unrealized_gain_pct')}
                    >
                      Zisk{' '}
                      <SortIcon
                        direction={
                          sortField === 'unrealized_gain_pct'
                            ? sortDirection
                            : 'none'
                        }
                        active={sortField === 'unrealized_gain_pct'}
                      />
                    </th>
                    <th
                      className="sortable text-center"
                      onClick={() => handleSort('composite_score')}
                    >
                      Skóre{' '}
                      <SortIcon
                        direction={
                          sortField === 'composite_score'
                            ? sortDirection
                            : 'none'
                        }
                        active={sortField === 'composite_score'}
                      />
                    </th>
                    <th>Signál</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((h) => (
                    <tr
                      key={h.id}
                      className={cn(h.signal_changed && 'row-highlight')}
                    >
                      <td>
                        <div className="stock-cell">
                          <button
                            className="ticker-link"
                            onClick={() =>
                              onOpenResearch?.(
                                h.ticker,
                                h.stock_name ?? undefined
                              )
                            }
                          >
                            <Ticker>{h.ticker}</Ticker>
                          </button>
                          {h.stock_name && (
                            <StockName truncate>{h.stock_name}</StockName>
                          )}
                          {h.portfolio_name && (
                            <Caption>{h.portfolio_name}</Caption>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge
                          variant={
                            h.source === 'portfolio' ? 'info' : 'warning'
                          }
                          size="sm"
                        >
                          {h.source === 'portfolio' ? 'Portfolio' : 'Research'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Text weight="medium">
                          {h.current_price ? (
                            `$${h.current_price.toFixed(2)}`
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </Text>
                      </td>
                      <td className="text-right">
                        <Text weight="medium">
                          {h.current_value !== null ? (
                            formatCurrency(h.current_value * USD_TO_CZK, 'CZK')
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </Text>
                      </td>
                      <td className="text-right">
                        <Text weight="medium">
                          {h.weight !== null ? (
                            `${h.weight.toFixed(1)}%`
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </Text>
                      </td>
                      <td className="text-right">
                        {h.unrealized_gain !== null ? (
                          <div className="gain-cell">
                            <MetricValue
                              sentiment={
                                h.unrealized_gain > 0
                                  ? 'positive'
                                  : h.unrealized_gain < 0
                                  ? 'negative'
                                  : 'neutral'
                              }
                            >
                              {formatCurrency(
                                h.unrealized_gain * USD_TO_CZK,
                                'CZK'
                              )}
                            </MetricValue>
                            <Text
                              size="sm"
                              color={
                                (h.unrealized_gain_pct || 0) >= 0
                                  ? 'success'
                                  : 'danger'
                              }
                            >
                              {h.unrealized_gain_pct !== null
                                ? `${
                                    h.unrealized_gain_pct > 0 ? '+' : ''
                                  }${h.unrealized_gain_pct.toFixed(1)}%`
                                : '—'}
                            </Text>
                          </div>
                        ) : (
                          <Muted>—</Muted>
                        )}
                      </td>
                      <td className="text-center">
                        {h.composite_score !== null ? (
                          <div className="score-with-conviction">
                            <Text weight="semibold">{h.composite_score}</Text>
                            {h.conviction_level && (
                              <Badge
                                variant={
                                  h.conviction_level === 'HIGH'
                                    ? 'buy'
                                    : h.conviction_level === 'MEDIUM'
                                    ? 'hold'
                                    : 'info'
                                }
                                size="sm"
                              >
                                {h.conviction_level === 'HIGH'
                                  ? 'H'
                                  : h.conviction_level === 'MEDIUM'
                                  ? 'M'
                                  : 'L'}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Muted>—</Muted>
                        )}
                      </td>
                      <td>
                        <div className="signal-cell">
                          {h.primary_signal ? (
                            <SignalBadge
                              type={h.primary_signal as SignalType}
                              size="sm"
                            />
                          ) : (
                            <Muted>—</Muted>
                          )}
                          {h.quality_signal && (
                            <SignalBadge
                              type={h.quality_signal as SignalType}
                              size="sm"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="tracker-cards">
              {sortedHoldings.map((h) => (
                <div
                  key={h.id}
                  className={cn(
                    'tracker-card',
                    h.signal_changed && 'card-highlight'
                  )}
                >
                  <div className="card-header">
                    <button
                      className="ticker-link"
                      onClick={() =>
                        onOpenResearch?.(h.ticker, h.stock_name ?? undefined)
                      }
                    >
                      <Ticker size="lg">{h.ticker}</Ticker>
                    </button>
                    <Badge
                      variant={h.source === 'portfolio' ? 'info' : 'warning'}
                      size="sm"
                    >
                      {h.source === 'portfolio' ? 'Portfolio' : 'Research'}
                    </Badge>
                  </div>

                  {h.stock_name && (
                    <StockName truncate>{h.stock_name}</StockName>
                  )}
                  {h.portfolio_name && <Caption>{h.portfolio_name}</Caption>}

                  <div className="card-metrics">
                    <div className="card-metric">
                      <MetricLabel>Cena (USD)</MetricLabel>
                      <Text weight="medium">
                        {h.current_price
                          ? `$${h.current_price.toFixed(2)}`
                          : '—'}
                      </Text>
                    </div>
                    {h.weight !== null && (
                      <div className="card-metric">
                        <MetricLabel>Váha</MetricLabel>
                        <Text weight="medium">{h.weight.toFixed(1)}%</Text>
                      </div>
                    )}
                    {h.unrealized_gain_pct !== null && (
                      <div className="card-metric">
                        <MetricLabel>Zisk</MetricLabel>
                        <MetricValue
                          sentiment={
                            h.unrealized_gain_pct > 0
                              ? 'positive'
                              : h.unrealized_gain_pct < 0
                              ? 'negative'
                              : 'neutral'
                          }
                        >
                          {h.unrealized_gain_pct > 0 ? '+' : ''}
                          {h.unrealized_gain_pct.toFixed(1)}%
                        </MetricValue>
                      </div>
                    )}
                    {h.composite_score !== null && (
                      <div className="card-metric">
                        <MetricLabel>Skóre</MetricLabel>
                        <div className="score-with-conviction">
                          <Text weight="semibold">{h.composite_score}</Text>
                          {h.conviction_level && (
                            <Badge
                              variant={
                                h.conviction_level === 'HIGH'
                                  ? 'buy'
                                  : h.conviction_level === 'MEDIUM'
                                  ? 'hold'
                                  : 'info'
                              }
                              size="sm"
                            >
                              {h.conviction_level === 'HIGH'
                                ? 'H'
                                : h.conviction_level === 'MEDIUM'
                                ? 'M'
                                : 'L'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="card-signals">
                    {h.primary_signal && (
                      <SignalBadge type={h.primary_signal as SignalType} />
                    )}
                    {h.quality_signal && (
                      <SignalBadge type={h.quality_signal as SignalType} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER: CHANGES TAB
  // ============================================================================

  const renderChangesTab = () => {
    // Group by date
    const groupedByDate = changes.reduce((acc, change) => {
      const date = change.snapshot_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(change.holding);
      return acc;
    }, {} as Record<string, SnapshotHolding[]>);

    return (
      <div className="tracker-tab-content">
        {/* Filters */}
        <div className="tracker-filters">
          <ToggleGroup
            value={timeRange}
            onChange={(v) => setTimeRange(v as TimeRange)}
            options={TIME_RANGE_OPTIONS}
            size="sm"
          />
          <ToggleGroup
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v as SourceFilter)}
            options={SOURCE_FILTER_OPTIONS}
            size="sm"
          />
        </div>

        {changes.length === 0 ? (
          <EmptyState
            title="Žádné změny"
            description="Ve zvoleném období nedošlo k žádným významným změnám."
          />
        ) : (
          <div className="changes-timeline">
            {Object.entries(groupedByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, dayChanges]) => (
                <div key={date} className="changes-day">
                  <SectionTitle>{formatDate(date)}</SectionTitle>
                  <div className="changes-list">
                    {dayChanges.map((h) => (
                      <div key={h.id} className="change-card">
                        <div className="change-card-header">
                          <button
                            className="ticker-link"
                            onClick={() =>
                              onOpenResearch?.(
                                h.ticker,
                                h.stock_name ?? undefined
                              )
                            }
                          >
                            <Ticker>{h.ticker}</Ticker>
                          </button>
                          <Badge
                            variant={
                              h.source === 'portfolio' ? 'info' : 'warning'
                            }
                            size="sm"
                          >
                            {h.source === 'portfolio'
                              ? 'Portfolio'
                              : 'Research'}
                          </Badge>
                        </div>

                        <div className="change-tags">
                          {h.signal_changed && (
                            <div className="change-tag signal">
                              <Caption>Signál změněn</Caption>
                              {h.primary_signal && (
                                <SignalBadge
                                  type={h.primary_signal as SignalType}
                                  size="sm"
                                />
                              )}
                            </div>
                          )}
                          {h.conviction_changed && (
                            <div className="change-tag conviction">
                              <Caption>Conviction</Caption>
                              {h.conviction_level && (
                                <Badge
                                  variant={
                                    h.conviction_level === 'HIGH'
                                      ? 'buy'
                                      : h.conviction_level === 'MEDIUM'
                                      ? 'hold'
                                      : 'info'
                                  }
                                  size="sm"
                                >
                                  {h.conviction_level}
                                </Badge>
                              )}
                            </div>
                          )}
                          {h.score_changed && (
                            <div className="change-tag score">
                              <Caption>Skóre ±5</Caption>
                              <Text weight="semibold">{h.composite_score}</Text>
                            </div>
                          )}
                          {h.price_changed && (
                            <div className="change-tag price">
                              <Caption>Cena ±3%</Caption>
                              <Text weight="medium">
                                {h.current_price
                                  ? `$${h.current_price.toFixed(2)}`
                                  : '—'}
                              </Text>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER: RESEARCH TAB
  // ============================================================================

  const renderResearchTab = () => {
    if (researchTracked.length === 0) {
      return (
        <EmptyState
          title="Žádné sledované akcie"
          description="Přidejte akcie ke sledování z Research view."
        />
      );
    }

    return (
      <div className="tracker-tab-content">
        {/* Filters */}
        <div className="tracker-filters">
          <span className="filter-count">
            {researchTracked.length} sledovaných akcií
          </span>
        </div>

        {/* Desktop table */}
        <div className="tracker-table-wrapper">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Akcie</th>
                <th className="text-right">Při přidání (USD)</th>
                <th className="text-right">Aktuálně (USD)</th>
                <th className="text-right">Změna</th>
                <th className="text-center">Skóre při přidání</th>
                <th>Signál při přidání</th>
                <th>Aktuální signál</th>
                <th>Aktualizováno</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {researchTracked.map((rt) => (
                <tr key={rt.id}>
                  <td>
                    <div className="stock-cell">
                      <button
                        className="ticker-link"
                        onClick={() =>
                          onOpenResearch?.(
                            rt.ticker,
                            rt.stock_name ?? undefined,
                            rt.finnhub_ticker ?? undefined
                          )
                        }
                      >
                        <Ticker>{rt.ticker}</Ticker>
                      </button>
                      {rt.stock_name && (
                        <StockName truncate>{rt.stock_name}</StockName>
                      )}
                      <Caption>{formatDate(rt.added_at)}</Caption>
                    </div>
                  </td>
                  <td className="text-right">
                    <Text weight="medium">
                      {rt.added_price ? (
                        `$${rt.added_price.toFixed(2)}`
                      ) : (
                        <Muted>—</Muted>
                      )}
                    </Text>
                  </td>
                  <td className="text-right">
                    <Text weight="medium">
                      {rt.current_price ? (
                        `$${rt.current_price.toFixed(2)}`
                      ) : (
                        <Muted>—</Muted>
                      )}
                    </Text>
                  </td>
                  <td className="text-right">
                    {rt.price_change_pct !== null ? (
                      <MetricValue
                        sentiment={
                          rt.price_change_pct > 0
                            ? 'positive'
                            : rt.price_change_pct < 0
                            ? 'negative'
                            : 'neutral'
                        }
                      >
                        {rt.price_change_pct > 0 ? '+' : ''}
                        {rt.price_change_pct.toFixed(1)}%
                      </MetricValue>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td className="text-center">
                    {rt.added_composite_score !== null ? (
                      <div className="score-with-conviction">
                        <Text weight="semibold">
                          {rt.added_composite_score}
                        </Text>
                        {rt.added_conviction_level && (
                          <Badge
                            variant={
                              rt.added_conviction_level === 'HIGH'
                                ? 'buy'
                                : rt.added_conviction_level === 'MEDIUM'
                                ? 'hold'
                                : 'info'
                            }
                            size="sm"
                          >
                            {rt.added_conviction_level === 'HIGH'
                              ? 'H'
                              : rt.added_conviction_level === 'MEDIUM'
                              ? 'M'
                              : 'L'}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td>
                    {rt.added_signal ? (
                      <SignalBadge
                        type={rt.added_signal as SignalType}
                        size="sm"
                      />
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td>
                    {rt.current_signal ? (
                      <SignalBadge
                        type={rt.current_signal as SignalType}
                        size="sm"
                      />
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td>
                    <Caption>
                      {rt.last_updated ? formatDate(rt.last_updated) : '—'}
                    </Caption>
                  </td>
                  <td>
                    <button
                      className="remove-btn"
                      onClick={async () => {
                        if (confirm(`Odstranit ${rt.ticker} ze sledování?`)) {
                          await removeResearchTracked(rt.id);
                          setResearchTracked((prev) =>
                            prev.filter((r) => r.id !== rt.id)
                          );
                        }
                      }}
                      title="Odstranit ze sledování"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="tracker-cards">
          {researchTracked.map((rt) => (
            <div key={rt.id} className="tracker-card">
              <div className="card-header">
                <button
                  className="ticker-link"
                  onClick={() =>
                    onOpenResearch?.(
                      rt.ticker,
                      rt.stock_name ?? undefined,
                      rt.finnhub_ticker ?? undefined
                    )
                  }
                >
                  <Ticker size="lg">{rt.ticker}</Ticker>
                </button>
                <Caption>{formatDate(rt.added_at)}</Caption>
              </div>

              {rt.stock_name && <StockName truncate>{rt.stock_name}</StockName>}

              <div className="card-metrics">
                <div className="card-metric">
                  <MetricLabel>Při přidání</MetricLabel>
                  <Text weight="medium">
                    {rt.added_price ? `$${rt.added_price.toFixed(2)}` : '—'}
                  </Text>
                </div>
                <div className="card-metric">
                  <MetricLabel>Aktuálně</MetricLabel>
                  <Text weight="medium">
                    {rt.current_price ? `$${rt.current_price.toFixed(2)}` : '—'}
                  </Text>
                </div>
                {rt.price_change_pct !== null && (
                  <div className="card-metric">
                    <MetricLabel>Změna</MetricLabel>
                    <MetricValue
                      sentiment={
                        rt.price_change_pct > 0
                          ? 'positive'
                          : rt.price_change_pct < 0
                          ? 'negative'
                          : 'neutral'
                      }
                    >
                      {rt.price_change_pct > 0 ? '+' : ''}
                      {rt.price_change_pct.toFixed(1)}%
                    </MetricValue>
                  </div>
                )}
                {rt.added_composite_score !== null && (
                  <div className="card-metric">
                    <MetricLabel>Skóre při přidání</MetricLabel>
                    <div className="score-with-conviction">
                      <Text weight="semibold">{rt.added_composite_score}</Text>
                      {rt.added_conviction_level && (
                        <Badge
                          variant={
                            rt.added_conviction_level === 'HIGH'
                              ? 'buy'
                              : rt.added_conviction_level === 'MEDIUM'
                              ? 'hold'
                              : 'info'
                          }
                          size="sm"
                        >
                          {rt.added_conviction_level === 'HIGH'
                            ? 'H'
                            : rt.added_conviction_level === 'MEDIUM'
                            ? 'M'
                            : 'L'}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {rt.last_updated && (
                  <div className="card-metric">
                    <MetricLabel>Aktualizováno</MetricLabel>
                    <Caption>{formatDate(rt.last_updated)}</Caption>
                  </div>
                )}
              </div>

              <div className="card-signals-compare">
                {rt.added_signal && (
                  <div className="signal-item">
                    <Caption>Přidáno:</Caption>
                    <SignalBadge type={rt.added_signal as SignalType} />
                  </div>
                )}
                {rt.current_signal && (
                  <div className="signal-item">
                    <Caption>Nyní:</Caption>
                    <SignalBadge type={rt.current_signal as SignalType} />
                  </div>
                )}
              </div>

              <button
                className="remove-btn-mobile"
                onClick={async () => {
                  if (confirm(`Odstranit ${rt.ticker} ze sledování?`)) {
                    await removeResearchTracked(rt.id);
                    setResearchTracked((prev) =>
                      prev.filter((r) => r.id !== rt.id)
                    );
                  }
                }}
              >
                Odstranit ze sledování
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER: SIGNALS TAB
  // ============================================================================

  const renderSignalsTab = () => {
    return (
      <div className="tracker-tab-content">
        {/* Filters - always visible */}
        <div className="tracker-filters">
          <ToggleGroup
            value={sourceFilter}
            onChange={(v) => setSourceFilter(v as SourceFilter)}
            options={SOURCE_FILTER_OPTIONS}
            size="sm"
          />
          <span className="filter-count">{signalHistory.length} signálů</span>
        </div>

        {signalHistory.length === 0 ? (
          <EmptyState
            title="Žádná historie signálů"
            description={
              sourceFilter === 'all'
                ? 'Zatím nebyly zaznamenány žádné signály.'
                : sourceFilter === 'portfolio'
                ? 'Žádné signály pro portfolio.'
                : 'Žádné signály pro sledované akcie.'
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="tracker-table-wrapper">
              <table className="tracker-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Akcie</th>
                    <th>Signál</th>
                    <th>Zdroj</th>
                    <th className="text-right">Cena (USD)</th>
                    <th className="text-right">+1D</th>
                    <th className="text-right">+1W</th>
                    <th className="text-right">+1M</th>
                    <th className="text-right">+3M</th>
                  </tr>
                </thead>
                <tbody>
                  {signalHistory.map((s) => {
                    const calc1d =
                      s.price_1d && s.price_at_signal
                        ? ((s.price_1d - s.price_at_signal) /
                            s.price_at_signal) *
                          100
                        : null;
                    const calc1w =
                      s.price_1w && s.price_at_signal
                        ? ((s.price_1w - s.price_at_signal) /
                            s.price_at_signal) *
                          100
                        : null;
                    const calc1m =
                      s.price_1m && s.price_at_signal
                        ? ((s.price_1m - s.price_at_signal) /
                            s.price_at_signal) *
                          100
                        : null;
                    const calc3m =
                      s.price_3m && s.price_at_signal
                        ? ((s.price_3m - s.price_at_signal) /
                            s.price_at_signal) *
                          100
                        : null;

                    return (
                      <tr key={s.id}>
                        <td>
                          <Text size="sm">{formatDate(s.created_at)}</Text>
                        </td>
                        <td>
                          <button
                            className="ticker-link"
                            onClick={() => onOpenResearch?.(s.ticker)}
                          >
                            <Ticker>{s.ticker}</Ticker>
                          </button>
                        </td>
                        <td>
                          <SignalBadge
                            type={s.signal_type as SignalType}
                            size="sm"
                          />
                        </td>
                        <td>
                          <Badge
                            variant={
                              s.source === 'portfolio' || !s.source
                                ? 'info'
                                : 'warning'
                            }
                            size="sm"
                          >
                            {s.source || 'portfolio'}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <Text size="sm" weight="medium">
                            ${s.price_at_signal.toFixed(2)}
                          </Text>
                        </td>
                        <td className="text-right">
                          {calc1d !== null ? (
                            <MetricValue
                              size="sm"
                              sentiment={
                                calc1d > 0
                                  ? 'positive'
                                  : calc1d < 0
                                  ? 'negative'
                                  : 'neutral'
                              }
                            >
                              {calc1d > 0 ? '+' : ''}
                              {calc1d.toFixed(1)}%
                            </MetricValue>
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </td>
                        <td className="text-right">
                          {calc1w !== null ? (
                            <MetricValue
                              size="sm"
                              sentiment={
                                calc1w > 0
                                  ? 'positive'
                                  : calc1w < 0
                                  ? 'negative'
                                  : 'neutral'
                              }
                            >
                              {calc1w > 0 ? '+' : ''}
                              {calc1w.toFixed(1)}%
                            </MetricValue>
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </td>
                        <td className="text-right">
                          {calc1m !== null ? (
                            <MetricValue
                              size="sm"
                              sentiment={
                                calc1m > 0
                                  ? 'positive'
                                  : calc1m < 0
                                  ? 'negative'
                                  : 'neutral'
                              }
                            >
                              {calc1m > 0 ? '+' : ''}
                              {calc1m.toFixed(1)}%
                            </MetricValue>
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </td>
                        <td className="text-right">
                          {calc3m !== null ? (
                            <MetricValue
                              size="sm"
                              sentiment={
                                calc3m > 0
                                  ? 'positive'
                                  : calc3m < 0
                                  ? 'negative'
                                  : 'neutral'
                              }
                            >
                              {calc3m > 0 ? '+' : ''}
                              {calc3m.toFixed(1)}%
                            </MetricValue>
                          ) : (
                            <Muted>—</Muted>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="tracker-cards">
              {signalHistory.map((s) => {
                const calc1d =
                  s.price_1d && s.price_at_signal
                    ? ((s.price_1d - s.price_at_signal) / s.price_at_signal) *
                      100
                    : null;
                const calc1w =
                  s.price_1w && s.price_at_signal
                    ? ((s.price_1w - s.price_at_signal) / s.price_at_signal) *
                      100
                    : null;
                const calc1m =
                  s.price_1m && s.price_at_signal
                    ? ((s.price_1m - s.price_at_signal) / s.price_at_signal) *
                      100
                    : null;
                const calc3m =
                  s.price_3m && s.price_at_signal
                    ? ((s.price_3m - s.price_at_signal) / s.price_at_signal) *
                      100
                    : null;

                return (
                  <div key={s.id} className="tracker-card">
                    <div className="card-header">
                      <button
                        className="ticker-link"
                        onClick={() => onOpenResearch?.(s.ticker)}
                      >
                        <Ticker size="lg">{s.ticker}</Ticker>
                      </button>
                      <Text size="sm" color="secondary">
                        {formatDate(s.created_at)}
                      </Text>
                    </div>

                    <div className="card-signals">
                      <SignalBadge type={s.signal_type as SignalType} />
                      <Badge
                        variant={
                          s.source === 'portfolio' || !s.source
                            ? 'info'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {s.source || 'portfolio'}
                      </Badge>
                    </div>

                    <div className="card-metrics">
                      <div className="card-metric">
                        <MetricLabel>Cena</MetricLabel>
                        <Text weight="medium">
                          ${s.price_at_signal.toFixed(2)}
                        </Text>
                      </div>
                      {calc1d !== null && (
                        <div className="card-metric">
                          <MetricLabel>+1 den</MetricLabel>
                          <MetricValue
                            sentiment={
                              calc1d > 0
                                ? 'positive'
                                : calc1d < 0
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {calc1d > 0 ? '+' : ''}
                            {calc1d.toFixed(1)}%
                          </MetricValue>
                        </div>
                      )}
                      {calc1w !== null && (
                        <div className="card-metric">
                          <MetricLabel>+1 týden</MetricLabel>
                          <MetricValue
                            sentiment={
                              calc1w > 0
                                ? 'positive'
                                : calc1w < 0
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {calc1w > 0 ? '+' : ''}
                            {calc1w.toFixed(1)}%
                          </MetricValue>
                        </div>
                      )}
                      {calc1m !== null && (
                        <div className="card-metric">
                          <MetricLabel>+1 měsíc</MetricLabel>
                          <MetricValue
                            sentiment={
                              calc1m > 0
                                ? 'positive'
                                : calc1m < 0
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {calc1m > 0 ? '+' : ''}
                            {calc1m.toFixed(1)}%
                          </MetricValue>
                        </div>
                      )}
                      {calc3m !== null && (
                        <div className="card-metric">
                          <MetricLabel>+3 měsíce</MetricLabel>
                          <MetricValue
                            sentiment={
                              calc3m > 0
                                ? 'positive'
                                : calc3m < 0
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {calc3m > 0 ? '+' : ''}
                            {calc3m.toFixed(1)}%
                          </MetricValue>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const renderContent = () => {
    if (loading) {
      return <LoadingSpinner text="Načítám data..." />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={loadData} />;
    }

    switch (activeTab) {
      case 'snapshots':
        return renderSnapshotsTab();
      case 'changes':
        return renderChangesTab();
      case 'research':
        return renderResearchTab();
      case 'signals':
        return renderSignalsTab();
      default:
        return null;
    }
  };

  return (
    <div className="tracker">
      <Tabs
        options={TABS}
        value={activeTab}
        onChange={(tab) => setActiveTab(tab as TabType)}
      />

      <div className="tracker-content">{renderContent()}</div>
    </div>
  );
}
