import { useState } from 'react';
import { Button, Input } from '@/components/shared';
import { CardTitle, Caption } from '@/components/shared/Typography';
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
        <CardTitle>Quick Research</CardTitle>
        <Caption>Enter any ticker to get detailed analysis</Caption>
      </div>
      <form className="quick-research-form" onSubmit={handleSubmit}>
        <Input
          type="text"
          placeholder="Enter ticker symbol (e.g., AAPL, MSFT)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          maxLength={10}
          fullWidth
        />
        <Button type="submit" variant="primary" disabled={!ticker.trim()}>
          Analyze
        </Button>
      </form>
    </div>
  );
}
