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

**Documentation:** See `/docs/SIGNALS_SYSTEM.md` for complete details.

The system generates recommendations by combining 6 score categories (v3.2):

**Holdings view:**
| Category | Weight | Source |
| ----------- | ------ | -------------------------- |
| Fundamental | 30% | Finnhub metrics |
| Technical | 26% | Calculated from Yahoo data |
| Analyst | 10% | Finnhub recommendations (reduced - lagging indicator) |
| News+Insider| 14% | News sentiment + Finnhub insider data |
| Portfolio | 20% | User's position context |

**Research view (no portfolio):**
| Category | Weight |
| ----------- | ------ |
| Fundamental | 38% |
| Technical | 32% |
| Analyst | 12% |
| News+Insider| 18% |

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

### UI Components (MANDATORY)

**When writing new UI or refactoring existing UI, ALWAYS use our shared components first.**

**DO NOT use raw HTML elements:**

- ❌ `<span>`, `<p>`, `<h1-h6>`, `<label>` → Use Typography components
- ❌ `<button>` → Use `Button` component
- ❌ `<input>` → Use `Input` component
- ❌ `<select>` → Use custom Select/Dropdown component or `ToggleGroup`
- ❌ `<table>` → Use our table patterns with proper styling

**Exception:** Raw elements are OK for:

- Layout wrappers (`<div>`, `<section>`)
- Non-text visual elements (color dots, icons)
- Complex custom components where shared components don't fit

**Always check `@/components/shared` first before creating new UI elements.**

### Typography System (MANDATORY)

**All text elements MUST use Typography components from `@/components/shared/Typography`.**

#### Available Components:

| Component      | Use Case                                   |
| -------------- | ------------------------------------------ |
| `Text`         | Generic text with size/weight/color props  |
| `Label`        | Form labels (supports `htmlFor`)           |
| `Title`        | Headings with size variants                |
| `PageTitle`    | Main page heading                          |
| `SectionTitle` | Section headings                           |
| `CardTitle`    | Card/panel headings                        |
| `Ticker`       | Stock ticker (auto UPPERCASE)              |
| `StockName`    | Company name (supports truncate)           |
| `MetricLabel`  | Metric labels (auto UPPERCASE)             |
| `MetricValue`  | Numeric values with sentiment              |
| `Badge`        | Status badges (buy/sell/hold/info/warning) |
| `Tag`          | Peer tags, keywords                        |
| `Count`        | Notification counts                        |
| `Description`  | Explanatory paragraphs                     |
| `Hint`         | Helper text for forms                      |
| `Caption`      | Small descriptive text                     |
| `Muted`        | N/A, empty states                          |
| `Subtext`      | Secondary info (e.g., "/ 20")              |
| `RecItem`      | Buy/Hold/Sell recommendation counts        |
| `SortIcon`     | Sort direction indicator                   |

#### Form Components:

| Component | Use Case                         |
| --------- | -------------------------------- |
| `Button`  | All buttons (variant/size props) |
| `Input`   | All inputs (inputSize/fullWidth) |

#### Rules:

1. **NO raw `<span>`, `<p>`, `<h1-h6>`, `<label>` for text** - always use Typography
2. **NO className on Typography components** - use props only
3. **NO custom text styles in component CSS** - Typography handles all text styling
4. **Clean up CSS** after converting to Typography - remove orphaned selectors
5. **Check responsive styles** - Typography handles mobile adjustments

**Exception:** `<span>` or `<div>` is OK for non-text visual elements (color dots, icons, layout wrappers).

#### Refactoring Checklist:

When editing any component:

- [ ] Replace all `<span>` text with appropriate Typography component
- [ ] Replace all `<p>` with `Description`, `Text`, or `Hint`
- [ ] Replace all `<h1-h6>` with `PageTitle`, `SectionTitle`, `CardTitle`, or `Title`
- [ ] Replace all `<label>` with `Label` (use `htmlFor` prop for form labels)
- [ ] Replace raw `<input>` with `Input` component
- [ ] Replace raw `<button>` with `Button` component
- [ ] Remove orphaned CSS selectors (h1, p, span, label styles)
- [ ] Remove text-related media queries (Typography handles responsive)
- [ ] Verify consistent styling between desktop and mobile

#### Debug Screen:

Access `#debug` route on localhost to see all Typography and Form components.

### UI Guidelines

- **No emojis in UI** - use text labels and CSS styling instead
- **Language:** UI labels and text in English, only tooltips (InfoTooltip) in Czech
- Use color coding for sentiment (green/red/yellow)
- Consistent typography with CSS variables

### Edge Functions (Deno)

- Use `serve()` from std library
- CORS headers on all responses
- Error handling with try/catch
- Rate limiting delays between API calls

## Testing (MANDATORY)

### Test Framework

- **Vitest** for unit tests
- **React Testing Library** for component tests
- Test files: `*.test.ts` or `*.test.tsx` next to source files

### Testing Rules

1. **When creating new code:**

   - Create tests for all new API services (`services/api/*.ts`)
   - Create tests for utility functions (`utils/*.ts`)
   - Create tests for hooks (`hooks/*.ts`)
   - Create tests for shared components (`components/shared/**/*.tsx`)

2. **When modifying existing code:**

   - Update existing tests to match new behavior
   - Add tests for new functionality
   - Run `npm test` before committing

3. **Test file naming:**
   - Place test file next to source: `myFile.ts` → `myFile.test.ts`
   - Component tests: `MyComponent.tsx` → `MyComponent.test.tsx`

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('moduleName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('functionName', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Mocking Patterns

**Supabase mock (for API services):**

```typescript
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  // ... chain methods
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));
```

**Component render (with providers):**

```typescript
import { render } from '@/test/test-utils';

render(<MyComponent prop="value" />);
```

### What to Test

| Type         | What to test                                      |
| ------------ | ------------------------------------------------- |
| API Services | CRUD operations, error handling, query parameters |
| Utils        | Pure functions, edge cases, null handling         |
| Hooks        | State changes, side effects, return values        |
| Components   | Rendering, user interactions, props handling      |

### Running Tests

```bash
npm test          # Run all tests
npm test -- --watch  # Watch mode
npm test -- myFile   # Run specific file
```

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
- BREAKOUT
- REVERSAL
- ACCUMULATE
- GOOD_ENTRY
- WAIT_FOR_DIP
- NEAR_TARGET
- TAKE_PROFIT
- TRIM
- WATCH
- HOLD
- CONVICTION
- QUALITY_CORE
- FUNDAMENTALLY_WEAK
- TECHNICALLY_WEAK
- PROBLEMATIC
- NEUTRAL
