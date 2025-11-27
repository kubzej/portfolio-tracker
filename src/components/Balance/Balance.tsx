import { useState, useEffect } from 'react';
import { portfolioApi } from '@/services/api';
import { PortfolioBalance } from '@/types';
import './Balance.css';

export function Balance() {
  const [balance, setBalance] = useState<PortfolioBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const data = await portfolioApi.getBalance();
        setBalance(data);
      } catch (err) {
        setError('Failed to fetch balance');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, []);

  if (loading) {
    return (
      <div className="balance-card">
        <div className="balance-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="balance-card">
        <div className="balance-error">{error}</div>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  const isPositive = balance.totalGain >= 0;

  return (
    <div className="balance-card">
      <h2 className="balance-title">Portfolio Balance</h2>

      <div className="balance-value">
        <span className="balance-currency">{balance.currency}</span>
        <span className="balance-amount">
          {balance.totalValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>

      <div className={`balance-gain ${isPositive ? 'positive' : 'negative'}`}>
        <span className="gain-amount">
          {isPositive ? '+' : ''}
          {balance.currency}{' '}
          {balance.totalGain.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="gain-percentage">
          ({isPositive ? '+' : ''}
          {balance.totalGainPercentage.toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
