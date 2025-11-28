import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import {
  StocksList,
  AddStockModal,
  AddTransactionModal,
} from './components/StocksList';
import { StockDetail } from './components/StockDetail';
import { StockResearch } from './components/StockResearch';
import { ResearchView } from './components/Research';
import { PortfolioSelector } from './components/PortfolioSelector';
import { Analysis } from './components/Analysis';
import { News } from './components/News';
import { WatchlistManager, WatchlistView } from './components/Watchlists';
import { Login } from './components/Login';
import { Button } from './components/shared/Button';
import { useAuth } from './contexts/AuthContext';
import { refreshAllPrices } from './services/api';
import type { Portfolio } from './types/database';
import './App.css';

type View =
  | 'dashboard'
  | 'stocks'
  | 'stock-detail'
  | 'stock-research'
  | 'research'
  | 'analysis'
  | 'news'
  | 'watchlists'
  | 'watchlist-detail';

// Valid views for URL persistence
const VALID_VIEWS: View[] = [
  'dashboard',
  'stocks',
  'analysis',
  'news',
  'research',
  'watchlists',
];

// Get initial view from URL hash
function getInitialView(): View {
  const hash = window.location.hash.slice(1); // Remove #
  if (VALID_VIEWS.includes(hash as View)) {
    return hash as View;
  }
  return 'dashboard';
}

