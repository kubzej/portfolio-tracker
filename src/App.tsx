import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { StockForm } from './components/StockForm';
import { TransactionForm } from './components/TransactionForm';
import { StocksList } from './components/StocksList';
import { StockDetail } from './components/StockDetail';
import { PortfolioSelector } from './components/PortfolioSelector';
import { Analysis } from './components/Analysis';
import { News } from './components/News';
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
  | 'analysis'
  | 'news'
  | 'add-stock'
  | 'add-transaction';

// Valid views for URL persistence
const VALID_VIEWS: View[] = ['dashboard', 'stocks', 'analysis', 'news'];

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
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    null
  );
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

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

  const handleSuccess = () => {
    setCurrentView('dashboard');
    setRefreshKey((k) => k + 1);
  };

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
            className={`add-action ${
              currentView === 'add-stock' ? 'active' : ''
            }`}
            onClick={() => setCurrentView('add-stock')}
          >
            + Add Stock
          </button>
          <button
            className={`add-action ${
              currentView === 'add-transaction' ? 'active' : ''
            }`}
            onClick={() => setCurrentView('add-transaction')}
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
          <StocksList
            key={refreshKey}
            onStockClick={handleStockClick}
            onAddStock={() => setCurrentView('add-stock')}
          />
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
        {currentView === 'stock-detail' && selectedStockId && (
          <StockDetail
            stockId={selectedStockId}
            portfolioId={selectedPortfolioId}
            onBack={handleBackFromStock}
            onDeleted={handleStockDeleted}
          />
        )}
        {currentView === 'add-stock' && (
          <StockForm
            onSuccess={handleSuccess}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}
        {currentView === 'add-transaction' && (
          <TransactionForm
            portfolioId={selectedPortfolioId}
            onSuccess={handleSuccess}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
