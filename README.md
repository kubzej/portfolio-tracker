# Portfolio Tracker

A comprehensive stock portfolio tracking application with advanced analysis, recommendations, and research capabilities.

![React](https://img.shields.io/badge/React-18.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Vite](https://img.shields.io/badge/Vite-5.0-purple)

## Features

### 📊 Portfolio Management

- **Multi-portfolio support** - Create and manage multiple portfolios
- **Transaction tracking** - Record buy/sell transactions with automatic cost basis calculation
- **Real-time prices** - Live stock prices from Yahoo Finance
- **Currency support** - Handles US and European stocks with proper currency display

### 📈 Analysis & Recommendations

- **Composite scoring** - Weighted combination of 6 analysis categories:
  - Fundamental (P/E, ROE, margins, growth, debt)
  - Technical (RSI, MACD, Bollinger Bands, ADX, Stochastic)
  - Analyst consensus & target prices
  - News sentiment analysis
  - Insider trading activity
  - Portfolio context (position weight, gains)
- **Signal generation** - Automated signals (DIP_OPPORTUNITY, MOMENTUM, CONVICTION_HOLD, etc.)
- **Buy strategy** - DCA recommendations and buy zone identification

### 🔍 Research Tools

- **Stock research** - Analyze any stock without adding to portfolio
- **Peer comparison** - Compare stocks with industry peers
- **Technical charts** - Interactive price charts with indicators
- **News feed** - Latest news with sentiment analysis

### 👁️ Watchlists

- **Multiple watchlists** - Organize stocks you're monitoring
- **Quick add to portfolio** - Easy transition from watchlist to holding

---

## For Users

### Getting Started

1. **Sign up** - Create an account on the login page
2. **Create portfolio** - Set up your first portfolio with a name and optional currency
3. **Add stocks** - Search for stocks by ticker or company name
4. **Record transactions** - Add your buy/sell history for accurate tracking
5. **Analyze** - Use the Analysis tab for recommendations and insights

### Navigation

| Tab            | Description                                        |
| -------------- | -------------------------------------------------- |
| **Dashboard**  | Portfolio overview with total value and allocation |
| **Holdings**   | List of your positions with P&L                    |
| **Analysis**   | Recommendations, scores, and signals               |
| **Research**   | Analyze any stock without owning it                |
| **News**       | Latest market news for your holdings               |
| **Watchlists** | Stocks you're monitoring                           |

### Understanding Scores

- **Composite Score (0-100)** - Overall rating combining all factors
- **Conviction Score (0-100)** - Quality for long-term holding
- **DIP Score (0-100)** - Opportunity to buy at a discount

### Signal Types

| Signal             | Meaning                                  |
| ------------------ | ---------------------------------------- |
| 🟢 DIP_OPPORTUNITY | Stock is oversold with good fundamentals |
| 🟢 MOMENTUM        | Strong positive trend                    |
| 🟢 ACCUMULATE      | Good time to add more (DCA)              |
| 🟡 CONVICTION      | High quality, keep holding               |
| 🟡 HOLD            | Quality stock, no specific action        |
| 🟠 NEAR_TARGET     | Approaching target price                 |
| 🟠 TRIM            | Consider reducing position               |
| 🔴 WATCH           | Needs attention                          |
| ⚪ NEUTRAL         | No strong signal                         |

---

## For Developers

### Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Styling:** Plain CSS (no Tailwind)
- **Charts:** Recharts
- **APIs:** Finnhub (FREE tier), Yahoo Finance (unofficial)

### Project Structure

```
src/
├── components/          # React components
│   ├── Analysis/        # Recommendations, scores, charts
│   ├── Dashboard/       # Portfolio overview
│   ├── StockDetail/     # Individual stock view
│   ├── StocksList/      # Holdings list
│   ├── Research/        # Stock research
│   ├── Watchlists/      # Watchlist management
│   └── shared/          # Reusable UI components
├── services/api/        # API calls to Supabase edge functions
├── utils/               # Utilities (formatting, recommendations)
├── contexts/            # React contexts (Auth)
├── types/               # TypeScript types
└── lib/                 # Supabase client

supabase/
├── functions/           # Edge functions (Deno)
│   ├── fetch-analyst-data/
│   ├── fetch-technical-data/
│   ├── fetch-news/
│   ├── fetch-prices/
│   └── fetch-peers-data/
└── migrations/          # SQL migrations
```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Edge Functions

Edge functions require these secrets (set in Supabase Dashboard):

```
FINNHUB_API_KEY=your_finnhub_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Schema

Key tables:

- `portfolios` - User portfolios (user_id, name, currency)
- `stocks` - Stock master data (ticker, name, finnhub_ticker)
- `holdings` - Portfolio positions (shares, avg_price, target_price)
- `transactions` - Buy/sell history
- `watchlists` - User watchlists
- `signal_log` - Historical signal tracking

All tables have Row Level Security (RLS) enabled for user data isolation.

### API Rate Limits

| API           | Limit        | Notes                    |
| ------------- | ------------ | ------------------------ |
| Finnhub       | 60 calls/min | FREE tier                |
| Yahoo Finance | Unofficial   | Use delays between calls |

### Key Files

| File                            | Purpose            |
| ------------------------------- | ------------------ |
| `src/utils/recommendations.ts`  | Scoring algorithms |
| `src/utils/signals.ts`          | Signal generation  |
| `src/services/api/analysis.ts`  | Analysis API types |
| `src/services/api/technical.ts` | Technical data API |

### Coding Conventions

- **TypeScript:** Strict typing, avoid `any`
- **Components:** Functional with hooks, CSS modules pattern
- **CSS:** Plain CSS with BEM-like naming, CSS variables for colors
- **UI Components:** Use shared components from `@/components/shared`

See [copilot-instructions.md](.github/copilot-instructions.md) for detailed conventions.

### Documentation

- [Recommendations Algorithm](docs/RECOMMENDATIONS_ALGORITHM.md) - Complete scoring documentation

---

## Deployment

The app is configured for **Netlify** deployment:

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"
```

Supabase Edge Functions deploy automatically via Supabase CLI or Dashboard.

---

## License

Private project - not for public distribution.
