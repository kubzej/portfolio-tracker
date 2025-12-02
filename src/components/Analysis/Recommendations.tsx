import { useState, useMemo, useEffect } from 'react';
import type { StockRecommendation, SignalType } from '@/utils/recommendations';
import { SIGNAL_CONFIG } from '@/utils/signals';
import { formatDateShort, formatReturn, getReturnClass } from '@/utils/format';
import { Tabs } from '@/components/shared/Tabs';
import { Button } from '@/components/shared/Button';
import {
  ToggleGroup,
  type ToggleOption,
} from '@/components/shared/ToggleGroup';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import {
  LoadingSpinner,
  EmptyState,
  SignalBadge,
  MetricCard,
} from '@/components/shared';
import {
  SectionTitle,
  CardTitle,
  Text,
  Badge,
  Count,
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Caption,
  Muted,
} from '@/components/shared/Typography';
import {
  logMultipleSignals,
  getRecentSignals,
  getSignalPerformance,
  type SignalLogEntry,
  type SignalPerformance,
} from '@/services/api/signals';
import { ExplainPanel } from './ExplainPanel';
import './Recommendations.css';

const GROUPING_OPTIONS = [
  { value: 'none', label: 'Žádné' },
  { value: 'signal', label: 'Signál' },
  { value: 'score', label: 'Skóre' },
  { value: 'conviction', label: 'Přesvědčení' },
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
  | 'quality'
  | 'momentum'
  | 'accumulate'
  | 'hold'
  | 'target'
  | 'watch'
  | 'trim';
type GroupBy = 'signal' | 'score' | 'conviction' | 'none';

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
          (r) => r.primarySignal.type === 'CONVICTION'
        );
      case 'quality':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'QUALITY_CORE'
        );
      case 'momentum':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'MOMENTUM'
        );
      case 'accumulate':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'ACCUMULATE'
        );
      case 'hold':
        return recommendations.filter((r) => r.primarySignal.type === 'STEADY');
      case 'target':
        return recommendations.filter(
          (r) => r.primarySignal.type === 'NEAR_TARGET'
        );
      case 'watch':
        return recommendations.filter((r) => r.primarySignal.type === 'WATCH');
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
      conviction: countBySignal('CONVICTION'),
      quality: countBySignal('QUALITY_CORE'),
      momentum: countBySignal('MOMENTUM'),
      accumulate: countBySignal('ACCUMULATE'),
      hold: countBySignal('STEADY'),
      target: countBySignal('NEAR_TARGET'),
      watch: countBySignal('WATCH'),
      trim: countBySignal('CONSIDER_TRIM'),
      neutral: countBySignal('NEUTRAL'),
    };
  }, [recommendations]);

  // Filter options for ToggleGroup
  const filterOptions: ToggleOption[] = useMemo(
    () => [
      { value: 'all', label: 'Vše', count: stats.total, color: 'default' },
      { value: 'dips', label: 'DIP', count: stats.dips, color: 'success' },
      {
        value: 'conviction',
        label: 'Conviction',
        count: stats.conviction,
        color: 'purple',
      },
      {
        value: 'quality',
        label: 'Kvalita',
        count: stats.quality,
        color: 'purple',
      },
      {
        value: 'momentum',
        label: 'Momentum',
        count: stats.momentum,
        color: 'info',
      },
      {
        value: 'accumulate',
        label: 'Akumulovat',
        count: stats.accumulate,
        color: 'cyan',
      },
      {
        value: 'hold',
        label: 'Držet',
        count: stats.hold,
        color: 'default',
      },
      {
        value: 'target',
        label: 'U cíle',
        count: stats.target,
        color: 'warning',
      },
      {
        value: 'watch',
        label: 'Sledovat',
        count: stats.watch,
        color: 'orange',
      },
      { value: 'trim', label: 'Redukovat', count: stats.trim, color: 'danger' },
    ],
    [stats]
  );

  if (loading) {
    return <LoadingSpinner text="Analyzuji portfolio..." />;
  }

  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="Žádná doporučení"
        description="Nejprve načtěte data analytiků a technická data."
      />
    );
  }

  return (
    <div className="recommendations">
      {/* Header */}
      <div className="rec-header">
        <div className="rec-header-left">
          <SectionTitle>Chytré analýzy</SectionTitle>
          {autoLogStatus && <Badge variant="buy">{autoLogStatus}</Badge>}
        </div>
        <div className="rec-header-right">
          <Button
            variant="outline"
            size="sm"
            isActive={showHistory}
            onClick={() => setShowHistory(!showHistory)}
          >
            Historie signálů
          </Button>
        </div>
      </div>

      {/* Filters - only show when not in history mode */}
      {!showHistory && (
        <div className="rec-filters">
          <ToggleGroup
            value={filter}
            onChange={(value) => setFilter(value as FilterType)}
            options={filterOptions}
            variant="signal"
            hideEmpty
          />

          <div className="filter-options">
            <Tabs
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
                    <Text weight="semibold">
                      {groupBy === 'signal'
                        ? SIGNAL_CONFIG[groupName as SignalType]?.label ||
                          groupName
                        : groupName}
                    </Text>
                    <Count>{recs.length}</Count>
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
  const actionSignal = rec.actionSignal;
  const qualitySignal = rec.qualitySignal;

  // Determine primary and secondary signals for display
  // Priority: action signal first (if exists), otherwise quality signal
  const primarySignal = actionSignal ?? qualitySignal;
  const secondarySignal = actionSignal ? qualitySignal : null;

  // Get signal configs
  const primaryConfig = primarySignal
    ? SIGNAL_CONFIG[primarySignal.type]
    : SIGNAL_CONFIG.NEUTRAL;
  const secondaryConfig = secondarySignal
    ? SIGNAL_CONFIG[secondarySignal.type]
    : null;

  return (
    <div className="stock-tile" onClick={onClick}>
      {/* Signal Header - primary signal full width with optional badge */}
      <div className={`tile-signal-header ${primaryConfig.class}`}>
        <div className="signal-primary">
          <Text size="sm" weight="semibold">
            {primaryConfig.label}
          </Text>
          {primarySignal && (
            <Text size="xs" weight="medium" color="secondary">
              {primarySignal.strength.toFixed(0)}%
            </Text>
          )}
        </div>
        {secondaryConfig && (
          <div className={`signal-badge ${secondaryConfig.class}`}>
            <Text size="xs" weight="semibold">
              {secondaryConfig.label}
            </Text>
          </div>
        )}
      </div>

      {/* Tile Body */}
      <div className="tile-body">
        <div className="tile-main">
          <div className="tile-stock">
            <Ticker size="lg">{rec.ticker}</Ticker>
            <StockName truncate>{rec.stockName}</StockName>
          </div>
          <div className="tile-performance">
            <MetricValue
              sentiment={rec.gainPercentage >= 0 ? 'positive' : 'negative'}
            >
              {rec.gainPercentage >= 0 ? '+' : ''}
              {rec.gainPercentage.toFixed(1)}%
            </MetricValue>
            <MetricLabel>P/L</MetricLabel>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="tile-metrics">
          <div className="metric">
            <MetricValue>{rec.weight.toFixed(1)}%</MetricValue>
            <MetricLabel>Váha</MetricLabel>
          </div>
          <div className="metric">
            <MetricValue
              sentiment={
                rec.compositeScore >= 70
                  ? 'positive'
                  : rec.compositeScore >= 50
                  ? 'neutral'
                  : 'negative'
              }
            >
              {rec.compositeScore}
            </MetricValue>
            <MetricLabel>Skóre</MetricLabel>
          </div>
          <div className="metric">
            <Badge
              variant={
                rec.convictionLevel === 'HIGH'
                  ? 'buy'
                  : rec.convictionLevel === 'MEDIUM'
                  ? 'hold'
                  : 'sell'
              }
            >
              {rec.convictionLevel === 'HIGH'
                ? 'Vysoká'
                : rec.convictionLevel === 'MEDIUM'
                ? 'Střední'
                : 'Nízká'}
            </Badge>
            <MetricLabel>Přesvědčení</MetricLabel>
          </div>
        </div>

        {/* Target Price Row */}
        {rec.targetPrice !== null && rec.targetUpside !== null && (
          <div className="tile-metrics tile-metrics--2col">
            <div className="metric">
              <MetricValue>${rec.targetPrice.toFixed(0)}</MetricValue>
              <MetricLabel>Cíl</MetricLabel>
            </div>
            <div className="metric">
              <MetricValue
                sentiment={rec.targetUpside >= 0 ? 'positive' : 'negative'}
              >
                {rec.targetUpside >= 0 ? '+' : ''}
                {rec.targetUpside.toFixed(0)}%
              </MetricValue>
              <MetricLabel>Potenciál</MetricLabel>
            </div>
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

  // Get category signals
  const actionSignal = rec.actionSignal;
  const qualitySignal = rec.qualitySignal;

  const actionConfig = actionSignal ? SIGNAL_CONFIG[actionSignal.type] : null;
  const qualityConfig = qualitySignal
    ? SIGNAL_CONFIG[qualitySignal.type]
    : null;

  return (
    <div className="rec-modal">
      <div className="rec-modal-overlay" onClick={onClose} />
      <div className="rec-modal-content">
        {/* Signal Banner */}
        <div className={`modal-banner ${signalInfo.class}`}>
          <div className="banner-signal">
            {/* Action signal */}
            {actionConfig ? (
              <div className="banner-signal-item">
                <Text size="lg" weight="bold">
                  {actionConfig.label}
                </Text>
                <Text size="sm" weight="medium">
                  {actionSignal!.strength.toFixed(0)}%
                </Text>
              </div>
            ) : null}
            {/* Separator if both exist */}
            {actionConfig && qualityConfig && (
              <div className="banner-separator" />
            )}
            {/* Quality signal */}
            {qualityConfig ? (
              <div className="banner-signal-item">
                <Text size="lg" weight="bold">
                  {qualityConfig.label}
                </Text>
              </div>
            ) : null}
          </div>
          <Button variant="ghost" size="lg" icon onClick={onClose}>
            X
          </Button>
        </div>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Ticker size="xl">{rec.ticker}</Ticker>
            <StockName size="lg">{rec.stockName}</StockName>
          </div>
          <Badge
            variant={
              rec.convictionLevel === 'HIGH'
                ? 'buy'
                : rec.convictionLevel === 'MEDIUM'
                ? 'hold'
                : 'sell'
            }
          >
            {rec.convictionLevel === 'HIGH'
              ? 'Vysoká'
              : rec.convictionLevel === 'MEDIUM'
              ? 'Střední'
              : 'Nízká'}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="modal-stats">
          <div className="stat-box">
            <MetricLabel>Skóre</MetricLabel>
            <MetricValue
              sentiment={
                rec.compositeScore >= 70
                  ? 'positive'
                  : rec.compositeScore >= 50
                  ? 'neutral'
                  : 'negative'
              }
            >
              {rec.compositeScore}
            </MetricValue>
          </div>
          <div className="stat-box">
            <MetricLabel>Technika</MetricLabel>
            <Badge
              variant={
                rec.technicalBias === 'BULLISH'
                  ? 'buy'
                  : rec.technicalBias === 'BEARISH'
                  ? 'sell'
                  : 'hold'
              }
            >
              {rec.technicalBias === 'BULLISH'
                ? 'Býčí'
                : rec.technicalBias === 'BEARISH'
                ? 'Medvědí'
                : 'Neutrální'}
            </Badge>
          </div>
        </div>

        {/* Signal Description */}
        <div className="modal-section signal-section">
          <Text color="muted">{signalInfo.description}</Text>
        </div>

        {/* Key Metrics - unified grid */}
        <div className="modal-section">
          <div className="section-header">
            <CardTitle>Klíčové metriky</CardTitle>
          </div>
          <div className="metrics-grid">
            <div className="metric-cell">
              <MetricLabel>Váha</MetricLabel>
              <MetricValue>{rec.weight.toFixed(1)}%</MetricValue>
            </div>
            <div className="metric-cell">
              <MetricLabel>Cena</MetricLabel>
              <MetricValue>${rec.currentPrice.toFixed(2)}</MetricValue>
            </div>
            <div className="metric-cell">
              <MetricLabel>Prům. nákup</MetricLabel>
              <MetricValue>${rec.avgBuyPrice.toFixed(2)}</MetricValue>
            </div>
            <div className="metric-cell">
              <MetricLabel>P/L</MetricLabel>
              <MetricValue
                sentiment={rec.distanceFromAvg >= 0 ? 'positive' : 'negative'}
              >
                {rec.distanceFromAvg >= 0 ? '+' : ''}
                {rec.distanceFromAvg.toFixed(1)}%
              </MetricValue>
            </div>
            {rec.targetPrice !== null && rec.targetUpside !== null && (
              <div className="metric-cell">
                <MetricLabel>Cíl</MetricLabel>
                <MetricValue>
                  ${rec.targetPrice.toFixed(0)}
                  <Text
                    size="xs"
                    color={rec.targetUpside >= 0 ? 'success' : 'danger'}
                  >
                    {' '}
                    ({rec.targetUpside >= 0 ? '+' : ''}
                    {rec.targetUpside.toFixed(0)}%)
                  </Text>
                </MetricValue>
              </div>
            )}
            {rec.buyStrategy.buyZoneLow !== null &&
              rec.buyStrategy.buyZoneHigh !== null && (
                <div className="metric-cell">
                  <MetricLabel>Vstupní zóna</MetricLabel>
                  <MetricValue>
                    ${rec.buyStrategy.buyZoneLow.toFixed(0)} – $
                    {rec.buyStrategy.buyZoneHigh.toFixed(0)}
                  </MetricValue>
                </div>
              )}
            {rec.buyStrategy.supportPrice !== null && (
              <div className="metric-cell">
                <MetricLabel>Podpora</MetricLabel>
                <MetricValue>
                  ${rec.buyStrategy.supportPrice.toFixed(0)}
                  <Text size="xs" color="danger">
                    {' '}
                    (
                    {(
                      ((rec.currentPrice - rec.buyStrategy.supportPrice) /
                        rec.currentPrice) *
                      -100
                    ).toFixed(0)}
                    %)
                  </Text>
                </MetricValue>
              </div>
            )}
            {rec.buyStrategy.riskRewardRatio !== null && (
              <div className="metric-cell">
                <MetricLabel>Riziko/Výnos</MetricLabel>
                <MetricValue
                  sentiment={
                    rec.buyStrategy.riskRewardRatio >= 2
                      ? 'positive'
                      : rec.buyStrategy.riskRewardRatio >= 1
                      ? 'neutral'
                      : 'negative'
                  }
                >
                  {rec.buyStrategy.riskRewardRatio}:1
                </MetricValue>
              </div>
            )}
            <div className="metric-cell metric-cell--full">
              <MetricLabel>DCA</MetricLabel>
              <div className="dca-content">
                <Badge
                  variant={
                    rec.buyStrategy.dcaRecommendation === 'AGGRESSIVE'
                      ? 'buy'
                      : rec.buyStrategy.dcaRecommendation === 'NORMAL'
                      ? 'hold'
                      : 'info'
                  }
                >
                  {rec.buyStrategy.dcaRecommendation === 'NO_DCA'
                    ? 'Nepokračovat'
                    : rec.buyStrategy.dcaRecommendation === 'AGGRESSIVE'
                    ? 'Agresivní'
                    : rec.buyStrategy.dcaRecommendation === 'NORMAL'
                    ? 'Normální'
                    : 'Opatrný'}
                </Badge>
                {rec.buyStrategy.dcaReason && (
                  <Badge variant="info">{rec.buyStrategy.dcaReason}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Exit Strategy */}
          {rec.exitStrategy && (
            <div className="exit-strategy-section">
              <div className="section-header">
                <CardTitle>Strategie výstupu</CardTitle>
              </div>
              <div className="exit-header">
                <Badge
                  variant={
                    rec.exitStrategy.holdingPeriod === 'SWING'
                      ? 'warning'
                      : rec.exitStrategy.holdingPeriod === 'MEDIUM'
                      ? 'hold'
                      : 'buy'
                  }
                >
                  {rec.exitStrategy.holdingPeriod === 'SWING'
                    ? 'Krátkodobě'
                    : rec.exitStrategy.holdingPeriod === 'MEDIUM'
                    ? 'Střednědobě'
                    : 'Dlouhodobě'}
                </Badge>
                <Text size="sm" color="muted">
                  {rec.exitStrategy.holdingReason}
                </Text>
              </div>
              <div className="metrics-grid">
                {rec.exitStrategy.takeProfit1 !== null && (
                  <div className="metric-cell">
                    <MetricLabel>TP1</MetricLabel>
                    <MetricValue sentiment="positive">
                      ${rec.exitStrategy.takeProfit1.toFixed(0)}
                      <Text size="xs" color="success">
                        {' '}
                        (+
                        {(
                          ((rec.exitStrategy.takeProfit1 - rec.currentPrice) /
                            rec.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </Text>
                    </MetricValue>
                  </div>
                )}
                {rec.exitStrategy.takeProfit2 !== null && (
                  <div className="metric-cell">
                    <MetricLabel>TP2</MetricLabel>
                    <MetricValue sentiment="positive">
                      ${rec.exitStrategy.takeProfit2.toFixed(0)}
                      <Text size="xs" color="success">
                        {' '}
                        (+
                        {(
                          ((rec.exitStrategy.takeProfit2 - rec.currentPrice) /
                            rec.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </Text>
                    </MetricValue>
                  </div>
                )}
                {rec.exitStrategy.takeProfit3 !== null && (
                  <div className="metric-cell">
                    <MetricLabel>Cíl</MetricLabel>
                    <MetricValue sentiment="positive">
                      ${rec.exitStrategy.takeProfit3.toFixed(0)}
                      <Text size="xs" color="success">
                        {' '}
                        (+
                        {(
                          ((rec.exitStrategy.takeProfit3 - rec.currentPrice) /
                            rec.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </Text>
                    </MetricValue>
                  </div>
                )}
                {rec.exitStrategy.stopLoss !== null && (
                  <div className="metric-cell">
                    <MetricLabel>Stop Loss</MetricLabel>
                    <MetricValue sentiment="negative">
                      ${rec.exitStrategy.stopLoss.toFixed(0)}
                      <Text size="xs" color="danger">
                        {' '}
                        (
                        {(
                          ((rec.exitStrategy.stopLoss - rec.currentPrice) /
                            rec.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </Text>
                    </MetricValue>
                  </div>
                )}
              </div>
              {rec.exitStrategy.trailingStopPercent && (
                <Caption>
                  Zvažte {rec.exitStrategy.trailingStopPercent}% trailing stop
                  po TP1
                </Caption>
              )}
            </div>
          )}

          {/* 52-Week Range */}
          {rec.fiftyTwoWeekHigh !== null && rec.fiftyTwoWeekLow !== null && (
            <div className="week-range">
              <div className="range-header">
                <MetricLabel>52týdní rozsah</MetricLabel>
                {rec.distanceFrom52wHigh !== null && (
                  <Text size="xs" color="muted">
                    {rec.distanceFrom52wHigh.toFixed(0)}% pod maximem
                  </Text>
                )}
              </div>
              <div className="range-visual">
                <Text size="sm" weight="semibold" color="muted">
                  ${rec.fiftyTwoWeekLow.toFixed(0)}
                </Text>
                <div className="week-range-bar">
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
                <Text size="sm" weight="semibold" color="muted">
                  ${rec.fiftyTwoWeekHigh.toFixed(0)}
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* Score Breakdown */}
        <div className="modal-section">
          <div className="section-header">
            <CardTitle>Rozpad skóre</CardTitle>
          </div>
          <div className="breakdown-list">
            {rec.breakdown.map((b) => (
              <div key={b.category} className="breakdown-item">
                <div className="breakdown-header">
                  <Text weight="semibold">{b.category}</Text>
                  <Text
                    weight="bold"
                    color={
                      b.sentiment === 'bullish'
                        ? 'success'
                        : b.sentiment === 'bearish'
                        ? 'danger'
                        : 'secondary'
                    }
                  >
                    {b.percent.toFixed(0)}%
                  </Text>
                </div>
                <div className="breakdown-bar">
                  <div
                    className={`breakdown-fill ${b.sentiment}`}
                    style={{ width: `${b.percent}%` }}
                  />
                </div>
                {b.details.length > 0 && (
                  <div className="breakdown-details">
                    {b.details.slice(0, 3).map((d, i) => (
                      <Text key={i} size="sm" color="muted">
                        {d}
                      </Text>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Concerns */}
        {(rec.strengths.length > 0 || rec.concerns.length > 0) && (
          <div className="modal-section">
            <div className="section-header">
              <CardTitle>Analýza</CardTitle>
            </div>
            <div className="two-col">
              {rec.strengths.length > 0 && (
                <div className="points-card strengths">
                  <div className="points-header">
                    <Text color="success" weight="bold">
                      ✓
                    </Text>
                    <CardTitle>Silné stránky</CardTitle>
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
                    <Text color="danger" weight="bold">
                      !
                    </Text>
                    <CardTitle>Obavy</CardTitle>
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
              <CardTitle>Doporučené akce</CardTitle>
            </div>
            <div className="action-list">
              {rec.actionItems.map((a, i) => (
                <div key={i} className="action-item">
                  <span className="action-bullet">→</span>
                  <Text>{a}</Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Other Signals - only show if there are more than the displayed ones */}
        {rec.signals.length > 2 && (
          <div className="modal-section">
            <div className="section-header">
              <CardTitle>Další signály</CardTitle>
            </div>
            <div className="other-signals">
              {rec.signals
                .filter(
                  (sig) =>
                    sig.type !== actionSignal?.type &&
                    sig.type !== qualitySignal?.type
                )
                .map((sig, i) => (
                  <SignalBadge key={i} type={sig.type} />
                ))}
            </div>
          </div>
        )}

        {/* Explain Mode */}
        {rec.explanation && (
          <ExplainPanel
            explanation={rec.explanation}
            actionSignal={actionSignal?.type ?? null}
            qualitySignal={qualitySignal?.type ?? 'NEUTRAL'}
          />
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

  // Ticker options for filter dropdown
  const tickerOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: 'Všechny tickery' },
      ...uniqueTickers.map((t) => ({ value: t, label: t })),
    ];
  }, [uniqueTickers]);

  // Signal options for filter dropdown
  const signalOptions: SelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: 'Všechny signály' },
      ...Object.entries(SIGNAL_CONFIG).map(([key, val]) => ({
        value: key,
        label: val.label,
      })),
    ];
  }, []);

  if (loading) {
    return (
      <div className="history-fullscreen">
        <LoadingSpinner text="Načítám historii..." />
      </div>
    );
  }

  return (
    <div className="history-fullscreen">
      {/* Header */}
      <div className="history-header">
        <div className="history-title">
          <SectionTitle>Historie signálů</SectionTitle>
          <Muted>{stats.total} signálů</Muted>
        </div>
        <Button variant="ghost" size="sm" icon onClick={onClose}>
          ×
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="history-stats">
        <MetricCard label="Celkem signálů" value={stats.total} size="sm" />
        <MetricCard
          label="Prům. výnos 1T"
          value={`${
            stats.avgReturn1w >= 0 ? '+' : ''
          }${stats.avgReturn1w.toFixed(1)}`}
          suffix="%"
          sentiment={stats.avgReturn1w >= 0 ? 'positive' : 'negative'}
          size="sm"
        />
        <MetricCard
          label="Úspěšnost (1T)"
          value={stats.winRate.toFixed(0)}
          suffix="%"
          sentiment={stats.winRate >= 50 ? 'positive' : 'negative'}
          size="sm"
        />
      </div>

      {/* Filters */}
      <div className="history-filters">
        <BottomSheetSelect
          value={tickerFilter}
          onChange={setTickerFilter}
          options={tickerOptions}
          placeholder="Všechny tickery"
          title="Filtr podle tickeru"
        />
        <BottomSheetSelect
          value={signalFilter}
          onChange={setSignalFilter}
          options={signalOptions}
          placeholder="Všechny signály"
          title="Filtr podle signálu"
        />
      </div>

      {/* Table */}
      {filteredHistory.length === 0 ? (
        <Muted>Žádné signály neodpovídají filtrům.</Muted>
      ) : (
        <>
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Ticker</th>
                  <th>Signál</th>
                  <th>Cena</th>
                  <th>1D</th>
                  <th>1T</th>
                  <th>1M</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((sig) => (
                  <tr key={sig.id}>
                    <td>{formatDateShort(sig.created_at)}</td>
                    <td>
                      <Ticker>{sig.ticker}</Ticker>
                    </td>
                    <td>
                      <SignalBadge type={sig.signal_type} size="sm" />
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Předchozí
              </Button>
              <Text size="sm" color="muted">
                Stránka {currentPage} z {totalPages}
              </Text>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                Další →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
