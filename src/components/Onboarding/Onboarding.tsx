import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { PageTitle, Description, Label, Text } from '@/components/shared/Typography';
import { portfoliosApi } from '@/services/api';
import type { Portfolio } from '@/types/database';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: (portfolio: Portfolio) => void;
  onSignOut: () => void;
}

export function Onboarding({ onComplete, onSignOut }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'create-portfolio'>('welcome');
  const [portfolioName, setPortfolioName] = useState('My Portfolio');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!portfolioName.trim()) {
      setError('Portfolio name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const portfolio = await portfoliosApi.create({
        name: portfolioName.trim(),
        is_default: true,
      });
      onComplete(portfolio);
    } catch (err) {
      console.error('Failed to create portfolio:', err);
      setError('Failed to create portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {step === 'welcome' && (
          <>
            <div className="onboarding-header">
              <PageTitle>Welcome to Portfolio Tracker!</PageTitle>
              <Description>
                Track your stock investments, analyze performance, and make informed decisions.
              </Description>
            </div>

            <div className="onboarding-features">
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <Text>Track multiple portfolios</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📈</span>
                <Text>Real-time price updates</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💡</span>
                <Text>Smart buy/sell recommendations</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔍</span>
                <Text>Technical & fundamental analysis</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📰</span>
                <Text>News with sentiment analysis</Text>
              </div>
            </div>

            <div className="onboarding-actions">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep('create-portfolio')}
              >
                Get Started
              </Button>
            </div>
          </>
        )}

        {step === 'create-portfolio' && (
          <>
            <div className="onboarding-header">
              <PageTitle>Create Your First Portfolio</PageTitle>
              <Description>
                A portfolio helps you organize and track your investments.
              </Description>
            </div>

            <form onSubmit={handleCreatePortfolio} className="onboarding-form">
              {error && (
                <div className="onboarding-error">
                  <Text color="primary">{error}</Text>
                </div>
              )}

              <div className="form-group">
                <Label htmlFor="portfolioName">Portfolio Name</Label>
                <Input
                  id="portfolioName"
                  type="text"
                  inputSize="lg"
                  fullWidth
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="e.g., Main Portfolio, Retirement, Trading"
                  required
                  autoFocus
                />
              </div>

              <div className="onboarding-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('welcome')}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Portfolio'}
                </Button>
              </div>
            </form>
          </>
        )}

        <div className="onboarding-footer">
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
