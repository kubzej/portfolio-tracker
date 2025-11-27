import { useState, useEffect } from 'react';
import type { Portfolio } from '@/types/database';
import { portfoliosApi } from '@/services/api';
import { PortfolioManager } from '@/components/PortfolioManager';
import './PortfolioSelector.css';

interface PortfolioSelectorProps {
  selectedPortfolioId: string | null;
  onPortfolioChange: (portfolioId: string | null) => void;
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
          onPortfolioChange(defaultPortfolio.id);
        } else {
          onPortfolioChange(data[0].id);
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
    onPortfolioChange(portfolio.id);
  };

  if (loading) {
    return <div className="portfolio-selector loading">Loading...</div>;
  }

  if (error) {
    return <div className="portfolio-selector error">{error}</div>;
  }

  return (
    <>
      <div className="portfolio-selector">
        <select
          value={selectedPortfolioId ?? 'all'}
          onChange={(e) =>
            onPortfolioChange(e.target.value === 'all' ? null : e.target.value)
          }
          className="portfolio-select"
        >
          {showAllOption && <option value="all">All Portfolios</option>}
          {portfolios.map((portfolio) => (
            <option key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
              {portfolio.is_default ? ' (Default)' : ''}
            </option>
          ))}
        </select>
        <div className="portfolio-indicator">
          {selectedPortfolioId && (
            <span
              className="portfolio-color"
              style={{
                backgroundColor:
                  portfolios.find((p) => p.id === selectedPortfolioId)?.color ??
                  '#6366f1',
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

      {showManager && (
        <PortfolioManager
          onClose={handleManagerClose}
          onPortfolioCreated={handlePortfolioCreated}
        />
      )}
    </>
  );
}
