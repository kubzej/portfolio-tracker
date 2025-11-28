import { useState } from 'react';
import { Button } from '@/components/shared';
import './QuickResearch.css';

interface QuickResearchProps {
  onOpenResearch: (ticker: string) => void;
}

export function QuickResearch({ onOpenResearch }: QuickResearchProps) {
  const [ticker, setTicker] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTicker = ticker.trim().toUpperCase();
    if (trimmedTicker) {
      onOpenResearch(trimmedTicker);
      setTicker('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="quick-research">
      <div className="quick-research-header">
        <span className="quick-research-icon">Q</span>
        <h3>Quick Research</h3>
        <span className="quick-research-desc">
          Enter any ticker to get detailed analysis
        </span>
      </div>
      <form className="quick-research-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="quick-research-input"
          placeholder="Enter ticker symbol (e.g., AAPL, MSFT)"
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
  );
}
