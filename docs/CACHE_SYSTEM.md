# Finnhub API Cache System

## Přehled

Cache systém snižuje počet API volání na Finnhub a Alpha Vantage, které mají omezené rate limity:

| API                    | Limit           | Poznámka                   |
| ---------------------- | --------------- | -------------------------- |
| **Finnhub FREE**       | 60 volání/min   | Hlavní zdroj dat           |
| **Alpha Vantage FREE** | 25 volání/den   | Pouze company descriptions |
| **Yahoo Finance**      | Neomezené       | Ceny, technická data       |
| **Polygon.io**         | Závisí na plánu | News sentiment             |

## Architektura

### Tabulka `finnhub_cache`

```sql
CREATE TABLE finnhub_cache (
  ticker VARCHAR(20) NOT NULL,
  data_type VARCHAR(30) NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (ticker, data_type)
);
```

### Data Types a TTL

| data_type        | TTL    | Zdroj         | Popis                                   |
| ---------------- | ------ | ------------- | --------------------------------------- |
| `recommendation` | 24h    | Finnhub       | Analyst recommendations (buy/hold/sell) |
| `metrics`        | 24h    | Finnhub       | Fundamental metrics (P/E, ROE, margins) |
| `earnings`       | 24h    | Finnhub       | Earnings surprises (last 4 quarters)    |
| `insider`        | 24h    | Finnhub       | Insider sentiment (MSPR)                |
| `profile`        | 30 dní | Finnhub       | Company profile (industry)              |
| `peers`          | 30 dní | Finnhub       | Company peers list                      |
| `description`    | 90 dní | Alpha Vantage | Company description text                |
| `news`           | 2h     | Finnhub       | News articles per ticker                |

### Co se NEKEŠUJE

- **Quote (cena)** - real-time data, vždy čerstvé z Finnhub/Yahoo
- **Technical data** - počítá se z Yahoo historical data
- **Prices** - vždy aktuální z Yahoo Finance

## Edge Functions

### fetch-analyst-data

Hlavní funkce pro analyst data. Volá 7 Finnhub endpointů per ticker.

**Bez cache:** 11 tickers × 7 endpoints = 77 Finnhub volání  
**S cache:** 11 tickers × 1 endpoint (quote) = 11 Finnhub volání

```typescript
// Parametry
{
  portfolioId?: string,      // Portfolio ID
  ticker?: string,           // Jednotlivý ticker
  forceRefresh?: boolean,    // Vynutit čerstvá data (smaže cache)
  refreshTickers?: string[], // Smazat cache jen pro tyto tickery
}
```

### fetch-news

News pro portfolio nebo jednotlivý ticker.

**Bez cache:** 11 tickers = 11 Finnhub volání  
**S cache:** 0 Finnhub volání (do 2h)

```typescript
// Parametry
{
  portfolioId?: string,
  ticker?: string,
  forceRefresh?: boolean,
  includeBasicSentiment?: boolean,
}

// Response obsahuje fetchedTickers
{
  articles: [...],
  byTicker: [...],
  fetchedTickers: ['AAPL', 'MSFT', ...], // Tickery kde fetch proběhl úspěšně
}
```

**Důležité:** Cache se ukládá i pro tickery bez článků (úspěšný fetch, ale 0 news).
To rozlišuje mezi "ticker nemá novinky" vs "rate limit zabránil fetchi".

### Validita dat ve frontendu

`Analysis.tsx` používá `fetchedTickers` pro určení validity:

```typescript
// Ticker je valid pouze pokud:
// 1. Má cenu (hasPrice)
// 2. Má analyst data (hasAnalyst)
// 3. Má fundamentals (hasFundamentals)
// 4. Má technical data (hasTech)
// 5. News fetch proběhl (newsWasFetched) - i když 0 článků

const newsWasFetched = newsFetchedTickers.has(stock.ticker);
const isValid =
  hasPrice && hasAnalyst && hasFundamentals && hasTech && newsWasFetched;
```

