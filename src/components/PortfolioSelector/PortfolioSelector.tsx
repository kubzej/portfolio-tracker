import { useState, useEffect } from 'react';
import type { Portfolio } from '@/types/database';
import { portfoliosApi } from '@/services/api';
import { PortfolioManager } from '@/components/PortfolioManager';
import { BottomSheet } from '@/components/shared/BottomSheet';
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

      // Auto-select default portfolio if none selected
      if (selectedPortfolioId === null && data.length > 0) {
        const defaultPortfolio = data.find((p) => p.is_default);
        if (defaultPortfolio) {
          onPortfolioChange(defaultPortfolio.id, defaultPortfolio);
        } else {
          onPortfolioChange(data[0].id, data[0]);
        }
      }
    } catch (err) {
      setError('Failed to load portfolios');
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
    ? 'All Portfolios'
    : 'Select...';

  if (loading) {
    return <div className="portfolio-selector loading">Loading...</div>;
  }

  if (error) {
    return <div className="portfolio-selector error">{error}</div>;
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
          {showAllOption && <option value="all">All Portfolios</option>}
          {portfolios.map((portfolio) => (
            <option key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
              {portfolio.is_default ? ' (Default)' : ''}
            </option>
          ))}
        </select>

        {/* Mobile: button that opens bottom sheet */}
        <button
          className="portfolio-select-btn mobile-only"
          onClick={() => setShowMobilePicker(true)}
        >
          {selectedPortfolio && (
            <span
              className="btn-color-dot"
              style={{ backgroundColor: selectedPortfolio.color ?? '#6366f1' }}
            />
          )}
          <span className="btn-text">{displayName}</span>
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
        </button>

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
        <button
          className="portfolio-manage-btn"
          onClick={() => setShowManager(true)}
          title="Manage portfolios"
        >
          ⚙
        </button>
      </div>

      {/* Mobile bottom sheet picker */}
      <BottomSheet
        isOpen={showMobilePicker}
        onClose={() => setShowMobilePicker(false)}
        title="Select Portfolio"
      >
        <div className="bottom-sheet-options">
          {showAllOption && (
            <button
              className={`bottom-sheet-option ${
                selectedPortfolioId === null ? 'selected' : ''
              }`}
              onClick={() => handleSelectChange('all')}
            >
              <span
                className="option-color"
                style={{ backgroundColor: '#6366f1' }}
              />
              <span className="option-label">All Portfolios</span>
              {selectedPortfolioId === null && (
                <span className="option-check">✓</span>
              )}
            </button>
          )}
          {portfolios.map((portfolio) => (
            <button
              key={portfolio.id}
              className={`bottom-sheet-option ${
                selectedPortfolioId === portfolio.id ? 'selected' : ''
              }`}
              onClick={() => handleSelectChange(portfolio.id)}
            >
              <span
                className="option-color"
                style={{ backgroundColor: portfolio.color ?? '#6366f1' }}
              />
              <span className="option-label">
                {portfolio.name}
                {portfolio.is_default && (
                  <span className="option-default"> (Default)</span>
                )}
              </span>
              {selectedPortfolioId === portfolio.id && (
                <span className="option-check">✓</span>
              )}
            </button>
          ))}
        </div>
      </BottomSheet>

      {showManager && (
        <PortfolioManager
          onClose={handleManagerClose}
          onPortfolioCreated={handlePortfolioCreated}
        />
      )}
    </>
  );
}
