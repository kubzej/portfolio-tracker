import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import {
  StocksList,
  StockModal,
  TransactionModal,
} from './components/StocksList';
import { OptionTransactionModal } from './components/Options';
import { StockDetail } from './components/StockDetail';
import { StockResearch } from './components/StockResearch';
import { ResearchView } from './components/Research';
import { PortfolioSelector } from './components/PortfolioSelector';
import { Analysis } from './components/Analysis';
import { News } from './components/News';
import { WatchlistManager, WatchlistView } from './components/Watchlists';
import { Tracker } from './components/Tracker';
import { Login } from './components/Login';
import { Onboarding } from './components/Onboarding';
import { DebugShowcase } from './components/Debug';
import { Button } from './components/shared/Button';
import { Title, MetricLabel } from './components/shared/Typography';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { useAuth } from './contexts/AuthContext';
import { refreshAllPrices, portfoliosApi, optionsApi } from './services/api';
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
  | 'watchlist-detail'
  | 'tracker'
  | 'debug';

// Valid views for URL persistence
const VALID_VIEWS: View[] = [
  'dashboard',
  'stocks',
  'analysis',
  'news',
  'research',
  'watchlists',
  'tracker',
  ...(import.meta.env.DEV ? ['debug' as View] : []),
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
  const [showAddOptionModal, setShowAddOptionModal] = useState(false);
  const [editOptionTransaction, setEditOptionTransaction] = useState<
    import('./types').OptionTransaction | null
  >(null);
  const [previousView, setPreviousView] = useState<View>('stocks');

  // Onboarding state
  const [checkingPortfolios, setCheckingPortfolios] = useState(false);
  const [hasPortfolios, setHasPortfolios] = useState(true);

  // Check if user has portfolios (for onboarding)
  // Use user?.id instead of user to prevent re-running when user object reference changes
  useEffect(() => {
    if (user?.id) {
      checkPortfolios();
    } else {
      // No user - no need to check portfolios
      setCheckingPortfolios(false);
    }
  }, [user?.id]);

  const checkPortfolios = async () => {
    try {
      setCheckingPortfolios(true);
      const portfolios = await portfoliosApi.getAll();
      setHasPortfolios(portfolios.length > 0);
    } catch (err) {
      console.error('Failed to check portfolios:', err);
      setHasPortfolios(false);
    } finally {
      setCheckingPortfolios(false);
    }
  };

  const handleOnboardingComplete = (portfolio: Portfolio) => {
    setHasPortfolios(true);
    setSelectedPortfolioId(portfolio.id);
    setSelectedPortfolio(portfolio);
  };

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
    setPreviousView(currentView); // Remember where we came from
    setSelectedStockId(stockId);
    setCurrentView('stock-detail');
  };

  const handleStockDeleted = () => {
    setSelectedStockId(null);
    setCurrentView('stocks');
    setRefreshKey((k) => k + 1);
  };

  const handleBackFromStock = () => {
    setCurrentView(previousView);
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
      // Refresh stock prices and option prices in parallel
      await Promise.all([
        refreshAllPrices(),
        optionsApi.refreshPrices(selectedPortfolioId ?? undefined),
      ]);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to refresh prices:', err);
    } finally {
      setRefreshingPrices(false);
    }
  };

  // Show loading state
  if (loading || checkingPortfolios) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="lg" text="Načítám..." />
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  // Show onboarding if user has no portfolios
  if (!hasPortfolios) {
    return (
      <Onboarding onComplete={handleOnboardingComplete} onSignOut={signOut} />
    );
  }

  const portfolioColor = selectedPortfolio?.color ?? '#94a3b8';
  const headerTitle = selectedPortfolio
    ? selectedPortfolio.name
    : 'Všechna portfolia';

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
            <Title size="xl" as="h1">
              {headerTitle}
            </Title>
            {selectedPortfolio && (
              <div className="header-subtitle">
                <MetricLabel>Portfolio Tracker</MetricLabel>
              </div>
            )}
          </div>
          <div className="header-actions">
            <Button
              variant="success"
              onClick={handleRefreshPrices}
              disabled={refreshingPrices}
              title="Aktualizovat všechny ceny akcií"
            >
              {refreshingPrices ? 'Aktualizuji...' : 'Aktualizovat ceny'}
            </Button>
            <PortfolioSelector
              selectedPortfolioId={selectedPortfolioId}
              onPortfolioChange={(id, portfolio) => {
                setSelectedPortfolioId(id);
                setSelectedPortfolio(portfolio);
                setRefreshKey((k) => k + 1);
              }}
              showAllOption={
                currentView === 'dashboard' ||
                currentView === 'stocks' ||
                currentView === 'stock-detail'
              }
            />
            <Button variant="secondary" onClick={signOut} title="Odhlásit se">
              Odhlásit se
            </Button>
          </div>
        </div>
        <nav className="app-nav">
          <Button
            variant="ghost"
            isActive={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
          >
            Přehled
          </Button>
          <Button
            variant="ghost"
            isActive={
              currentView === 'stocks' || currentView === 'stock-detail'
            }
            onClick={() => setCurrentView('stocks')}
          >
            Akcie
          </Button>
          <Button
            variant="ghost"
            isActive={currentView === 'analysis'}
            onClick={() => setCurrentView('analysis')}
          >
            Analýza portfolia
          </Button>
          <Button
            variant="ghost"
            isActive={currentView === 'news'}
            onClick={() => setCurrentView('news')}
          >
            Zprávy
          </Button>
          <Button
            variant="ghost"
            isActive={
              currentView === 'watchlists' || currentView === 'watchlist-detail'
            }
            onClick={() => setCurrentView('watchlists')}
          >
            Watchlisty
          </Button>
          <Button
            variant="ghost"
            isActive={
              currentView === 'research' || currentView === 'stock-research'
            }
            onClick={() => setCurrentView('research')}
          >
            Vyhledávání
          </Button>
          <Button
            variant="ghost"
            isActive={currentView === 'tracker'}
            onClick={() => setCurrentView('tracker')}
          >
            Tracker
          </Button>
          <Button variant="outline" onClick={() => setShowAddStockModal(true)}>
            + Přidat akcii
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddTransactionModal(true)}
          >
            + Přidat transakci
          </Button>
          <Button variant="outline" onClick={() => setShowAddOptionModal(true)}>
            + Přidat opci
          </Button>
          {import.meta.env.DEV && (
            <Button
              variant="ghost"
              isActive={currentView === 'debug'}
              onClick={() => setCurrentView('debug')}
              className="debug-nav-btn"
            >
              Debug
            </Button>
          )}
        </nav>
      </header>

      <main className="app-main">
        {currentView === 'dashboard' && (
          <Dashboard
            key={`${refreshKey}-${selectedPortfolioId}`}
            portfolioId={selectedPortfolioId}
            onStockClick={handleStockClick}
            onEditOptionTransaction={(tx) => setEditOptionTransaction(tx)}
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
        {currentView === 'tracker' && (
          <Tracker
            key={`tracker-${refreshKey}`}
            onOpenResearch={handleOpenResearch}
          />
        )}
        {currentView === 'debug' && <DebugShowcase />}
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
      <StockModal
        isOpen={showAddStockModal}
        onClose={() => setShowAddStockModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
      <TransactionModal
        isOpen={showAddTransactionModal}
        onClose={() => setShowAddTransactionModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        portfolioId={selectedPortfolioId}
      />
      <OptionTransactionModal
        isOpen={showAddOptionModal}
        onClose={() => setShowAddOptionModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        portfolioId={selectedPortfolioId}
        mode="open"
      />
      <OptionTransactionModal
        isOpen={!!editOptionTransaction}
        onClose={() => setEditOptionTransaction(null)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
        transaction={editOptionTransaction}
        mode="edit"
      />
    </div>
  );
}

export default App;
