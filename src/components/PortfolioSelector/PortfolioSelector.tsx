import { useState, useEffect } from 'react';
import type { Portfolio } from '@/types/database';
import { portfoliosApi } from '@/services/api';
import { PortfolioManager } from '@/components/PortfolioManager';
import {
  ActionSheet,
  ActionSheetOption,
} from '@/components/shared/ActionSheet';
import { Button } from '@/components/shared/Button';
import { Text } from '@/components/shared/Typography';
import './PortfolioSelector.css';

interface PortfolioSelectorProps {
  selectedPortfolioId: string | null;
  onPortfolioChange: (
    portfolioId: string | null,
    portfolio: Portfolio | null
  ) => void;
  showAllOption?: boolean;
}

export function PortfolioSelector({
  selectedPortfolioId,
  onPortfolioChange,
  showAllOption = true,
}: PortfolioSelectorProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [showMobilePicker, setShowMobilePicker] = useState(false);

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await portfoliosApi.getAll();
      setPortfolios(data);

      // Auto-select default portfolio if none selected and portfolios exist
      if (selectedPortfolioId === null && data.length > 0) {
        const defaultPortfolio = data.find((p) => p.is_default);
        if (defaultPortfolio) {
          onPortfolioChange(defaultPortfolio.id, defaultPortfolio);
        } else {
          onPortfolioChange(data[0].id, data[0]);
        }
      }

      // If selected portfolio no longer exists, reset selection
      if (selectedPortfolioId && data.length > 0) {
        const stillExists = data.find((p) => p.id === selectedPortfolioId);
        if (!stillExists) {
          const defaultPortfolio = data.find((p) => p.is_default) || data[0];
          onPortfolioChange(defaultPortfolio.id, defaultPortfolio);
        }
      }
    } catch (err) {
      setError('Nepodařilo se načíst portfolia');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManagerClose = () => {
    setShowManager(false);
    loadPortfolios(); // Refresh list after closing manager
  };

  const handlePortfolioCreated = (portfolio: Portfolio) => {
    onPortfolioChange(portfolio.id, portfolio);
  };

  const handleSelectChange = (value: string) => {
    if (value === 'all') {
      onPortfolioChange(null, null);
    } else {
      const portfolio = portfolios.find((p) => p.id === value) || null;
      onPortfolioChange(value, portfolio);
    }
    setShowMobilePicker(false);
  };

  const selectedPortfolio = portfolios.find(
    (p) => p.id === selectedPortfolioId
  );

  const displayName = selectedPortfolio
    ? selectedPortfolio.name
    : showAllOption
    ? 'Všechna portfolia'
    : 'Vybrat...';

  if (loading) {
    return (
      <div className="portfolio-selector loading">
        <Text color="muted">Načítám...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-selector error">
        <Text color="muted">{error}</Text>
      </div>
    );
  }

  return (
    <>
      <div className="portfolio-selector">
        {/* Desktop: native select */}
        <select
          value={selectedPortfolioId ?? 'all'}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="portfolio-select desktop-only"
        >
          {showAllOption && <option value="all">Všechna portfolia</option>}
          {portfolios.map((portfolio) => (
            <option key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
              {portfolio.is_default ? ' (Výchozí)' : ''}
            </option>
          ))}
        </select>

        {/* Mobile: button that opens bottom sheet */}
        <Button
          variant="ghost"
          className="portfolio-select-btn mobile-only"
          onClick={() => setShowMobilePicker(true)}
        >
          {selectedPortfolio && (
            <span
              className="btn-color-dot"
              style={{ backgroundColor: selectedPortfolio.color ?? '#6366f1' }}
            />
          )}
          <Text weight="semibold" size="sm">
            {displayName}
          </Text>
          <svg
            className="btn-chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Button>

        <div className="portfolio-indicator desktop-only">
          {selectedPortfolio && (
            <span
              className="portfolio-color"
              style={{
                backgroundColor: selectedPortfolio.color ?? '#6366f1',
              }}
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon
          className="portfolio-manage-btn"
          onClick={() => setShowManager(true)}
          title="Spravovat portfolia"
        >
          ⚙
        </Button>
      </div>

      {/* Mobile action sheet picker */}
      <ActionSheet
        isOpen={showMobilePicker}
        onClose={() => setShowMobilePicker(false)}
        title="Vybrat portfolio"
      >
        <div className="action-sheet-options">
          {showAllOption && (
            <ActionSheetOption
              label="Všechna portfolia"
              color="#6366f1"
              selected={selectedPortfolioId === null}
              onClick={() => handleSelectChange('all')}
            />
          )}
          {portfolios.map((portfolio) => (
            <ActionSheetOption
              key={portfolio.id}
              label={portfolio.name}
              suffix={portfolio.is_default ? ' (Výchozí)' : undefined}
              color={portfolio.color ?? '#6366f1'}
              selected={selectedPortfolioId === portfolio.id}
              onClick={() => handleSelectChange(portfolio.id)}
            />
          ))}
        </div>
      </ActionSheet>

      {showManager && (
        <PortfolioManager
          onClose={handleManagerClose}
          onPortfolioCreated={handlePortfolioCreated}
        />
      )}
    </>
  );
}
