import { useState } from 'react';
import type {
  SignalExplanation,
  SignalEvaluationResult,
  SignalCondition,
  SignalType,
} from '@/utils/recommendations';
import { SIGNAL_CONFIG } from '@/utils/signals';
import {
  Text,
  CardTitle,
  MetricLabel,
  MetricValue,
  Badge,
  Muted,
} from '@/components/shared/Typography';
import { Button } from '@/components/shared/Button';
import './ExplainPanel.css';

interface ExplainPanelProps {
  explanation: SignalExplanation;
  actionSignal: SignalType | null;
  qualitySignal: SignalType;
}

export function ExplainPanel({
  explanation,
  actionSignal,
  qualitySignal,
}: ExplainPanelProps) {
  const [showDetail, setShowDetail] = useState(false);

  const actionConfig = actionSignal ? SIGNAL_CONFIG[actionSignal] : null;
  const qualityConfig = SIGNAL_CONFIG[qualitySignal];

  return (
    <div className="explain-panel">
      {/* Quick Summary */}
      <div className="explain-summary">
        <CardTitle>Proč tyto signály?</CardTitle>
        <div className="explain-summary-content">
          {actionSignal && actionConfig && (
            <div className="signal-reason">
              <Badge variant={actionConfig.class as any} size="sm">
                {actionConfig.label}
              </Badge>
              <Text size="sm">
                {explanation.decisionPath.actionSignal.reason}
              </Text>
            </div>
          )}
          {!actionSignal && (
            <div className="signal-reason">
              <Muted>Žádný action signál</Muted>
              <Text size="sm" color="muted">
                {explanation.decisionPath.actionSignal.reason}
              </Text>
            </div>
          )}
          <div className="signal-reason">
            <Badge variant={qualityConfig.class as any} size="sm">
              {qualityConfig.label}
            </Badge>
            <Text size="sm">
              {explanation.decisionPath.qualitySignal.reason}
            </Text>
          </div>
        </div>
      </div>

      {/* Toggle Detail Button */}
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        onClick={() => setShowDetail(!showDetail)}
      >
        {showDetail ? '▲ Skrýt detail' : '▼ Zobrazit detail'}
      </Button>

      {/* Detailed View */}
      {showDetail && (
        <div className="explain-detail">
          {/* Score Breakdown */}
          <div className="explain-section">
            <CardTitle>Skóre komponenty</CardTitle>
            <div className="score-grid">
              <ScoreRow
                label="Fundamentální"
                data={explanation.scoreBreakdown.fundamental}
              />
              <ScoreRow
                label="Technické"
                data={explanation.scoreBreakdown.technical}
              />
              <ScoreRow
                label="Analytici"
                data={explanation.scoreBreakdown.analyst}
              />
              <ScoreRow label="Zprávy" data={explanation.scoreBreakdown.news} />
              <ScoreRow
                label="Insideři"
                data={explanation.scoreBreakdown.insider}
              />
              {explanation.scoreBreakdown.portfolio && (
                <ScoreRow
                  label="Portfolio"
                  data={explanation.scoreBreakdown.portfolio}
                />
              )}
              <div className="score-row composite">
                <MetricLabel>CELKEM</MetricLabel>
                <div className="score-values">
                  <Text weight="bold">
                    {explanation.scoreBreakdown.composite.points}/
                    {explanation.scoreBreakdown.composite.maxPoints}b
                  </Text>
                  <MetricValue
                    sentiment={
                      explanation.scoreBreakdown.composite.percent >= 60
                        ? 'positive'
                        : explanation.scoreBreakdown.composite.percent >= 40
                        ? 'neutral'
                        : 'negative'
                    }
                  >
                    {explanation.scoreBreakdown.composite.percent}%
                  </MetricValue>
                </div>
                <ScoreBar
                  percent={explanation.scoreBreakdown.composite.percent}
                />
              </div>
            </div>
          </div>

          {/* Technical Indicators */}
          <div className="explain-section">
            <CardTitle>Technické indikátory</CardTitle>
            <div className="indicators-grid">
              <IndicatorItem
                label="RSI(14)"
                value={explanation.technicalIndicators.rsi14}
                interpretation={getRsiInterpretation(
                  explanation.technicalIndicators.rsi14
                )}
              />
              <IndicatorItem
                label="MACD Hist"
                value={explanation.technicalIndicators.macdHistogram}
                interpretation={getMacdInterpretation(
                  explanation.technicalIndicators.macdHistogram
                )}
              />
              <IndicatorItem
                label="Stoch K/D"
                value={
                  explanation.technicalIndicators.stochK !== null
                    ? `${explanation.technicalIndicators.stochK}/${
                        explanation.technicalIndicators.stochD ?? '-'
                      }`
                    : null
                }
                interpretation={getStochInterpretation(
                  explanation.technicalIndicators.stochK
                )}
              />
              <IndicatorItem
                label="ADX"
                value={explanation.technicalIndicators.adx}
                interpretation={getAdxInterpretation(
                  explanation.technicalIndicators.adx
                )}
              />
              <IndicatorItem
                label="SMA 50"
                value={
                  explanation.technicalIndicators.sma50 !== null
                    ? `$${explanation.technicalIndicators.sma50.toFixed(2)}`
                    : null
                }
              />
              <IndicatorItem
                label="SMA 200"
                value={
                  explanation.technicalIndicators.sma200 !== null
                    ? `$${explanation.technicalIndicators.sma200.toFixed(2)}`
                    : null
                }
              />
              <IndicatorItem
                label="ATR(14)"
                value={
                  explanation.technicalIndicators.atr14 !== null
                    ? explanation.technicalIndicators.atr14.toFixed(2)
                    : null
                }
              />
            </div>
          </div>

          {/* Fundamental Data */}
          <div className="explain-section">
            <CardTitle>Fundamenty</CardTitle>
            <div className="indicators-grid">
              <IndicatorItem
                label="P/E"
                value={explanation.fundamentalData.peRatio}
                interpretation={getPeInterpretation(
                  explanation.fundamentalData.peRatio
                )}
              />
              <IndicatorItem
                label="Forward P/E"
                value={explanation.fundamentalData.forwardPE}
              />
              <IndicatorItem
                label="PEG"
                value={explanation.fundamentalData.pegRatio}
                interpretation={getPegInterpretation(
                  explanation.fundamentalData.pegRatio
                )}
              />
              <IndicatorItem
                label="ROE"
                value={
                  explanation.fundamentalData.roe !== null
                    ? `${(explanation.fundamentalData.roe * 100).toFixed(1)}%`
                    : null
                }
              />
              <IndicatorItem
                label="Net Margin"
                value={
                  explanation.fundamentalData.profitMargin !== null
                    ? `${(
                        explanation.fundamentalData.profitMargin * 100
                      ).toFixed(1)}%`
                    : null
                }
              />
              <IndicatorItem
                label="D/E"
                value={explanation.fundamentalData.debtToEquity}
              />
              <IndicatorItem
                label="Rev Growth"
                value={
                  explanation.fundamentalData.revenueGrowth !== null
                    ? `${(
                        explanation.fundamentalData.revenueGrowth * 100
                      ).toFixed(1)}%`
                    : null
                }
              />
              <IndicatorItem
                label="EPS Growth"
                value={
                  explanation.fundamentalData.epsGrowth !== null
                    ? `${(explanation.fundamentalData.epsGrowth * 100).toFixed(
                        1
                      )}%`
                    : null
                }
              />
            </div>
          </div>

          {/* Analyst Data */}
          <div className="explain-section">
            <CardTitle>Analytici</CardTitle>
            <div className="analyst-data">
              <div className="analyst-target">
                <Text size="sm" color="muted">
                  Cílová cena:
                </Text>
                <Text weight="semibold">
                  {explanation.analystData.targetPrice !== null
                    ? `$${explanation.analystData.targetPrice.toFixed(2)}`
                    : 'N/A'}
                </Text>
                {explanation.analystData.upside !== null && (
                  <MetricValue
                    sentiment={
                      explanation.analystData.upside > 10
                        ? 'positive'
                        : explanation.analystData.upside < -10
                        ? 'negative'
                        : 'neutral'
                    }
                  >
                    {explanation.analystData.upside > 0 ? '+' : ''}
                    {explanation.analystData.upside}%
                  </MetricValue>
                )}
              </div>
              <div className="analyst-recs">
                <div className="rec-item buy">
                  <Text size="xs" color="muted">
                    Strong Buy
                  </Text>
                  <Text weight="semibold">
                    {explanation.analystData.strongBuy}
                  </Text>
                </div>
                <div className="rec-item buy">
                  <Text size="xs" color="muted">
                    Buy
                  </Text>
                  <Text weight="semibold">{explanation.analystData.buy}</Text>
                </div>
                <div className="rec-item hold">
                  <Text size="xs" color="muted">
                    Hold
                  </Text>
                  <Text weight="semibold">{explanation.analystData.hold}</Text>
                </div>
                <div className="rec-item sell">
                  <Text size="xs" color="muted">
                    Sell
                  </Text>
                  <Text weight="semibold">{explanation.analystData.sell}</Text>
                </div>
                <div className="rec-item sell">
                  <Text size="xs" color="muted">
                    Strong Sell
                  </Text>
                  <Text weight="semibold">
                    {explanation.analystData.strongSell}
                  </Text>
                </div>
              </div>
              <div className="analyst-consensus">
                <Text size="sm" color="muted">
                  Konsenzus ({explanation.analystData.totalAnalysts} analytiků):
                </Text>
                <Text weight="semibold">
                  {explanation.analystData.consensusScore !== null
                    ? explanation.analystData.consensusScore.toFixed(1)
                    : 'N/A'}
                  /5
                </Text>
              </div>
            </div>
          </div>

          {/* Signal Evaluation */}
          <div className="explain-section">
            <CardTitle>Vyhodnocení signálů</CardTitle>
            <div className="signal-evaluation">
              <div className="eval-category">
                <Text weight="semibold" color="muted">
                  ACTION SIGNÁLY
                </Text>
                {explanation.signalEvaluation
                  .filter((e) => e.category === 'action')
                  .map((eval_) => (
                    <SignalEvalRow key={eval_.signal} evaluation={eval_} />
                  ))}
              </div>
              <div className="eval-category">
                <Text weight="semibold" color="muted">
                  QUALITY SIGNÁLY
                </Text>
                {explanation.signalEvaluation
                  .filter((e) => e.category === 'quality')
                  .map((eval_) => (
                    <SignalEvalRow key={eval_.signal} evaluation={eval_} />
                  ))}
              </div>
            </div>
          </div>

          {/* Thresholds Reference */}
          <div className="explain-section">
            <CardTitle>Použité prahy</CardTitle>
            <div className="thresholds-grid">
              <ThresholdItem
                label="DIP Trigger"
                value={explanation.thresholds.DIP_TRIGGER}
              />
              <ThresholdItem
                label="RSI Overbought"
                value={explanation.thresholds.RSI_OVERBOUGHT}
              />
              <ThresholdItem
                label="RSI Oversold"
                value={explanation.thresholds.RSI_OVERSOLD}
              />
              <ThresholdItem
                label="ADX Strong"
                value={explanation.thresholds.ADX_STRONG}
              />
              <ThresholdItem
                label="Fund Quality"
                value={`${explanation.thresholds.FUND_QUALITY}%`}
              />
              <ThresholdItem
                label="Fund Moderate"
                value={`${explanation.thresholds.FUND_MODERATE}%`}
              />
              <ThresholdItem
                label="Tech Strong"
                value={`${explanation.thresholds.TECH_STRONG}%`}
              />
              <ThresholdItem
                label="Take Profit"
                value={`${explanation.thresholds.GAIN_TAKE_PROFIT}%`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components

function ScoreRow({
  label,
  data,
}: {
  label: string;
  data: { points: number; maxPoints: number; percent: number };
}) {
  return (
    <div className="score-row">
      <MetricLabel>{label}</MetricLabel>
      <div className="score-values">
        <Text size="sm">
          {data.points}/{data.maxPoints}b
        </Text>
        <MetricValue
          sentiment={
            data.percent >= 60
              ? 'positive'
              : data.percent >= 40
              ? 'neutral'
              : 'negative'
          }
        >
          {data.percent}%
        </MetricValue>
      </div>
      <ScoreBar percent={data.percent} />
    </div>
  );
}

function ScoreBar({ percent }: { percent: number }) {
  const color =
    percent >= 60
      ? 'var(--color-success)'
      : percent >= 40
      ? 'var(--color-warning)'
      : 'var(--color-danger)';

  return (
    <div className="score-bar">
      <div
        className="score-bar-fill"
        style={{ width: `${percent}%`, backgroundColor: color }}
      />
    </div>
  );
}

function IndicatorItem({
  label,
  value,
  interpretation,
}: {
  label: string;
  value: number | string | null;
  interpretation?: string;
}) {
  return (
    <div className="indicator-item">
      <MetricLabel>{label}</MetricLabel>
      <Text weight="semibold">
        {value !== null ? String(value) : <Muted>N/A</Muted>}
      </Text>
      {interpretation && (
        <Text size="xs" color="muted">
          {interpretation}
        </Text>
      )}
    </div>
  );
}

function ThresholdItem({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="threshold-item">
      <Text size="xs" color="muted">
        {label}
      </Text>
      <Text size="sm" weight="semibold">
        {value}
      </Text>
    </div>
  );
}

function SignalEvalRow({ evaluation }: { evaluation: SignalEvaluationResult }) {
  const config = SIGNAL_CONFIG[evaluation.signal];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`eval-row ${evaluation.passed ? 'passed' : 'failed'}`}>
      <div className="eval-header" onClick={() => setExpanded(!expanded)}>
        <span className="eval-status">{evaluation.passed ? '✓' : '✗'}</span>
        <Text size="sm" weight="medium">
          {config.label}
        </Text>
        <span className="eval-expand">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="eval-conditions">
          {evaluation.conditions.map((cond, i) => (
            <ConditionRow key={i} condition={cond} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionRow({ condition }: { condition: SignalCondition }) {
  return (
    <div className={`condition-row ${condition.passed ? 'passed' : 'failed'}`}>
      <span className="condition-status">{condition.passed ? '✓' : '✗'}</span>
      <Text size="xs">
        {condition.name}: {String(condition.actual)} {condition.required}
      </Text>
    </div>
  );
}

// Interpretation helpers

function getRsiInterpretation(rsi: number | null): string | undefined {
  if (rsi === null) return undefined;
  if (rsi > 70) return 'Překoupeno';
  if (rsi < 30) return 'Přeprodáno';
  if (rsi > 60) return 'Býčí';
  if (rsi < 40) return 'Medvědí';
  return 'Neutrální';
}

function getMacdInterpretation(hist: number | null): string | undefined {
  if (hist === null) return undefined;
  if (hist > 0.5) return 'Silně býčí';
  if (hist > 0) return 'Býčí';
  if (hist < -0.5) return 'Silně medvědí';
  if (hist < 0) return 'Medvědí';
  return 'Neutrální';
}

function getStochInterpretation(stochK: number | null): string | undefined {
  if (stochK === null) return undefined;
  if (stochK > 80) return 'Překoupeno';
  if (stochK < 20) return 'Přeprodáno';
  return 'Neutrální';
}

function getAdxInterpretation(adx: number | null): string | undefined {
  if (adx === null) return undefined;
  if (adx > 50) return 'Extrémně silný';
  if (adx > 25) return 'Silný trend';
  if (adx > 20) return 'Mírný trend';
  return 'Slabý/žádný trend';
}

function getPeInterpretation(pe: number | null): string | undefined {
  if (pe === null) return undefined;
  if (pe < 0) return 'Záporné (ztráta)';
  if (pe < 15) return 'Levné';
  if (pe < 25) return 'Průměrné';
  if (pe < 40) return 'Drahé';
  return 'Velmi drahé';
}

function getPegInterpretation(peg: number | null): string | undefined {
  if (peg === null) return undefined;
  if (peg < 0) return 'Záporné';
  if (peg < 1) return 'Podhodnoceno';
  if (peg < 2) return 'Férové';
  return 'Nadhodnoceno';
}
