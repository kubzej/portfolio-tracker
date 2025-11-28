# Recommendations & Research Algorithm Documentation

> **Verze:** 1.0  
> **Poslední aktualizace:** 28. listopadu 2025  
> **Source of Truth** pro scoring a recommendation algoritmy v Portfolio Tracker

---

## Obsah

1. [Přehled systému](#1-přehled-systému)
2. [Datové zdroje](#2-datové-zdroje)
3. [Scoring systém](#3-scoring-systém)
4. [Composite Score](#4-composite-score)
5. [Conviction Score](#5-conviction-score)
6. [DIP Score](#6-dip-score)
7. [Signal Generation](#7-signal-generation)
8. [Buy Strategy](#8-buy-strategy)
9. [Rozdíly Holdings vs Research](#9-rozdíly-holdings-vs-research)
10. [API Reference](#10-api-reference)

---

## 1. Přehled systému

Systém generuje **kontextuální doporučení** pro akcie v portfoliu kombinací:

- **Fundamentální analýzy** (valuace, profitabilita, růst, finanční zdraví)
- **Technické analýzy** (RSI, MACD, Bollinger, ADX, Stochastic, Fibonacci)
- **Sentiment analytiků** (consensus score, target price)
- **Sentiment zpráv** (NLP analýza článků)
- **Insider aktivita** (MSPR, čisté nákupy/prodeje)
- **Kontext portfolia** (váha, průměrná cena, nerealizovaný zisk)

### Výstupy systému

| Výstup            | Popis                                    | Rozsah |
| ----------------- | ---------------------------------------- | ------ |
| `compositeScore`  | Vážený průměr všech kategorií            | 0-100  |
| `convictionScore` | Kvalita pro dlouhodobé držení            | 0-100  |
| `dipScore`        | Příležitost k nákupu (oversold)          | 0-100  |
| `signals`         | Generované signály (DIP, MOMENTUM, etc.) | Array  |
| `buyStrategy`     | Doporučení pro DCA a buy zone            | Object |

---

## 2. Datové zdroje

### 2.1 Finnhub API (FREE tier)

**Edge function:** `fetch-analyst-data`

| Endpoint                   | Data                            | Poznámka |
| -------------------------- | ------------------------------- | -------- |
| `/stock/recommendation`    | Analyst ratings (buy/hold/sell) | FREE     |
| `/quote`                   | Current price, změna            | FREE     |
| `/stock/earnings`          | Earnings surprises (4Q)         | FREE     |
| `/stock/metric`            | Fundamental metrics             | FREE     |
| `/stock/peers`             | Podobné společnosti             | FREE     |
| `/stock/profile2`          | Industry, sektor                | FREE     |
| `/stock/insider-sentiment` | MSPR, insider aktivita          | FREE     |

### 2.2 Yahoo Finance API (FREE)

**Edge function:** `fetch-analyst-data` + `fetch-technical-data`

| Endpoint                     | Data                       |
| ---------------------------- | -------------------------- |
| `/v8/finance/chart/{ticker}` | Historické ceny (1Y daily) |
| `/v10/finance/quoteSummary`  | Analyst target price       |

**Poznámka:** Pro non-US akcie (s příponou .DE, .L, etc.) se vždy používá Yahoo Finance pro ceny.

### 2.3 Technická data (kalkulovaná)

**Edge function:** `fetch-technical-data`

| Indikátor       | Perioda   | Popis                                |
| --------------- | --------- | ------------------------------------ |
| SMA             | 50, 200   | Simple Moving Average                |
| RSI             | 14        | Relative Strength Index              |
| MACD            | 12, 26, 9 | MACD Line, Signal, Histogram         |
| Bollinger Bands | 20, 2σ    | Upper, Middle, Lower                 |
| Stochastic      | 14, 3, 3  | %K a %D                              |
| ATR             | 14        | Average True Range                   |
| OBV             | -         | On-Balance Volume                    |
| ADX             | 14        | Average Directional Index (+DI, -DI) |
| Fibonacci       | 50 days   | Retracement levels                   |

### 2.4 News Sentiment

**Edge function:** `fetch-news`

- Sentiment score: -1 (negative) až +1 (positive)
- Zpracování přes NLP
- Filtrování podle tickeru a related tickers

---

## 3. Scoring systém

### 3.1 Fundamental Score (0-100 bodů)

```
┌────────────────────────────────────────────────────────┐
│ FUNDAMENTAL SCORE                                      │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ P/E Ratio        │ 20           │ <12: 20, <20: 15,    │
│                  │              │ <30: 10, <50: 5      │
├──────────────────┼──────────────┼──────────────────────┤
│ ROE              │ 20           │ >25%: 20, >18%: 16,  │
│                  │              │ >12%: 12, >5%: 6     │
├──────────────────┼──────────────┼──────────────────────┤
│ Net Margin       │ 20           │ >25%: 20, >15%: 15,  │
│                  │              │ >8%: 10, >0%: 5      │
├──────────────────┼──────────────┼──────────────────────┤
│ Revenue Growth   │ 20           │ >25%: 20, >15%: 15,  │
│                  │              │ >5%: 10, >0%: 5      │
├──────────────────┼──────────────┼──────────────────────┤
│ Debt/Equity      │ 20           │ <0.3: 20, <0.7: 16,  │
│                  │              │ <1.5: 10, <2.5: 4    │
└──────────────────┴──────────────┴──────────────────────┘
```

### 3.2 Technical Score (0-100 bodů)

```
┌────────────────────────────────────────────────────────┐
│ TECHNICAL SCORE                                        │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ RSI (14)         │ 25           │ <30: 25 (oversold)   │
│                  │              │ <45: 18, >70: 5      │
│                  │              │ >60: 12, else: 15    │
├──────────────────┼──────────────┼──────────────────────┤
│ MACD             │ 20           │ Bullish+strength: 20 │
│                  │              │ Bullish: 15          │
│                  │              │ Bearish+weak: 5      │
├──────────────────┼──────────────┼──────────────────────┤
│ Bollinger Bands  │ 20           │ Below lower: 20      │
│                  │              │ Lower zone: 15       │
│                  │              │ Above upper: 5       │
├──────────────────┼──────────────┼──────────────────────┤
│ ADX              │ 15           │ Strong uptrend: 15   │
│                  │              │ Strong downtrend: 5  │
│                  │              │ Weak trend: 8        │
├──────────────────┼──────────────┼──────────────────────┤
│ Stochastic       │ 20           │ <20: 20 (oversold)   │
│                  │              │ <30: 15, >80: 5      │
│                  │              │ >70: 10, else: 12    │
└──────────────────┴──────────────┴──────────────────────┘
```

**Technical Bias:** Určuje se podle počtu bullish vs bearish signálů.

### 3.3 Analyst Score (0-100 bodů)

```
┌────────────────────────────────────────────────────────┐
│ ANALYST SCORE                                          │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ Consensus Score  │ 70           │ Scale: -2 to +2      │
│ (vážený průměr)  │              │ >1.5: 70 (Strong Buy)│
│                  │              │ >1.0: 58 (Buy)       │
│                  │              │ >0.5: 48 (Mod Buy)   │
│                  │              │ >0.0: 38 (Weak Buy)  │
│                  │              │ >-0.5: 28 (Hold)     │
│                  │              │ >-1.0: 14 (Underp)   │
│                  │              │ else: 0 (Sell)       │
├──────────────────┼──────────────┼──────────────────────┤
│ Analyst Coverage │ 30           │ ≥20: 30 (high)       │
│                  │              │ ≥10: 24 (good)       │
│                  │              │ ≥5: 16 (moderate)    │
│                  │              │ ≥1: 8 (low)          │
└──────────────────┴──────────────┴──────────────────────┘
```

**Consensus Score výpočet:**

```typescript
consensusScore =
  (strongBuy * 2 + buy * 1 + hold * 0 + sell * -1 + strongSell * -2) /
  totalAnalysts;
```

### 3.4 News Score (0-100 bodů)

```
┌────────────────────────────────────────────────────────┐
│ NEWS SCORE                                             │
├────────────────────────────────────────────────────────┤
│ Výchozí hodnota: 50 (neutral)                          │
│                                                        │
│ Výpočet:                                               │
│ 1. Filtrovat články pro daný ticker                    │
│ 2. Průměrný sentiment: -1 až +1                        │
│ 3. Konverze na 0-100: (avgSentiment + 1) * 50          │
│                                                        │
│ Sentiment thresholds:                                  │
│ - Bullish: avgSentiment > 0.15                         │
│ - Bearish: avgSentiment < -0.15                        │
│ - Neutral: -0.15 až +0.15                              │
└────────────────────────────────────────────────────────┘
```

### 3.5 Insider Score (0-100 bodů)

```
┌────────────────────────────────────────────────────────┐
│ INSIDER SCORE                                          │
├────────────────────────────────────────────────────────┤
│ Výchozí hodnota: 50 (neutral)                          │
│                                                        │
│ MSPR (Monthly Share Purchase Ratio):                   │
│ - Rozsah: -100 (selling) až +100 (buying)              │
│ - Konverze: score = 50 + (MSPR / 2)                    │
│                                                        │
│ Interpretace:                                          │
│ - MSPR > 50: Very strong buying                        │
│ - MSPR > 25: Strong buying                             │
│ - MSPR > 0: Moderate buying                            │
│ - MSPR > -25: Moderate selling                         │
│ - MSPR > -50: Strong selling                           │
│ - else: Very strong selling                            │
│                                                        │
│ Time Range filtering:                                  │
│ - Uživatel volí: 1, 2, 3, 6, nebo 12 měsíců            │
│ - Data agregována za zvolené období                    │
└────────────────────────────────────────────────────────┘
```

### 3.6 Portfolio Score (0-100 bodů)

⚠️ **Důležité:** Tato kategorie závisí na kontextu portfolia!

```
┌────────────────────────────────────────────────────────┐
│ PORTFOLIO SCORE                                        │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ Target Upside    │ 30           │ >40%: 30 (high pot)  │
│ (personal target)│              │ >25%: 25 (good)      │
│                  │              │ >15%: 20 (moderate)  │
│                  │              │ >5%: 12 (limited)    │
│                  │              │ >-5%: 6 (near tgt)   │
│                  │              │ else: 0 (above tgt)  │
├──────────────────┼──────────────┼──────────────────────┤
│ Distance from    │ 25           │ <-20%: 25 (DCA opp)  │
│ Avg Buy Price    │              │ <-10%: 20            │
│                  │              │ <0%: 15              │
│                  │              │ <20%: 12             │
│                  │              │ <50%: 8              │
│                  │              │ else: 4 (profits)    │
├──────────────────┼──────────────┼──────────────────────┤
│ Position Weight  │ 20           │ >15%: 4 (overweight) │
│                  │              │ >8%: 12 (sl. overw)  │
│                  │              │ ≥2%: 20 (balanced)   │
│                  │              │ else: 16 (small)     │
├──────────────────┼──────────────┼──────────────────────┤
│ Unrealized Gain  │ 25           │ >100%: 15            │
│                  │              │ >50%: 18             │
│                  │              │ >20%: 22             │
│                  │              │ >0%: 25 (in profit)  │
│                  │              │ >-10%: 20            │
│                  │              │ >-25%: 15            │
│                  │              │ else: 8 (big loss)   │
└──────────────────┴──────────────┴──────────────────────┘
```

---

## 4. Composite Score

**Vážený průměr všech kategorií:**

```typescript
const SCORE_WEIGHTS = {
  fundamental: 0.2, // 20%
  technical: 0.25, // 25%
  analyst: 0.15, // 15%
  news: 0.1, // 10%
  insider: 0.1, // 10%
  portfolio: 0.2, // 20%
};

compositeScore =
  fundamentalScore * 0.2 +
  technicalScore * 0.25 +
  analystScore * 0.15 +
  newsScore * 0.1 +
  insiderScore * 0.1 +
  portfolioScore * 0.2;
```

### Interpretace Composite Score

| Score  | Interpretace                             |
| ------ | ---------------------------------------- |
| 80-100 | Výborný - silný kandidát na nákup/držení |
| 60-79  | Dobrý - solidní pozice                   |
| 40-59  | Průměrný - vyžaduje pozornost            |
| 20-39  | Slabý - zvážit exit                      |
| 0-19   | Velmi slabý - pravděpodobně prodat       |

---

## 5. Conviction Score

**Měří dlouhodobou kvalitu pro držení.**

```
┌──────────────────────────────────────────────────────────┐
│ CONVICTION SCORE (0-100)                                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ === FUNDAMENTAL STABILITY (max 40 bodů) ===              │
│                                                          │
│ High ROE (0-12):                                         │
│   > 20%: 12 | > 15%: 9 | > 10%: 5                        │
│                                                          │
│ Consistent Growth (0-10):                                │
│   5Y Revenue CAGR > 15%: 10 | > 10%: 7 | > 5%: 4         │
│                                                          │
│ Strong Margins (0-10):                                   │
│   Net Margin > 20%: 10 | > 12%: 7 | > 5%: 3              │
│                                                          │
│ Low Debt (0-8):                                          │
│   D/E < 0.5: 8 | < 1.0: 5 | < 2.0: 2                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ === MARKET POSITION (max 30 bodů) ===                    │
│                                                          │
│ Analyst Consensus (0-12):                                │
│   consensusScore > 0.5: min(12, score * 6)               │
│                                                          │
│ Target Price Upside (0-10): ⚠️ KLÍČOVÉ                   │
│   Priority chain:                                        │
│   1. Personal target (holdings) - item.targetPrice       │
│   2. Analyst target (Yahoo) - item.analystTargetPrice    │
│   3. Estimated from consensus (fallback)                 │
│                                                          │
│   > 25% upside: 10 | > 15%: 7 | > 5%: 3                  │
│                                                          │
│ Earnings Consistency (0-8):                              │
│   4/4 beats: 8 | 3/4: 6 | 2/4: 3                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ === MOMENTUM & SENTIMENT (max 30 bodů) ===               │
│                                                          │
│ Insider Buying (0-12):                                   │
│   insiderScore > 65%: 12 | > 55%: 8 | > 45%: 4           │
│                                                          │
│ Price above SMA200 (0-10):                               │
│   price > sma200: 10 | > sma200 * 0.95: 5                │
│                                                          │
│ Recent Momentum (0-8):                                   │
│   RSI 50-70: 8 (healthy) | RSI 40-60: 5                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Conviction Levels

| Score | Level  | Význam                             |
| ----- | ------ | ---------------------------------- |
| ≥70   | HIGH   | Silné fundamenty, držet dlouhodobě |
| 45-69 | MEDIUM | Solidní, ale sledovat              |
| <45   | LOW    | Slabá conviction                   |

---

## 6. DIP Score

**Identifikuje oversold podmínky = příležitost k nákupu.**

```
┌──────────────────────────────────────────────────────────┐
│ DIP SCORE (0-100)                                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ RSI Based (0-25):                                        │
│   RSI < 25: 25 (deeply oversold)                         │
│   RSI < 30: 20 (oversold)                                │
│   RSI < 40: 10 (approaching)                             │
│                                                          │
│ Bollinger Position (0-20):                               │
│   price < lower band: 20                                 │
│   price near lower: 12                                   │
│                                                          │
│ SMA Position (0-20):                                     │
│   price < sma200 * 0.9: 15 (>10% below)                  │
│   price < sma200: 10                                     │
│   price < sma50 * 0.95: 5                                │
│                                                          │
│ 52-Week Position (0-15):                                 │
│   >30% below 52W high: 15                                │
│   >20% below: 10                                         │
│   >10% below: 5                                          │
│                                                          │
│ Stochastic (0-10):                                       │
│   %K < 20: 10 | < 30: 5                                  │
│                                                          │
│ Distance from Avg (0-10):                                │
│   >15% below avg: 10                                     │
│   >5% below: 5                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### DIP Quality Check

**DIP musí projít quality check!** Jinak může být "value trap".

```typescript
function checkDipQuality(fundamentalScore, analystScore, newsScore) {
  let passes = true;

  if (fundamentalScore < 35) passes = false; // Weak fundamentals
  if (analystScore < 25) passes = false; // Analysts bearish
  if (newsScore < 20) passes = false; // Very negative news

  return passes;
}
```

**DIP je validní pouze pokud:** `dipScore >= 50 && dipQualityCheck === true`

---

## 7. Signal Generation

### Signal Types

| Signal            | Priorita | Ikona | Podmínky                                                            |
| ----------------- | -------- | ----- | ------------------------------------------------------------------- |
| `DIP_OPPORTUNITY` | 1        | 🔥    | dipScore ≥ 50 && quality check passes                               |
| `MOMENTUM`        | 2        | 📈    | technicalScore ≥ 70 && RSI 50-70                                    |
| `CONVICTION_HOLD` | 3        | 💎    | convictionLevel === 'HIGH'                                          |
| `NEAR_TARGET`     | 4        | 🎯    | \|targetUpside\| ≤ 8%                                               |
| `CONSIDER_TRIM`   | 5        | 📉    | technicalScore < 40 && RSI > 70 && weight > 8% && targetUpside < 5% |
| `WATCH_CLOSELY`   | 6        | ⚠️    | (fundamental 20-35) OR insider < 35 OR (news 15-30)                 |
| `ACCUMULATE`      | 7        | 🔄    | conviction != LOW && dipScore 20-40 && fundamental ≥ 50             |
| `NEUTRAL`         | 10       | ➖    | Žádný jiný signál                                                   |

### Signal Structure

```typescript
interface StockSignal {
  type: SignalType;
  strength: number; // 0-100
  title: string;
  description: string;
  icon: string;
  priority: number; // Pro řazení (nižší = vyšší priorita)
}
```

---

## 8. Buy Strategy

### Buy Zone Calculation

```typescript
// Buy Zone Low: Support level nebo 10% pod aktuální cenou
buyZoneLow = supportPrice || currentPrice * 0.9;

// Buy Zone High: Nepřekročit avg buy price + 5%
buyZoneHigh = Math.min(avgBuyPrice * 1.05, currentPrice);

// In Buy Zone?
inBuyZone = currentPrice >= buyZoneLow && currentPrice <= buyZoneHigh;
```

### DCA Recommendations

| Weight | Recommendation | Max Add % | Důvod             |
| ------ | -------------- | --------- | ----------------- |
| >12%   | NO_DCA         | 0%        | Pozice overweight |
| 8-12%  | CAUTIOUS       | 0.5%      | Lehce overweight  |
| 3-8%   | NORMAL         | 1%        | Vyvážená pozice   |
| <3%    | AGGRESSIVE     | 2%        | Underweight       |

**Override:** Pokud není buy signal, snížit na CAUTIOUS.

### Risk/Reward Ratio

```typescript
riskRewardRatio = (targetPrice - currentPrice) / (currentPrice - supportPrice);
```

---

## 9. Rozdíly Holdings vs Research

### Klíčový rozdíl: Target Price

| View     | targetPrice   | analystTargetPrice | Výsledek                    |
| -------- | ------------- | ------------------ | --------------------------- |
| Holdings | Z DB (osobní) | N/A                | Plných 10 bodů v conviction |
| Research | null          | Z Yahoo Finance    | Body podle analyst target   |

### Priority Chain pro Target Upside

```typescript
// V calculateConvictionScore():

if (item.targetPrice !== null) {
  // 1. Personal target (Holdings má)
  targetUpside = ((targetPrice - currentPrice) / currentPrice) * 100;
  targetSource = 'personal';
} else if (item.analystTargetPrice !== null) {
  // 2. Yahoo analyst target (Research fallback)
  targetUpside = ((analystTargetPrice - currentPrice) / currentPrice) * 100;
  targetSource = 'analyst';
} else if (item.consensusScore !== null) {
  // 3. Estimated from consensus (poslední záchrana)
  if (consensusScore >= 1.5) targetUpside = 25;
  else if (consensusScore >= 1.0) targetUpside = 15;
  else if (consensusScore >= 0.5) targetUpside = 8;
  targetSource = 'estimated';
}
```

### EnrichedAnalystData (Holdings only)

```typescript
interface EnrichedAnalystData extends AnalystData {
  weight: number; // Váha v portfoliu
  currentValue: number; // Aktuální hodnota pozice
  totalShares: number; // Počet akcií
  avgBuyPrice: number; // Průměrná nákupní cena
  totalInvested: number; // Celková investice
  unrealizedGain: number; // Nerealizovaný zisk/ztráta
  gainPercentage: number; // % zisk/ztráta
  targetPrice: number | null; // ⚠️ Osobní target z DB
  distanceToTarget: number | null; // % vzdálenost k targetu
}
```

---

## 10. API Reference

### Edge Functions

#### `fetch-analyst-data`

**Request:**

```typescript
{
  portfolioId?: string;  // Pro portfolio holdings
  ticker?: string;       // Pro single ticker (Research)
  stockName?: string;
  finnhubTicker?: string;
}
```

**Response:**

```typescript
{
  data: AnalystData[];
  errors: string[];
}
```

#### `fetch-technical-data`

**Request:**

```typescript
{
  portfolioId?: string;
  ticker?: string;
}
```

**Response:**

```typescript
{
  data: TechnicalData[];
  errors: string[];
}
```

#### `fetch-news`

**Request:**

```typescript
{
  portfolioId?: string;
  ticker?: string;
  category?: string;
}
```

### Hlavní funkce

```typescript
// Generuje doporučení pro jednu akcii
function generateRecommendation(
  input: RecommendationInput
): StockRecommendation;

// Generuje doporučení pro celé portfolio
function generateAllRecommendations(
  analystData: EnrichedAnalystData[],
  technicalData: TechnicalData[],
  newsArticles: NewsArticle[],
  insiderTimeRange: InsiderTimeRange
): StockRecommendation[];

// Filtruje insider data podle časového rozsahu
function getFilteredInsiderSentiment(
  item: EnrichedAnalystData,
  months: InsiderTimeRange
): { mspr: number | null; change: number | null };
```

---

## Appendix A: TypeScript Interfaces

### StockRecommendation (full)

```typescript
interface StockRecommendation {
  ticker: string;
  stockName: string;

  // Portfolio context
  weight: number;
  avgBuyPrice: number;
  currentPrice: number;
  gainPercentage: number;
  distanceFromAvg: number;

  // Composite scores (0-100)
  compositeScore: number;
  fundamentalScore: number;
  technicalScore: number;
  analystScore: number;
  newsScore: number;
  insiderScore: number;
  portfolioScore: number;

  // Conviction
  convictionScore: number;
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW';

  // DIP
  dipScore: number;
  isDip: boolean;
  dipQualityCheck: boolean;

  // Breakdowns & Signals
  breakdown: ScoreComponent[];
  signals: StockSignal[];
  primarySignal: StockSignal;

  // Key points
  strengths: string[];
  concerns: string[];
  actionItems: string[];

  // Target & 52W
  targetPrice: number | null;
  targetUpside: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  distanceFrom52wHigh: number | null;

  // Technical
  technicalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  // Buy Strategy
  buyStrategy: BuyStrategy;

  // Metadata for logging
  metadata: {
    rsiValue: number | null;
    macdSignal: string | null;
    bollingerPosition: string | null;
    newsSentiment: number | null;
    insiderMspr: number | null;
  };
}
```

---

## Changelog

| Verze | Datum      | Změny                 |
| ----- | ---------- | --------------------- |
| 1.0   | 28.11.2025 | Initial documentation |

---

**Poznámka:** Při změně algoritmu **vždy aktualizuj tuto dokumentaci!**
