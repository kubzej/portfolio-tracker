import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalCheckItem } from './SignalCheck';
import type { SignalEvaluationResult } from '@/utils/recommendations';

describe('SignalCheckItem', () => {
  const passedEvaluation: SignalEvaluationResult = {
    signal: 'DIP_OPPORTUNITY',
    passed: true,
    conditions: [
      {
        name: 'Condition 1',
        passed: true,
        actual: 80,
        required: 70,
        operator: '>=',
      },
      {
        name: 'Condition 2',
        passed: true,
        actual: 50,
        required: 40,
        operator: '>=',
      },
    ],
  };

  const failedEvaluation: SignalEvaluationResult = {
    signal: 'MOMENTUM',
    passed: false,
    conditions: [
      {
        name: 'Condition 1',
        passed: true,
        actual: 80,
        required: 70,
        operator: '>=',
      },
      {
        name: 'Condition 2',
        passed: false,
        actual: 30,
        required: 50,
        operator: '>=',
      },
    ],
  };

  it('renders signal check item', () => {
    const { container } = render(
      <SignalCheckItem evaluation={passedEvaluation} />
    );
    expect(container.querySelector('.signal-check-item')).toBeInTheDocument();
  });

  it('applies passed class when all conditions pass', () => {
    const { container } = render(
      <SignalCheckItem evaluation={passedEvaluation} />
    );
    expect(
      container.querySelector('.signal-check-item.passed')
    ).toBeInTheDocument();
  });

  it('does not apply passed class when conditions fail', () => {
    const { container } = render(
      <SignalCheckItem evaluation={failedEvaluation} />
    );
    expect(
      container.querySelector('.signal-check-item.passed')
    ).not.toBeInTheDocument();
  });

  it('renders success status icon for passed signal', () => {
    const { container } = render(
      <SignalCheckItem evaluation={passedEvaluation} />
    );
    expect(
      container.querySelector('.signal-check-status.success')
    ).toBeInTheDocument();
  });

  it('renders fail status icon for failed signal', () => {
    const { container } = render(
      <SignalCheckItem evaluation={failedEvaluation} />
    );
    expect(
      container.querySelector('.signal-check-status.fail')
    ).toBeInTheDocument();
  });
});
