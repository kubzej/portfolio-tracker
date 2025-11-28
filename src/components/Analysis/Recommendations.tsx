import { useState, useMemo, useEffect } from 'react';
import type { StockRecommendation, SignalType } from '@/utils/recommendations';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { ToggleGroup } from '@/components/shared/ToggleGroup';
import { Button } from '@/components/shared/Button';
import {
  logMultipleSignals,
  getRecentSignals,
  getSignalPerformance,
  type SignalLogEntry,
  type SignalPerformance,
} from '@/services/api/signals';
import './Recommendations.css';

const GROUPING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'signal', label: 'Signal' },
  { value: 'score', label: 'Score' },
  { value: 'conviction', label: 'Conviction' },
];

interface RecommendationsProps {
  recommendations: StockRecommendation[];
  portfolioId: string | null;
  loading?: boolean;
}

type FilterType =
  | 'all'
  | 'dips'
  | 'conviction'
  | 'momentum'
  | 'accumulate'
  | 'target'
  | 'watch'
  | 'trim';
type GroupBy = 'signal' | 'score' | 'conviction' | 'none';

const SIGNAL_CONFIG: Record<
  SignalType,
  { label: string; class: string; description: string }
> = {
  DIP_OPPORTUNITY: {
    label: 'DIP',
    class: 'dip',
    description:
      'Oversold with solid fundamentals - potential buying opportunity',
  },
  MOMENTUM: {
    label: 'Momentum',
    class: 'momentum',
    description: 'Technical indicators show bullish momentum',
  },
  CONVICTION_HOLD: {
    label: 'Conviction',
    class: 'conviction',
    description: 'Strong long-term fundamentals - hold through volatility',
  },
  NEAR_TARGET: {
    label: 'Near Target',
    class: 'target',
    description: 'Approaching analyst price target',
  },
  CONSIDER_TRIM: {
    label: 'Trim',
    class: 'trim',
    description: 'Overbought with high weight - consider taking profits',
  },
  WATCH_CLOSELY: {
    label: 'Watch',
    class: 'watch',
    description: 'Some metrics are deteriorating - monitor',
  },
  ACCUMULATE: {
    label: 'Accumulate',
    class: 'accumulate',
    description: 'Good quality stock - wait for better entry',
  },
  NEUTRAL: {
    label: 'Neutral',
    class: 'neutral',
    description: 'No strong signals',
  },
};