function App() {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>(getInitialView);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(
    null
  );
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    null
  );
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(
    null
  );
  // Stock Research state
  const [researchTicker, setResearchTicker] = useState<string | null>(null);
  const [researchStockName, setResearchStockName] = useState<
    string | undefined
  >(undefined);
  const [researchFinnhubTicker, setResearchFinnhubTicker] = useState<
    string | undefined
  >(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);

  // Sync URL hash with current view
  useEffect(() => {
    if (VALID_VIEWS.includes(currentView)) {
      window.history.replaceState(null, '', `#${currentView}`);
    }
  }, [currentView]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (VALID_VIEWS.includes(hash as View)) {
        setCurrentView(hash as View);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleStockClick = (stockId: string) => {
    setSelectedStockId(stockId);
    setCurrentView('stock-detail');
  };

  const handleStockDeleted = () => {
    setSelectedStockId(null);
    setCurrentView('stocks');
    setRefreshKey((k) => k + 1);
  };

  const handleBackFromStock = () => {
    setCurrentView('stocks');
    setRefreshKey((k) => k + 1);
  };

  const handleSelectWatchlist = (watchlistId: string) => {
    setSelectedWatchlistId(watchlistId);
    setCurrentView('watchlist-detail');
  };

  const handleBackFromWatchlist = () => {
    setSelectedWatchlistId(null);
    setCurrentView('watchlists');
  };

  const handleOpenResearch = (
    ticker: string,
    stockName?: string,
    finnhubTicker?: string
  ) => {
    setResearchTicker(ticker);
    setResearchStockName(stockName);
    setResearchFinnhubTicker(finnhubTicker);
    setCurrentView('stock-research');
  };

  const handleBackFromResearch = () => {
    // Go back to previous view (watchlist or dashboard)
    if (selectedWatchlistId) {
      setCurrentView('watchlist-detail');
    } else {
      setCurrentView('watchlists');
    }
    setResearchTicker(null);
  };

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    try {
      await refreshAllPrices();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to refresh prices:', err);
    } finally {
      setRefreshingPrices(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  const portfolioColor = selectedPortfolio?.color ?? '#94a3b8';
  const headerTitle = selectedPortfolio
    ? selectedPortfolio.name
    : 'All Portfolios';

  return (
    <div className="app">
      <header
        className="app-header"
        style={
          {
            '--portfolio-color': portfolioColor,
          } as React.CSSProperties
        }
      >
        <div className="portfolio-color-bar" />
        <div className="header-top">
          <div className="header-title">
            <h1>{headerTitle}</h1>
            {selectedPortfolio && (
              <span className="header-subtitle">Portfolio Tracker</span>
            )}
          </div>
          <div className="header-actions">
            <Button
              variant="success"
              onClick={handleRefreshPrices}
              disabled={refreshingPrices}
              title="Refresh all stock prices"
            >
              {refreshingPrices ? 'Refreshing...' : 'Refresh Prices'}
            </Button>
            <PortfolioSelector
              selectedPortfolioId={selectedPortfolioId}
              onPortfolioChange={(id, portfolio) => {
                setSelectedPortfolioId(id);
                setSelectedPortfolio(portfolio);
                setRefreshKey((k) => k + 1);
              }}
              showAllOption={
                currentView === 'dashboard' || currentView === 'stocks'
              }
            />
            <Button variant="secondary" onClick={signOut} title="Sign out">
              Sign Out
            </Button>
          </div>
        </div>
        <nav className="app-nav">
          <button
            className={currentView === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={
              currentView === 'stocks' || currentView === 'stock-detail'
                ? 'active'
                : ''
            }
            onClick={() => setCurrentView('stocks')}
          >
            Stocks
          </button>
          <button
            className={currentView === 'analysis' ? 'active' : ''}
            onClick={() => setCurrentView('analysis')}
          >
            Analysis
          </button>
          <button
            className={currentView === 'news' ? 'active' : ''}
            onClick={() => setCurrentView('news')}
          >
            News
          </button>
          <button
            className={
              currentView === 'watchlists' || currentView === 'watchlist-detail'
                ? 'active'
                : ''
            }
            onClick={() => setCurrentView('watchlists')}
          >
            Watchlists
          </button>
          <button
            className={
              currentView === 'research' || currentView === 'stock-research'
                ? 'active'
                : ''
            }
            onClick={() => setCurrentView('research')}
          >
            Research
          </button>
          <button
            className="add-action"
            onClick={() => setShowAddStockModal(true)}
          >
            + Add Stock
          </button>
          <button
            className="add-action"
            onClick={() => setShowAddTransactionModal(true)}
          >
            + Add Transaction
          </button>
        </nav>
      </header>

      <main className="app-main">
        {currentView === 'dashboard' && (
          <Dashboard
            key={`${refreshKey}-${selectedPortfolioId}`}
            portfolioId={selectedPortfolioId}
            onStockClick={handleStockClick}
          />
        )}
        {currentView === 'stocks' && (
          <StocksList key={refreshKey} onStockClick={handleStockClick} />
        )}
        {currentView === 'analysis' && (
          <Analysis
            key={`analysis-${refreshKey}-${selectedPortfolioId}`}
            portfolioId={selectedPortfolioId}
          />
        )}
        {currentView === 'news' && (
          <News
            key={`news-${refreshKey}-${selectedPortfolioId}`}
            portfolioId={selectedPortfolioId ?? undefined}
          />
        )}
        {currentView === 'watchlists' && (
          <WatchlistManager
            key={`watchlists-${refreshKey}`}
            onSelectWatchlist={handleSelectWatchlist}
          />
        )}
        {currentView === 'research' && (
          <ResearchView key={`research-view-${refreshKey}`} />
        )}
        {currentView === 'watchlist-detail' && selectedWatchlistId && (
          <WatchlistView
            key={`watchlist-${selectedWatchlistId}-${refreshKey}`}
            watchlistId={selectedWatchlistId}
            onBack={handleBackFromWatchlist}
            onOpenResearch={handleOpenResearch}
          />
        )}
        {currentView === 'stock-research' && researchTicker && (
          <StockResearch
            key={`research-${researchTicker}`}
            ticker={researchTicker}
            stockName={researchStockName}
            finnhubTicker={researchFinnhubTicker}
            onBack={handleBackFromResearch}
          />
        )}
        {currentView === 'stock-detail' && selectedStockId && (
          <StockDetail
            stockId={selectedStockId}
            portfolioId={selectedPortfolioId}
            onBack={handleBackFromStock}
            onDeleted={handleStockDeleted}
          />
        )}
      </main>

      {/* Modals */}
      <AddStockModal
        isOpen={showAddStockModal}
        onClose={() => setShowAddStockModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
      <AddTransactionModal
        isOpen={showAddTransactionModal}
        onClose={() => setShowAddTransactionModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        portfolioId={selectedPortfolioId}
      />
    </div>
  );
}

export default App;
