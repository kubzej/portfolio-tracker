# Copilot Instructions for Portfolio Tracker

## Project Overview

This is a **Portfolio Tracker** application built with:

- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Styling:** Plain CSS (no Tailwind)
- **APIs:** Finnhub (FREE tier), Yahoo Finance (FREE)

The app tracks stock portfolios with advanced analysis features including recommendations, technical analysis, and research capabilities.

## Project Structure

```
src/
├── components/          # React components
│   ├── Analysis/        # Stock analysis & recommendations
│   ├── Dashboard/       # Portfolio overview
│   ├── StockDetail/     # Individual stock view
│   ├── StocksList/      # Holdings list
│   └── shared/          # Reusable UI components
├── services/api/        # API calls to Supabase edge functions
├── utils/               # Utilities (formatting, recommendations)
├── contexts/            # React contexts (Auth)
├── types/               # TypeScript types
└── lib/                 # Supabase client

supabase/
├── functions/           # Edge functions (Deno)
│   ├── fetch-analyst-data/    # Finnhub + Yahoo analyst data
│   ├── fetch-technical-data/  # Technical indicators from Yahoo
│   ├── fetch-news/            # News with sentiment
│   └── fetch-prices/          # Price refresh
└── migrations/          # SQL migrations
```

## Key Algorithms

### Recommendations System

**Documentation:** See `/docs/RECOMMENDATIONS_ALGORITHM.md` for complete details.

The system generates recommendations by combining 6 score categories:

| Category    | Weight | Source                     |
| ----------- | ------ | -------------------------- |
| Fundamental | 20%    | Finnhub metrics            |
| Technical   | 25%    | Calculated from Yahoo data |
| Analyst     | 15%    | Finnhub recommendations    |
| News        | 10%    | News sentiment             |
| Insider     | 10%    | Finnhub insider data       |
| Portfolio   | 20%    | User's position context    |

**Key files:**

- `src/utils/recommendations.ts` - Main scoring algorithms
- `src/services/api/analysis.ts` - AnalystData types & API
- `src/services/api/technical.ts` - TechnicalData types & API

### Scoring Functions

All scores are 0-100. Main functions:

- `calculateFundamentalScore()` - P/E, ROE, margins, growth, debt
- `calculateTechnicalScore()` - RSI, MACD, Bollinger, ADX, Stochastic
- `calculateAnalystScore()` - Consensus score, analyst count
- `calculateNewsScore()` - Sentiment from articles
- `calculateInsiderScore()` - MSPR with time range filtering
- `calculatePortfolioScore()` - Target upside, position weight, gains
- `calculateConvictionScore()` - Long-term quality metric
- `calculateDipScore()` - Oversold opportunity detection

## Coding Conventions

### TypeScript

- Use strict typing, avoid `any`
- Interfaces over types for objects
- Null checks with optional chaining (`?.`)
- Export types from service files

### React Components

- Functional components with hooks
- CSS modules pattern (ComponentName.css)
- Props interface named `ComponentNameProps`

### CSS

- Plain CSS, no Tailwind
- BEM-like naming: `.component__element--modifier`
- CSS variables for colors in `:root`
- Mobile-first responsive design

### UI Guidelines

- **No emojis in UI** - use text labels and CSS styling instead
- Use color coding for sentiment (green/red/yellow)
- Consistent typography with CSS variables

### Edge Functions (Deno)

- Use `serve()` from std library
- CORS headers on all responses
- Error handling with try/catch
- Rate limiting delays between API calls

## API Keys & Limits

### Finnhub (FREE tier)

- 60 calls/minute limit
- Key in edge function (not exposed to client)
- Endpoints used: recommendation, quote, earnings, metric, peers, profile, insider-sentiment

### Yahoo Finance (FREE, unofficial)

- No strict limit but use delays
- Used for: historical prices, technical calculation, analyst target price
- Non-US stocks always use Yahoo for accurate local currency prices

## Database Schema

Key tables:

- `portfolios` - User portfolios
- `stocks` - Stock master data (ticker, name, finnhub_ticker)
- `holdings` - Portfolio positions (shares, avg_price, target_price)
- `transactions` - Buy/sell history
- `signal_log` - Historical signal tracking

## Common Tasks

### Adding a new technical indicator

1. Add calculation in `fetch-technical-data/index.ts`
2. Add to `TechnicalData` interface
3. Use in `calculateTechnicalScore()` if affects scoring
4. Update `/docs/RECOMMENDATIONS_ALGORITHM.md`

### Adding a new score category

1. Create `calculateXxxScore()` function
2. Add weight to `SCORE_WEIGHTS`
3. Include in `compositeScore` calculation
4. Add to `breakdown` array in result
5. Update documentation

### Modifying signal conditions

1. Edit `generateSignals()` function
2. Update `SignalType` if new signal
3. Add icon and priority
4. Update documentation

## Testing Checklist

When modifying recommendations:

- [ ] Test with stock that has all data
- [ ] Test with stock missing some data (nulls)
- [ ] Test Holdings view (has targetPrice)
- [ ] Test Research view (no targetPrice, uses analystTargetPrice)
- [ ] Verify scores are in 0-100 range
- [ ] Check signals generate correctly

## Important Notes

1. **Holdings vs Research difference:** Holdings has personal `targetPrice` from DB, Research uses `analystTargetPrice` from Yahoo. This affects conviction score by up to 10 points.

2. **Non-US stocks:** Always use Yahoo for prices to get correct local currency. Finnhub may return ADR prices in USD.

3. **Insider time range:** User can select 1-12 months. Data is stored monthly and aggregated client-side.

4. **Signal priority:** Lower number = higher priority. Primary signal is first in sorted array.

5. **DIP quality check:** A DIP is only valid if fundamentals, analyst, and news scores pass minimum thresholds.

## Quick Reference

### Score Thresholds

- High conviction: ≥70
- Medium conviction: 45-69
- DIP trigger: dipScore ≥50 && qualityCheck
- Overbought RSI: >70
- Oversold RSI: <30

### Signal Types

- DIP_OPPORTUNITY
- MOMENTUM
- CONVICTION_HOLD
- NEAR_TARGET
- CONSIDER_TRIM
- WATCH_CLOSELY
- ACCUMULATE
- NEUTRAL
