import { useState } from 'react';
import { StockResearch } from '@/components/StockResearch';
import { Button } from '@/components/shared';
import './ResearchView.css';

export function ResearchView() {
  const [ticker, setTicker] = useState('');
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTicker = ticker.trim().toUpperCase();
    if (trimmedTicker) {
      setActiveTicker(trimmedTicker);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="research-view">
      {/* Quick Research Input */}
      <div className="research-search-section">
        <h2>Stock Research</h2>
        <p className="research-subtitle">
          Enter any ticker symbol to get comprehensive analysis
        </p>
        <form className="research-search-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="research-search-input"
            placeholder="AAPL, MSFT, GOOGL..."
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            maxLength={10}
          />
          <Button type="submit" variant="primary" disabled={!ticker.trim()}>
            Analyze
          </Button>
        </form>
      </div>

      {/* Research Results */}
      {activeTicker && (
        <div className="research-results">
          <StockResearch
            key={activeTicker}
            ticker={activeTicker}
            onBack={() => setActiveTicker(null)}
          />
        </div>
      )}
    </div>
  );
}
