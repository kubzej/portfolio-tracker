import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { StockForm } from './components/StockForm';
import { TransactionForm } from './components/TransactionForm';
import { StocksList } from './components/StocksList';
import { StockDetail } from './components/StockDetail';
import { PortfolioSelector } from './components/PortfolioSelector';
import './App.css';

type View =
  | 'dashboard'
  | 'stocks'
  | 'stock-detail'
  | 'add-stock'
  | 'add-transaction';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <h1>Portfolio Tracker</h1>
          <PortfolioSelector
            selectedPortfolioId={selectedPortfolioId}
            onPortfolioChange={(id) => {
              setSelectedPortfolioId(id);
              setRefreshKey((k) => k + 1);
            }}
            showAllOption={
              currentView === 'dashboard' || currentView === 'stocks'
            }
          />
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
            className={currentView === 'add-stock' ? 'active' : ''}
            onClick={() => setCurrentView('add-stock')}
          >
            + Stock
          </button>
          <button
            className={currentView === 'add-transaction' ? 'active' : ''}
            onClick={() => setCurrentView('add-transaction')}
          >
            + Transaction
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
