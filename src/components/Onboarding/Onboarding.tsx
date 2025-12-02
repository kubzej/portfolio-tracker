import { useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import {
  PageTitle,
  Description,
  Label,
  Text,
} from '@/components/shared/Typography';
import { portfoliosApi } from '@/services/api';
import type { Portfolio } from '@/types/database';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: (portfolio: Portfolio) => void;
  onSignOut: () => void;
}

export function Onboarding({ onComplete, onSignOut }: OnboardingProps) {
  const [step, setStep] = useState<'welcome' | 'create-portfolio'>('welcome');
  const [portfolioName, setPortfolioName] = useState('Moje portfolio');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!portfolioName.trim()) {
      setError('Název portfolia je povinný');
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
      setError('Nepodařilo se vytvořit portfolio. Zkuste to znovu.');
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
              <PageTitle>Vítejte v Portfolio Trackeru!</PageTitle>
              <Description>
                Sledujte své akciové investice, analyzujte výkonnost a dělejte
                informovaná rozhodnutí.
              </Description>
            </div>

            <div className="onboarding-features">
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <Text>Sledujte více portfolií</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📈</span>
                <Text>Aktualizace cen v reálném čase</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💡</span>
                <Text>Chytrá doporučení k nákupu/prodeji</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔍</span>
                <Text>Technická a fundamentální analýza</Text>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📰</span>
                <Text>Novinky s analýzou sentimentu</Text>
              </div>
            </div>

            <div className="onboarding-actions">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep('create-portfolio')}
              >
                Začít
              </Button>
            </div>
          </>
        )}

        {step === 'create-portfolio' && (
          <>
            <div className="onboarding-header">
              <PageTitle>Vytvořte své první portfolio</PageTitle>
              <Description>
                Portfolio vám pomůže organizovat a sledovat vaše investice.
              </Description>
            </div>

            <form onSubmit={handleCreatePortfolio} className="onboarding-form">
              {error && (
                <div className="onboarding-error">
                  <Text color="primary">{error}</Text>
                </div>
              )}

              <div className="form-group">
                <Label htmlFor="portfolioName">Název portfolia</Label>
                <Input
                  id="portfolioName"
                  type="text"
                  inputSize="lg"
                  fullWidth
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="např. Hlavní portfolio, Důchod, Trading"
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
                  Zpět
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'Vytvářím...' : 'Vytvořit portfolio'}
                </Button>
              </div>
            </form>
          </>
        )}

        <div className="onboarding-footer">
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            Odhlásit se
          </Button>
        </div>
      </div>
    </div>
  );
}