Pokud byl ticker rate limited u news, není v `fetchedTickers` a stock se nezobrazí v recommendations.

## Správa Cache

### SQL Funkce

```sql
-- Smazat veškerou cache
SELECT clear_all_finnhub_cache();

-- Smazat cache pro konkrétní ticker
SELECT clear_finnhub_cache_for_ticker('AAPL');

-- Vyčistit expirovanou cache
SELECT cleanup_expired_finnhub_cache();

-- Zobrazit obsah cache
SELECT ticker, data_type, fetched_at, expires_at
FROM finnhub_cache
ORDER BY ticker, data_type;

-- Statistiky cache
SELECT
  data_type,
  COUNT(*) as count,
  MIN(fetched_at) as oldest,
  MAX(fetched_at) as newest
FROM finnhub_cache
GROUP BY data_type;
```

### Force Refresh z Frontendu

```typescript
// Refresh všech dat
await fetchAnalystData(portfolioId, { forceRefresh: true });

// Refresh jen pro konkrétní tickery
await fetchAnalystData(portfolioId, {
  forceRefresh: true,
  refreshTickers: ['AAPL', 'MSFT'],
});
```

## Optimalizace Rate Limitů

### Sekvenční zpracování

Místo paralelních volání (`Promise.all`) se data fetchují sekvenčně s delay:

```typescript
// fetch-analyst-data
const API_CALL_DELAY_MS = 150; // Mezi API voláními
const TICKER_DELAY_MS = 300; // Mezi tickery

// fetch-news
const TICKER_DELAY_MS = 500; // Delší delay pro news
```

### Retry s Exponential Backoff

Při 429 (rate limited) se automaticky opakuje s rostoucím delay:

```typescript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url);
    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await delay(waitTime);
      continue;
    }
    return response;
  }
  return null;
}
```

### Pořadí volání ve Frontendu

V `Analysis.tsx` se data načítají v optimálním pořadí:

```typescript
// 1. Paralelně: analyst data, holdings, technical (Yahoo)
const [analysisResult, holdings, technicalResult] = await Promise.all([
  fetchAnalystData(portfolioId),
  holdingsApi.getPortfolioSummary(portfolioId),
  fetchTechnicalData(portfolioId),
]);

// 2. Sekvenčně po analyst data: news
const newsResult = await fetchPortfolioNews(portfolioId);
```

## Monitoring

### Logy Edge Functions

V Supabase Dashboard → Edge Functions → Logs hledej:

```
[CACHE HIT] AAPL recommendation    # Data z cache
[API] AAPL fetching recommendation # Volání API
[CACHE SET] AAPL recommendation    # Uložení do cache
[NEWS CACHE HIT] AAPL              # News z cache
```

### Rate Limit Tracking

Response obsahuje info o rate limitech:

```json
{
  "data": [...],
  "rateLimited": {
    "finnhub": false,
    "yahoo": false,
    "alpha": true
  }
}
```

## Troubleshooting

### Cache nefunguje

1. Zkontroluj jestli existuje tabulka:

   ```sql
   SELECT * FROM finnhub_cache LIMIT 5;
   ```

2. Zkontroluj RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'finnhub_cache';
   ```

### Pořád dostávám rate limit

1. Zkontroluj počet tickerů v portfoliu
2. Vyčkej 1 minutu (Finnhub limit je per minute)
3. Ověř že cache se plní (viz logy)

### Data jsou stará

1. Zkontroluj `expires_at` v cache
2. Použij `forceRefresh: true`
3. Nebo smaž cache: `SELECT clear_all_finnhub_cache();`

## Budoucí vylepšení

- [ ] Cron job pro `cleanup_expired_finnhub_cache()` (denně)
- [ ] Cache warming při startu aplikace
- [ ] Metrics dashboard pro cache hit rate
- [ ] Webhook pro invalidaci cache při změnách
