import { useState } from 'react';
import type {
  SignalEvaluationResult,
  SignalCondition,
} from '@/utils/recommendations';
import { SIGNAL_CONFIG } from '@/utils/signals';
import { Text, MetricLabel } from '../Typography';
import { cn } from '@/utils/cn';
import './SignalCheck.css';

// ============================================================================
// SIGNAL CHECK ITEM
// ============================================================================

interface SignalCheckItemProps {
  evaluation: SignalEvaluationResult;
}

export function SignalCheckItem({ evaluation }: SignalCheckItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SIGNAL_CONFIG[evaluation.signal];
  const passed = evaluation.passed;

  // Count passed/failed conditions
  const passedCount = evaluation.conditions.filter((c) => c.passed).length;
  const totalCount = evaluation.conditions.length;

  return (
    <div className={cn('signal-check-item', passed && 'passed')}>
      <div
        className="signal-check-header"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status Icon */}
        <div className={cn('signal-check-status', passed ? 'success' : 'fail')}>
          {passed ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3L9 9M9 3L3 9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>

        {/* Signal Name */}
        <span className="signal-check-name">
          <Text size="sm" weight="medium">
            {config.label}
          </Text>
        </span>

        {/* Condition Count */}
        <span className="signal-check-count">
          <Text size="xs" color="muted">
            {passedCount}/{totalCount}
          </Text>
        </span>

        {/* Expand Arrow */}
        <div className={cn('signal-check-arrow', expanded && 'expanded')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Conditions List */}
      {expanded && (
        <div className="signal-check-conditions">
          {evaluation.conditions.map((cond, i) => (
            <ConditionItem key={i} condition={cond} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONDITION ITEM
// ============================================================================

interface ConditionItemProps {
  condition: SignalCondition;
}

function ConditionItem({ condition }: ConditionItemProps) {
  const passed = condition.passed;

  return (
    <div className={cn('condition-item', passed ? 'passed' : 'failed')}>
      <div className={cn('condition-dot', passed ? 'success' : 'fail')} />
      <span className="condition-name">
        <Text size="xs">{condition.name}</Text>
      </span>
      <span className="condition-value">
        <Text size="xs" color="muted">
          {String(condition.actual)}
        </Text>
      </span>
      <span className="condition-required">
        <Text size="xs" color="muted">
          {condition.required}
        </Text>
      </span>
    </div>
  );
}

// ============================================================================
// SIGNAL CHECK GROUP
// ============================================================================

interface SignalCheckGroupProps {
  title: string;
  evaluations: SignalEvaluationResult[];
}

export function SignalCheckGroup({
  title,
  evaluations,
}: SignalCheckGroupProps) {
  if (evaluations.length === 0) return null;

  // Count passed signals
  const passedSignals = evaluations.filter((e) => e.passed).length;

  return (
    <div className="signal-check-group">
      <div className="signal-check-group-header">
        <MetricLabel>{title}</MetricLabel>
        <Text size="xs" color="muted">
          {passedSignals}/{evaluations.length} splněno
        </Text>
      </div>
      <div className="signal-check-group-items">
        {evaluations.map((eval_) => (
          <SignalCheckItem key={eval_.signal} evaluation={eval_} />
        ))}
      </div>
    </div>
  );
}