export function Recommendations({
  recommendations,
  portfolioId,
  loading,
}: RecommendationsProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selectedStock, setSelectedStock] =
    useState<StockRecommendation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [signalHistory, setSignalHistory] = useState<SignalLogEntry[]>([]);
  const [signalPerformance, setSignalPerformance] = useState<
    SignalPerformance[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [autoLogStatus, setAutoLogStatus] = useState<string | null>(null);

  // Auto-log signals when recommendations change
  useEffect(() => {
    if (recommendations.length > 0 && portfolioId && !loading) {
      autoLogSignals();
    }
  }, [recommendations, portfolioId, loading]);

  const autoLogSignals = async () => {
    if (!portfolioId || recommendations.length === 0) return;
    try {
      const signalsToLog = recommendations.filter(
        (r) => r.primarySignal.type !== 'NEUTRAL'
      );
      if (signalsToLog.length === 0) return;
      const result = await logMultipleSignals(portfolioId, signalsToLog);
      if (result.logged > 0) {
        setAutoLogStatus(`${result.logged} new signals logged`);
        setTimeout(() => setAutoLogStatus(null), 3000);
        if (showHistory) loadSignalHistory();
      }
    } catch (err) {
      console.error('Error auto-logging signals:', err);
    }
  };

  useEffect(() => {
    if (showHistory && portfolioId) {
      loadSignalHistory();
    }
  }, [showHistory, portfolioId]);

  const loadSignalHistory = async () => {
    if (!portfolioId) return;
    setHistoryLoading(true);
    try {
      const [history, performance] = await Promise.all([
        getRecentSignals(portfolioId, 50),
        getSignalPerformance(portfolioId),
      ]);
      setSignalHistory(history);
      setSignalPerformance(performance);
    } catch (err) {
      console.error('Error loading signal history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    switch (filter) {
      case 'dips':
        return recommendations.filter((r) => r.isDip || r.dipScore >= 40);
      case 'conviction':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'CONVICTION_HOLD'
        );
      case 'momentum':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'MOMENTUM'
        );
      case 'accumulate':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'ACCUMULATE'
        );
      case 'target':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'NEAR_TARGET'
        );
      case 'watch':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'WATCH_CLOSELY'
        );
      case 'trim':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'CONSIDER_TRIM'
        );
      default:
        return recommendations;
    }
  }, [recommendations, filter]);

  // Group recommendations
  const groupedRecs = useMemo(() => {
    if (groupBy === 'none') {
      return { all: filteredRecs };
    }
    const groups: Record<string, StockRecommendation[]> = {};
    filteredRecs.forEach((rec) => {
      let key: string;
      switch (groupBy) {
        case 'signal':
          key = rec.primarySignal.type;
          break;
        case 'score':
          if (rec.compositeScore >= 70) key = 'High Score (70+)';
          else if (rec.compositeScore >= 50) key = 'Medium Score (50-69)';
          else key = 'Low Score (<50)';
          break;
        case 'conviction':
          key = `${rec.convictionLevel} Conviction`;
          break;
        default:
          key = 'Other';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    });
    return groups;
  }, [filteredRecs, groupBy]);

  // Stats - count by signal type
  const stats = useMemo(() => {
    const countBySignal = (type: SignalType) =>
      recommendations.filter((r) => r.primarySignal.type === type).length;

    return {
      total: recommendations.length,
      dips: recommendations.filter(
        (r) => r.primarySignal.type === 'DIP_OPPORTUNITY'
      ).length,
      conviction: countBySignal('CONVICTION_HOLD'),
      momentum: countBySignal('MOMENTUM'),
      accumulate: countBySignal('ACCUMULATE'),
      target: countBySignal('NEAR_TARGET'),
      watch: countBySignal('WATCH_CLOSELY'),
      trim: countBySignal('CONSIDER_TRIM'),
      neutral: countBySignal('NEUTRAL'),
    };
  }, [recommendations]);

  if (loading) {
    return (
      <div className="recommendations-loading">
        <div className="loading-spinner" />
        <p>Analyzing portfolio...</p>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="recommendations-empty">
        <p>
          No recommendations available. Load analyst and technical data first.
        </p>
      </div>
    );
  }

  return (
    <div className="recommendations">
      {/* Header */}
      <div className="rec-header">
        <div className="rec-header-left">
          <h3>Smart Insights</h3>
          {autoLogStatus && (
            <span className="auto-log-badge">{autoLogStatus}</span>
          )}
        </div>
        <div className="rec-header-right">
          <Button
            variant="outline"
            size="sm"
            isActive={showHistory}
            onClick={() => setShowHistory(!showHistory)}
          >
            History
          </Button>
        </div>
      </div>

      {/* Filters - only show when not in history mode */}
      {!showHistory && (
        <div className="rec-filters">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All <span className="count">{stats.total}</span>
            </button>
            {stats.dips > 0 && (
              <button
                className={`filter-tab dip ${
                  filter === 'dips' ? 'active' : ''
                }`}
                onClick={() => setFilter('dips')}
              >
                DIP <span className="count">{stats.dips}</span>
              </button>
            )}
            {stats.conviction > 0 && (
              <button
                className={`filter-tab conviction ${
                  filter === 'conviction' ? 'active' : ''
                }`}
                onClick={() => setFilter('conviction')}
              >
                Conviction <span className="count">{stats.conviction}</span>
              </button>
            )}
            {stats.momentum > 0 && (
              <button
                className={`filter-tab momentum ${
                  filter === 'momentum' ? 'active' : ''
                }`}
                onClick={() => setFilter('momentum')}
              >
                Momentum <span className="count">{stats.momentum}</span>
              </button>
            )}
            {stats.accumulate > 0 && (
              <button
                className={`filter-tab accumulate ${
                  filter === 'accumulate' ? 'active' : ''
                }`}
                onClick={() => setFilter('accumulate')}
              >
                Accumulate <span className="count">{stats.accumulate}</span>
              </button>
            )}
            {stats.target > 0 && (
              <button
                className={`filter-tab target ${
                  filter === 'target' ? 'active' : ''
                }`}
                onClick={() => setFilter('target')}
              >
                Near Target <span className="count">{stats.target}</span>
              </button>
            )}
            {stats.watch > 0 && (
              <button
                className={`filter-tab watch ${
                  filter === 'watch' ? 'active' : ''
                }`}
                onClick={() => setFilter('watch')}
              >
                Watch <span className="count">{stats.watch}</span>
              </button>
            )}
            {stats.trim > 0 && (
              <button
                className={`filter-tab trim ${
                  filter === 'trim' ? 'active' : ''
                }`}
                onClick={() => setFilter('trim')}
              >
                Trim <span className="count">{stats.trim}</span>
              </button>
            )}
          </div>

          <div className="filter-options">
            <ToggleGroup
              options={GROUPING_OPTIONS}
              value={groupBy}
              onChange={(value) => setGroupBy(value as GroupBy)}
            />
          </div>
        </div>
      )}

      {/* History Panel - Full screen when active */}
      {showHistory ? (
        <SignalHistoryPanel
          history={signalHistory}
          performance={signalPerformance}
          loading={historyLoading}
          onClose={() => setShowHistory(false)}
        />
      ) : (
        <>
          {/* Stock Grid */}
          <div className="rec-content">
            {Object.entries(groupedRecs).map(([groupName, recs]) => (
              <div key={groupName} className="rec-group">
                {groupBy !== 'none' && (
                  <div className="group-header">
                    <span className="group-name">
                      {groupBy === 'signal'
                        ? SIGNAL_CONFIG[groupName as SignalType]?.label ||
                          groupName
                        : groupName}
                    </span>
                    <span className="group-count">{recs.length}</span>
                  </div>
                )}
                <div className="stock-grid">
                  {recs.map((rec) => (
                    <StockTile
                      key={rec.ticker}
                      rec={rec}
                      onClick={() => setSelectedStock(rec)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedStock && (
        <StockDetailModal
          rec={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// STOCK TILE
// ============================================================================

interface StockTileProps {
  rec: StockRecommendation;
  onClick: () => void;
}

function StockTile({ rec, onClick }: StockTileProps) {
  const signalInfo = SIGNAL_CONFIG[rec.primarySignal.type];

  return (
    <div className="stock-tile" onClick={onClick}>
      {/* Signal Header */}
      <div className={`tile-signal-header ${signalInfo.class}`}>
        <span className="signal-label">{signalInfo.label}</span>
        <span className="signal-strength">
          {rec.primarySignal.strength.toFixed(0)}%
        </span>
      </div>

      {/* Stock Info */}
      <div className="tile-body">
        <div className="tile-main">
          <div className="tile-stock">
            <span className="tile-ticker">{rec.ticker}</span>
            <span className="tile-name">{rec.stockName}</span>
          </div>
          <div className="tile-performance">
            <span
              className={`perf-value ${
                rec.gainPercentage >= 0 ? 'positive' : 'negative'
              }`}
            >
              {rec.gainPercentage >= 0 ? '+' : ''}
              {rec.gainPercentage.toFixed(1)}%
            </span>
            <span className="perf-label">P/L</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="tile-metrics">
          <div className="metric">
            <span className="metric-value">{rec.weight.toFixed(1)}%</span>
            <span className="metric-label">Weight</span>
          </div>
          <div className="metric">
            <span
              className={`metric-value ${getScoreClass(rec.compositeScore)}`}
            >
              {rec.compositeScore}
            </span>
            <span className="metric-label">Score</span>
          </div>
          <div className="metric">
            <span
              className={`metric-value conviction-${rec.convictionLevel.toLowerCase()}`}
            >
              {rec.convictionLevel}
            </span>
            <span className="metric-label">Conviction</span>
          </div>
        </div>

        {/* Target Price Row */}
        {rec.targetPrice !== null && rec.targetUpside !== null && (
          <div className="tile-metrics target-row">
            <div className="metric">
              <span className="metric-value">
                ${rec.targetPrice.toFixed(0)}
              </span>
              <span className="metric-label">Target</span>
            </div>
            <div className="metric">
              <span
                className={`metric-value ${
                  rec.targetUpside >= 0 ? 'positive' : 'negative'
                }`}
              >
                {rec.targetUpside >= 0 ? '+' : ''}
                {rec.targetUpside.toFixed(0)}%
              </span>
              <span className="metric-label">Upside</span>
            </div>
          </div>
        )}

        {/* Quick Insight */}
        {rec.actionItems.length > 0 && (
          <div className="tile-insight">
            <span>{rec.actionItems[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STOCK DETAIL MODAL
// ============================================================================

interface StockDetailModalProps {
  rec: StockRecommendation;
  onClose: () => void;
}

function StockDetailModal({ rec, onClose }: StockDetailModalProps) {
  const signalInfo = SIGNAL_CONFIG[rec.primarySignal.type];

  return (
    <div className="rec-modal">
      <div className="rec-modal-overlay" onClick={onClose} />
      <div className="rec-modal-content">
        {/* Signal Banner */}
        <div className={`modal-banner ${signalInfo.class}`}>
          <div className="banner-signal">
            <span className="banner-label">{signalInfo.label}</span>
            <span className="banner-strength">
              {rec.primarySignal.strength.toFixed(0)}%
            </span>
          </div>
          <button className="close-btn-light" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>{rec.ticker}</h3>
            <span className="modal-subtitle">{rec.stockName}</span>
          </div>
          <div
            className={`conviction-badge ${rec.convictionLevel.toLowerCase()}`}
          >
            {rec.convictionLevel}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="modal-stats">
          <div className="stat-box">
            <span className="stat-label">Score</span>
            <span
              className={`stat-value score-${getScoreClass(
                rec.compositeScore
              )}`}
            >
              {rec.compositeScore}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Technical</span>
            <span className={`stat-value ${rec.technicalBias.toLowerCase()}`}>
              {rec.technicalBias}
            </span>
          </div>
        </div>

        {/* Signal Description */}
        <div className="modal-section signal-section">
          <p className="signal-description">{signalInfo.description}</p>
        </div>

        {/* Key Metrics - unified grid */}
        <div className="modal-section">
          <div className="section-header">
            <h4>Key Metrics</h4>
          </div>
          <div className="metrics-grid">
            <div className="metric-cell">
              <span className="metric-label">Weight</span>
              <span className="metric-value">{rec.weight.toFixed(1)}%</span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Current</span>
              <span className="metric-value">
                ${rec.currentPrice.toFixed(2)}
              </span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">Avg Buy</span>
              <span className="metric-value">
                ${rec.avgBuyPrice.toFixed(2)}
              </span>
            </div>
            <div className="metric-cell">
              <span className="metric-label">P/L</span>
              <span
                className={`metric-value ${
                  rec.distanceFromAvg >= 0 ? 'positive' : 'negative'
                }`}
              >
                {rec.distanceFromAvg >= 0 ? '+' : ''}
                {rec.distanceFromAvg.toFixed(1)}%
              </span>
            </div>
            {rec.targetPrice !== null && rec.targetUpside !== null && (
              <div className="metric-cell">
                <span className="metric-label">Target</span>
                <span className="metric-value">
                  ${rec.targetPrice.toFixed(0)}
                  <span
                    className={`metric-sub ${
                      rec.targetUpside >= 0 ? 'positive' : 'negative'
                    }`}
                  >
                    ({rec.targetUpside >= 0 ? '+' : ''}
                    {rec.targetUpside.toFixed(0)}%)
                  </span>
                </span>
              </div>
            )}
            {rec.buyStrategy.buyZoneLow !== null &&
              rec.buyStrategy.buyZoneHigh !== null && (
                <div className="metric-cell">
                  <span className="metric-label">Entry Zone</span>
                  <span className="metric-value">
                    ${rec.buyStrategy.buyZoneLow.toFixed(0)} – $
                    {rec.buyStrategy.buyZoneHigh.toFixed(0)}
                  </span>
                </div>
              )}
            {rec.buyStrategy.supportPrice !== null && (
              <div className="metric-cell">
                <span className="metric-label">Support</span>
                <span className="metric-value">
                  ${rec.buyStrategy.supportPrice.toFixed(0)}
                  <span className="metric-sub negative">
                    (
                    {(
                      ((rec.currentPrice - rec.buyStrategy.supportPrice) /
                        rec.currentPrice) *
                      -100
                    ).toFixed(0)}
                    %)
                  </span>
                </span>
              </div>
            )}
            {rec.buyStrategy.riskRewardRatio !== null && (
              <div className="metric-cell">
                <span className="metric-label">Risk/Reward</span>
                <span
                  className={`metric-value ${
                    rec.buyStrategy.riskRewardRatio >= 2
                      ? 'positive'
                      : rec.buyStrategy.riskRewardRatio >= 1
                      ? 'neutral'
                      : 'negative'
                  }`}
                >
                  {rec.buyStrategy.riskRewardRatio}:1
                </span>
              </div>
            )}
            <div className="metric-cell">
              <span className="metric-label">DCA</span>
              <span
                className={`dca-badge ${rec.buyStrategy.dcaRecommendation
                  .toLowerCase()
                  .replace('_', '-')}`}
              >
                {rec.buyStrategy.dcaRecommendation === 'NO_DCA'
                  ? 'Hold'
                  : rec.buyStrategy.dcaRecommendation}
              </span>
            </div>
          </div>
          <p className="metrics-note">{rec.buyStrategy.dcaReason}</p>

          {/* 52-Week Range */}
          {rec.fiftyTwoWeekHigh !== null && rec.fiftyTwoWeekLow !== null && (
            <div className="week-range">
              <div className="range-header">
                <span className="range-label">52-Week Range</span>
                {rec.distanceFrom52wHigh !== null && (
                  <span className="range-distance">
                    {rec.distanceFrom52wHigh.toFixed(0)}% below high
                  </span>
                )}
              </div>
              <div className="range-visual">
                <span className="range-low">
                  ${rec.fiftyTwoWeekLow.toFixed(0)}
                </span>
                <div className="range-bar">
                  <div
                    className="range-marker"
                    style={{
                      left: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((rec.currentPrice - rec.fiftyTwoWeekLow) /
                            (rec.fiftyTwoWeekHigh - rec.fiftyTwoWeekLow)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <span className="range-high">
                  ${rec.fiftyTwoWeekHigh.toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="modal-section">
          <div className="section-header">
            <h4>Score Breakdown</h4>
            <InfoTooltip text="Weighted combination of fundamental, technical, analyst, news, insider, and portfolio metrics" />
          </div>
          <div className="breakdown-list">
            {rec.breakdown.map((b) => (
              <div key={b.category} className="breakdown-item">
                <div className="breakdown-header">
                  <span className="breakdown-name">{b.category}</span>
                  <span className={`breakdown-score ${b.sentiment}`}>
                    {b.percent.toFixed(0)}%
                  </span>
                </div>
                <div className="breakdown-bar">
                  <div
                    className={`breakdown-fill ${b.sentiment}`}
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
                {b.details.length > 0 && (
                  <ul className="breakdown-details">
                    {b.details.slice(0, 3).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Concerns */}
        {(rec.strengths.length > 0 || rec.concerns.length > 0) && (
          <div className="modal-section">
            <div className="section-header">
              <h4>Analysis</h4>
            </div>
            <div className="two-col">
              {rec.strengths.length > 0 && (
                <div className="points-card strengths">
                  <div className="points-header">
                    <span className="points-icon">✓</span>
                    <h4>Strengths</h4>
                  </div>
                  <ul>
                    {rec.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {rec.concerns.length > 0 && (
                <div className="points-card concerns">
                  <div className="points-header">
                    <span className="points-icon">!</span>
                    <h4>Concerns</h4>
                  </div>
                  <ul>
                    {rec.concerns.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Items */}
        {rec.actionItems.length > 0 && (
          <div className="modal-section">
            <div className="section-header">
              <h4>Action Items</h4>
            </div>
            <ul className="action-list">
              {rec.actionItems.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Other Signals */}
        {rec.signals.length > 1 && (
          <div className="modal-section">
            <div className="section-header">
              <h4>Other Signals</h4>
            </div>
            <div className="other-signals">
              {rec.signals.slice(1).map((sig, i) => (
                <span
                  key={i}
                  className={`signal-tag ${SIGNAL_CONFIG[sig.type].class}`}
                >
                  {SIGNAL_CONFIG[sig.type].label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SIGNAL HISTORY PANEL
// ============================================================================

interface HistoryPanelProps {
  history: SignalLogEntry[];
  performance: SignalPerformance[];
  loading: boolean;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 25;

function SignalHistoryPanel({
  history,
  performance: _performance,
  loading,
  onClose,
}: HistoryPanelProps) {
  const [tickerFilter, setTickerFilter] = useState<string>('');
  const [signalFilter, setSignalFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Get unique tickers for filter dropdown
  const uniqueTickers = useMemo(() => {
    const tickers = [...new Set(history.map((h) => h.ticker))].sort();
    return tickers;
  }, [history]);

  // Filter history
  const filteredHistory = useMemo(() => {
    return history.filter((sig) => {
      const matchesTicker = !tickerFilter || sig.ticker === tickerFilter;
      const matchesSignal =
        signalFilter === 'all' || sig.signal_type === signalFilter;
      return matchesTicker && matchesSignal;
    });
  }, [history, tickerFilter, signalFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tickerFilter, signalFilter]);

  // Stats
  const stats = useMemo(() => {
    const signalsWithReturns = filteredHistory.filter(
      (s) => s.price_1w !== null
    );
    const avgReturn1w =
      signalsWithReturns.length > 0
        ? signalsWithReturns.reduce(
            (sum, s) =>
              sum +
              ((s.price_1w! - s.price_at_signal) / s.price_at_signal) * 100,
            0
          ) / signalsWithReturns.length
        : 0;
    const winRate =
      signalsWithReturns.length > 0
        ? (signalsWithReturns.filter((s) => s.price_1w! > s.price_at_signal)
            .length /
            signalsWithReturns.length) *
          100
        : 0;
    return { total: filteredHistory.length, avgReturn1w, winRate };
  }, [filteredHistory]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  };

  const formatReturn = (priceAt: number, priceNow: number | null): string => {
    if (priceNow === null) return '—';
    const ret = ((priceNow - priceAt) / priceAt) * 100;
    return `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%`;
  };

  const getReturnClass = (priceAt: number, priceNow: number | null): string => {
    if (priceNow === null) return '';
    return priceNow > priceAt ? 'positive' : 'negative';
  };

  if (loading) {
    return (
      <div className="history-fullscreen">
        <div className="loading-spinner" />
        <p>Loading history...</p>
      </div>
    );
  }

  return (
    <div className="history-fullscreen">
      {/* Header */}
      <div className="history-header">
        <div className="history-title">
          <h3>Signal History</h3>
          <span className="history-count">{stats.total} signals</span>
        </div>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Stats Bar */}
      <div className="history-stats">
        <div className="history-stat">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Signals</span>
        </div>
        <div className="history-stat">
          <span
            className={`stat-value ${
              stats.avgReturn1w >= 0 ? 'positive' : 'negative'
            }`}
          >
            {stats.avgReturn1w >= 0 ? '+' : ''}
            {stats.avgReturn1w.toFixed(1)}%
          </span>
          <span className="stat-label">Avg 1W Return</span>
        </div>
        <div className="history-stat">
          <span
            className={`stat-value ${
              stats.winRate >= 50 ? 'positive' : 'negative'
            }`}
          >
            {stats.winRate.toFixed(0)}%
          </span>
          <span className="stat-label">Win Rate (1W)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <select
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
          className="history-select"
        >
          <option value="">All Tickers</option>
          {uniqueTickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={signalFilter}
          onChange={(e) => setSignalFilter(e.target.value)}
          className="history-select"
        >
          <option value="all">All Signals</option>
          {Object.entries(SIGNAL_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filteredHistory.length === 0 ? (
        <p className="no-data">No signals match your filters.</p>
      ) : (
        <>
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ticker</th>
                  <th>Signal</th>
                  <th>Price</th>
                  <th>1D</th>
                  <th>1W</th>
                  <th>1M</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((sig) => (
                  <tr key={sig.id}>
                    <td>{formatDate(sig.created_at)}</td>
                    <td className="ticker">{sig.ticker}</td>
                    <td>
                      <span
                        className={`signal-tag mini ${
                          SIGNAL_CONFIG[sig.signal_type]?.class || 'neutral'
                        }`}
                      >
                        {SIGNAL_CONFIG[sig.signal_type]?.label ||
                          sig.signal_type}
                      </span>
                    </td>
                    <td>${sig.price_at_signal.toFixed(2)}</td>
                    <td
                      className={getReturnClass(
                        sig.price_at_signal,
                        sig.price_1d
                      )}
                    >
                      {formatReturn(sig.price_at_signal, sig.price_1d)}
                    </td>
                    <td
                      className={getReturnClass(
                        sig.price_at_signal,
                        sig.price_1w
                      )}
                    >
                      {formatReturn(sig.price_at_signal, sig.price_1w)}
                    </td>
                    <td
                      className={getReturnClass(
                        sig.price_at_signal,
                        sig.price_1m
                      )}
                    >
                      {formatReturn(sig.price_at_signal, sig.price_1m)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="history-pagination">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="page-btn"
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="page-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getScoreClass(score: number): string {
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}
