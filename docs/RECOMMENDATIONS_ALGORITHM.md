# Recommendations & Research Algorithm Documentation

> **Verze:** 3.2  
> **Poslední aktualizace:** 2. prosince 2025
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

Systém generuje **kontextuální doporučení** pro akcie kombinací:

- **Fundamentální analýzy** (valuace, profitabilita, růst, finanční zdraví)
- **Technické analýzy** (MACD, ADX, 200-day MA, RSI, Volume, Bollinger)
- **Sentiment analytiků** (consensus score, target price)
- **News & Insider sentiment** (NLP analýza článků + insider MSPR)
- **Kontext portfolia** (váha, průměrná cena, nerealizovaný zisk) - pouze Holdings

### Bodový systém

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCORING SYSTÉM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  RESEARCH MODE (bez portfolia):     400 bodů celkem             │
│  ├── Fundamental Score    35%       140 bodů                    │
│  ├── Technical Score      30%       120 bodů                    │
│  ├── Analyst Score        20%        80 bodů                    │
│  └── News+Insider Score   15%        60 bodů                    │
│                                                                 │
│  HOLDINGS MODE (s portfoliem):      500 bodů celkem             │
│  ├── Fundamental Score    28%       140 bodů                    │
│  ├── Technical Score      24%       120 bodů                    │
│  ├── Analyst Score        16%        80 bodů                    │
│  ├── News+Insider Score   12%        60 bodů                    │
│  └── Portfolio Score      20%       100 bodů  ← OVERLAY         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Výstupy systému

| Výstup            | Popis                                    | Rozsah (Research) | Rozsah (Holdings) |
| ----------------- | ---------------------------------------- | ----------------- | ----------------- |
| `compositeScore`  | Vážený součet všech kategorií            | 0-400             | 0-500             |
| `convictionScore` | Kvalita pro dlouhodobé držení            | 0-100             | 0-100             |
| `dipScore`        | Příležitost k nákupu (oversold)          | 0-100             | 0-100             |
| `signals`         | Generované signály (DIP, MOMENTUM, etc.) | Array             | Array             |
| `buyStrategy`     | Doporučení pro DCA a buy zone            | Object            | Object            |

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

### 3.1 Fundamental Score (0-140 bodů)

```
┌────────────────────────────────────────────────────────┐
│ FUNDAMENTAL SCORE (140 bodů)                           │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ PEG Ratio        │ 20           │ 0.5-1.2: 20 (ideal)  │
│ (P/E vs růst)    │              │ 1.2-2.0: 15          │
│                  │              │ 0.3-0.5: 10          │
│                  │              │ 2.0-3.0: 5, else: 0  │
├──────────────────┼──────────────┼──────────────────────┤
│ Absolutní P/E    │ 20           │ 10-20: 20 (sweet sp) │
│                  │              │ 7-10,20-30: 15       │
│                  │              │ 5-7,30-40: 8         │
│                  │              │ <5,40-60: 3, >60: 0  │
├──────────────────┼──────────────┼──────────────────────┤
│ ROE              │ 30           │ >25%: 30, >18%: 24,  │
│ (base score)     │              │ >12%: 18, >5%: 9,    │
│                  │              │ 0-5%: 4, <0%: 0      │
│                  │              │                      │
│ D/E penalty:     │              │ Pokud D/E > 1.5:     │
│                  │              │ ROE>25%: -6b         │
│                  │              │ ROE>18%: -5b         │
│                  │              │ ROE>12%: -3b         │
├──────────────────┼──────────────┼──────────────────────┤
│ Net Margin       │ 25           │ >25%: 25, >15%: 20,  │
│                  │              │ >8%: 13, >0%: 6      │
├──────────────────┼──────────────┼──────────────────────┤
│ Revenue Growth   │ 25           │ >25%: 25, >15%: 20,  │
│                  │              │ >5%: 13, >0%: 6      │
├──────────────────┼──────────────┼──────────────────────┤
│ Debt/Equity      │ 10           │ <0.3: 10, <0.7: 8,   │
│                  │              │ <1.5: 5, <2.5: 2     │
├──────────────────┼──────────────┼──────────────────────┤
│ Current Ratio    │ 10           │ >2.0: 10, >1.5: 8,   │
│ (liquidity)      │              │ >1.0: 5, >0.5: 2     │
└──────────────────┴──────────────┴──────────────────────┘
```

### 3.2 Technical Score (0-120 bodů)

> **Horizont:** Měsíční až roční (position trading / swing na delší vlnu)

```
┌────────────────────────────────────────────────────────┐
│ TECHNICAL SCORE (120 bodů)                             │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ MACD (weekly)    │ 35           │ Base score:          │
│ 👑 Klíčový       │              │ Bull+histogram↑: 28  │
│                  │              │ Bullish: 23          │
│                  │              │ Neutral+: 16         │
│                  │              │ Neutral-: 12         │
│                  │              │ Bearish: 7           │
│                  │              │ Bear+histogram↓: 3   │
│                  │              │                      │
│                  │              │ Divergence adjust:   │
│                  │              │ Bullish div: +7      │
│                  │              │ Bearish div: -7      │
│                  │              │ Final: clamp(0,35)   │
├──────────────────┼──────────────┼──────────────────────┤
│ ADX (weekly)     │ 25           │ ADX>40: 25 (v.silný) │
│ Síla trendu      │              │ 30-40 up: 21         │
│                  │              │ 30-40 down: 14       │
│                  │              │ 25-30 up: 16         │
│                  │              │ 25-30 down: 10       │
│                  │              │ 20-25: 6             │
│                  │              │ <20: 3 (sideways)    │
├──────────────────┼──────────────┼──────────────────────┤
│ 200-day MA       │ 25           │ Trend direction:     │
│ (klíčový filtr)  │              │ Cena>MA + MA↑: 25    │
│                  │              │ Cena>MA: 19          │
│                  │              │ 95-105% MA: 12       │
│                  │              │ Cena<MA: 6           │
│                  │              │ Cena<MA + MA↓: 0     │
├──────────────────┼──────────────┼──────────────────────┤
│ RSI (weekly)     │ 15           │ <25: 15 (přeprodané) │
│                  │              │ 25-35: 13, 35-45: 11 │
│                  │              │ 45-55: 9, 55-65: 7   │
│                  │              │ 65-75: 4, >75: 2     │
├──────────────────┼──────────────┼──────────────────────┤
│ Volume           │ 10           │ Breakout confirm:    │
│ (potvrzení)      │              │ Vol>1.5×avg+↑: 10    │
│                  │              │ Vol>1.5×avg+↓: 8     │
│                  │              │ Vol>avg: 7           │
│                  │              │ Normální: 5          │
│                  │              │ Vol<0.5×avg: 2       │
├──────────────────┼──────────────┼──────────────────────┤
│ Bollinger Bands  │ 10           │ Far below (<-2σ): 9  │
│ (volatilita)     │              │ Below lower: 7       │
│                  │              │ Lower zone: 5        │
│                  │              │ Upper zone: 4        │
│                  │              │ Above upper: 2       │
│                  │              │ Far above (>+2σ): 1  │
│                  │              │                      │
│                  │              │ Squeeze bonus: +1    │
└──────────────────┴──────────────┴──────────────────────┘
```

**Poznámka:** Stochastic byl odebrán - příliš rychlý pro position trading.

### 3.3 Analyst Score (0-80 bodů)

```
┌────────────────────────────────────────────────────────┐
│ ANALYST SCORE (80 bodů)                                │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ Consensus Score  │ 50           │ Scale: -2 to +2      │
│ (vážený průměr)  │              │ >1.5: 50 (Strong Buy)│
│                  │              │ >1.0: 40 (Buy)       │
│                  │              │ >0.5: 32 (Mod Buy)   │
│                  │              │ >0.0: 25 (Weak Buy)  │
│                  │              │ >-0.5: 16 (Hold)     │
│                  │              │ >-1.0: 8 (Underperf) │
│                  │              │ else: 0 (Sell)       │
├──────────────────┼──────────────┼──────────────────────┤
│ Analyst Coverage │ 15           │ ≥20: 15 (high)       │
│                  │              │ ≥10: 12 (good)       │
│                  │              │ ≥5: 8 (moderate)     │
│                  │              │ ≥1: 4 (low)          │
├──────────────────┼──────────────┼──────────────────────┤
│ Price Target     │ 10           │ >30% upside: 10      │
│ Upside           │              │ 15-30%: 8            │
│                  │              │ 5-15%: 5             │
│                  │              │ ±5%: 3               │
│                  │              │ <-5%: 1              │
├──────────────────┼──────────────┼──────────────────────┤
│ Analyst Agreement│ 5            │ Consensus >60%: 5    │
│ (shoda)          │              │ Majority >50%: 4     │
│                  │              │ Mixed 30-50%: 2      │
│                  │              │ Divided <30%: 1      │
└──────────────────┴──────────────┴──────────────────────┘
```

**Consensus Score výpočet:**

```typescript
consensusScore =
  (strongBuy * 2 + buy * 1 + hold * 0 + sell * -1 + strongSell * -2) /
  totalAnalysts;
```

### 3.4 News+Insider Score (0-60 bodů)

```
┌────────────────────────────────────────────────────────┐
│ NEWS+INSIDER SCORE (60 bodů)                           │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ News Sentiment   │ 35           │ Výchozí: 17.5        │
│                  │              │ (avgSentiment+1)×17.5│
│                  │              │                      │
│                  │              │ Bullish: >0.15       │
│                  │              │ Bearish: <-0.15      │
│                  │              │ Neutral: ±0.15       │
├──────────────────┼──────────────┼──────────────────────┤
│ Insider Score    │ 25           │ Výchozí: 12.5        │
│ (MSPR based)     │              │ 12.5 + (MSPR/4)      │
│                  │              │                      │
│                  │              │ MSPR > 50: V.strong  │
│                  │              │ MSPR > 25: Strong    │
│                  │              │ MSPR > 0: Moderate   │
│                  │              │ MSPR < -25: Selling  │
│                  │              │ MSPR < -50: V.strong │
└──────────────────┴──────────────┴──────────────────────┘
```

**News Score výpočet:**

```typescript
// Sentiment: -1 až +1
// Konverze: (sentiment + 1) * 17.5 = 0-35b
newsScore = (avgSentiment + 1) * 17.5;
```

**Insider Score výpočet:**

```typescript
// MSPR: -100 až +100
// Konverze: 12.5 + (MSPR / 4) = 0-25b (clamped)
insiderScore = Math.max(0, Math.min(25, 12.5 + mspr / 4));
```

### 3.5 Portfolio Score (0-100 bodů) ⚠️ POUZE HOLDINGS

> **Horizont:** Měsíční až roční (position trading)
>
> ⚠️ Tento score existuje POUZE pro Holdings view!

```
┌────────────────────────────────────────────────────────┐
│ PORTFOLIO SCORE (100 bodů) - Holdings only             │
├──────────────────┬──────────────┬──────────────────────┤
│ Kategorie        │ Max bodů     │ Hodnocení            │
├──────────────────┼──────────────┼──────────────────────┤
│ Target Upside    │ 35           │ >30%: 35 (high pot)  │
│ (personal target)│              │ >20%: 28 (good)      │
│                  │              │ >10%: 21 (moderate)  │
│                  │              │ >5%: 14 (limited)    │
│                  │              │ >0%: 7 (near tgt)    │
│                  │              │ else: 0 (above tgt)  │
├──────────────────┼──────────────┼──────────────────────┤
│ Distance from    │ 25           │ <-15%: 25 (DCA opp)  │
│ Avg Buy Price    │              │ <-10%: 20 (add dip)  │
│                  │              │ <0%: 15 (under avg)  │
│                  │              │ <25%: 10             │
│                  │              │ <50%: 5              │
│                  │              │ else: 2 (profits)    │
├──────────────────┼──────────────┼──────────────────────┤
│ Position Weight  │ 20           │ >12%: 4 (overweight) │
│                  │              │ >6%: 12 (sl. overw)  │
│                  │              │ ≥3%: 20 (balanced)   │
│                  │              │ else: 15 (small)     │
├──────────────────┼──────────────┼──────────────────────┤
│ Unrealized Gain  │ 20           │ >75%: 10 (rebalance) │
│                  │              │ >40%: 13 (consider)  │
│                  │              │ >15%: 16 (healthy)   │
│                  │              │ >0%: 20 (in profit)  │
│                  │              │ >-15%: 14 (minor)    │
│                  │              │ >-30%: 10 (concern)  │
│                  │              │ else: 4 (big loss)   │
└──────────────────┴──────────────┴──────────────────────┘
```

---

## 4. Composite Score

### Holdings View (s portfolio kontextem) - 500 bodů

```typescript
const SCORE_WEIGHTS_HOLDINGS = {
  fundamental: 140, // 28% z 500
  technical: 120, // 24% z 500
  analyst: 80, // 16% z 500
  newsInsider: 60, // 12% z 500
  portfolio: 100, // 20% z 500
};

compositeScore =
  fundamentalScore + // 0-140
  technicalScore + // 0-120
  analystScore + // 0-80
  newsInsiderScore + // 0-60
  portfolioScore; // 0-100
// CELKEM: 0-500
```

### Research View (bez portfolio kontextu) - 400 bodů

```typescript
const SCORE_WEIGHTS_RESEARCH = {
  fundamental: 140, // 35% z 400
  technical: 120, // 30% z 400
  analyst: 80, // 20% z 400
  newsInsider: 60, // 15% z 400
  // portfolio: 0    // VYNECHÁNO
};

compositeScore =
  fundamentalScore + // 0-140
  technicalScore + // 0-120
  analystScore + // 0-80
  newsInsiderScore; // 0-60
// CELKEM: 0-400
```

**Poznámka:** V Research view je `portfolioScore = null` a není zahrnut v breakdown.

### Interpretace Composite Score

**Research (400 bodů max):**

| Score   | %      | Interpretace                      |
| ------- | ------ | --------------------------------- |
| 320-400 | 80%+   | Výborný - silný kandidát na nákup |
| 240-319 | 60-79% | Dobrý - solidní příležitost       |
| 160-239 | 40-59% | Průměrný - vyžaduje další analýzu |
| 80-159  | 20-39% | Slabý - zvážit alternativy        |
| 0-79    | <20%   | Velmi slabý - nevhodný pro nákup  |

**Holdings (500 bodů max):**

| Score   | %      | Interpretace            |
| ------- | ------ | ----------------------- |
| 400-500 | 80%+   | Výborný - držet/navýšit |
| 300-399 | 60-79% | Dobrý - držet           |
| 200-299 | 40-59% | Průměrný - sledovat     |
| 100-199 | 20-39% | Slabý - zvážit exit     |
| 0-99    | <20%   | Velmi slabý - prodat    |

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
│ 200-day MA Position (0-10):                              │
│   price > sma200 * 1.05: 10 (solidní uptrend)            │
│   price > sma200: 7 (nad podporou)                       │
│   price > sma200 * 0.95: 3 (blízko MA)                   │
│                                                          │
│ Volume Health (0-8):                                     │
│   avg volume > 50-day avg * 1.2: 8 (rostoucí zájem)      │
│   avg volume > 50-day avg: 5 (stabilní)                  │
│   avg volume < 50-day avg * 0.7: 2 (nízký zájem)         │
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

**Identifikuje oversold podmínky = příležitost k nákupu pro position trading.**

```
┌──────────────────────────────────────────────────────────┐
│ DIP SCORE (0-100)                                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ RSI Based (0-25):                                        │
│   RSI < 25: 25 (deeply oversold)                         │
│   RSI < 30: 20 (oversold)                                │
│   RSI < 35: 15 (approaching oversold)                    │
│   RSI < 40: 10 (mírně slabý)                             │
│                                                          │
│ Bollinger Position (0-20):                               │
│   price < lower band - 0.5×width: 20 (far below)         │
│   price < lower band: 15 (below)                         │
│   price < middle - 0.5×width: 8 (lower zone)             │
│                                                          │
│ 200-MA Position (0-20):                                  │
│   price < sma200 * 0.85: 20 (>15% pod = silný DIP)       │
│   price < sma200 * 0.90: 15 (>10% pod)                   │
│   price < sma200: 10 (pod 200 MA)                        │
│   price < sma200 * 1.05: 5 (blízko 200 MA)               │
│                                                          │
│ 52-Week Position (0-15):                                 │
│   >30% below 52W high: 15                                │
│   >20% below: 10                                         │
│   >10% below: 5                                          │
│                                                          │
│ MACD Divergence (0-10):                                  │
│   bullish divergence detected: 10                        │
│   MACD histogram improving: 5                            │
│                                                          │
│ Volume Confirmation (0-10):                              │
│   volume > 2× avg on down day: 10 (kapitulace)           │
│   volume > 1.5× avg: 7                                   │
│   volume > avg: 3                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### DIP Quality Check

**DIP musí projít quality check!** Jinak může být "value trap".

```typescript
// Prahy jsou v % z maximálního score
const DIP_QUALITY_THRESHOLDS = {
  FUNDAMENTAL: 0.25, // min 25% z 140b = 35b
  ANALYST: 0.3, // min 30% z 80b = 24b
  NEWS: 0.3, // min 30% z 35b (News část) = 10.5b
};

function checkDipQuality(
  fundamentalScore: number,
  analystScore: number,
  newsScore: number
): boolean {
  const MAX_FUNDAMENTAL = 140;
  const MAX_ANALYST = 80;
  const MAX_NEWS = 35;

  if (fundamentalScore < MAX_FUNDAMENTAL * DIP_QUALITY_THRESHOLDS.FUNDAMENTAL)
    return false; // Weak fundamentals
  if (analystScore < MAX_ANALYST * DIP_QUALITY_THRESHOLDS.ANALYST) return false; // Analysts bearish
  if (newsScore < MAX_NEWS * DIP_QUALITY_THRESHOLDS.NEWS) return false; // Very negative news

  return true;
}
```

**DIP je validní pouze pokud:** `dipScore >= 50 && dipQualityCheck === true`

---

## 7. Signal Generation

### Threshold Constants

```typescript
// Prahy v % z maximálního score dané kategorie
const SIGNAL_THRESHOLDS = {
  // Technical (max 120b)
  TECH_STRONG: 60, // ≥60% pro MOMENTUM (sníženo z 70%)
  TECH_MODERATE: 35, // ≥35% pro STEADY_HOLD
  TECH_WEAK: 40, // <40% = 48b

  // Fundamental (max 140b)
  FUND_QUALITY: 60, // ≥60% pro QUALITY_CORE
  FUND_STRONG: 50, // ≥50% = 70b
  FUND_MODERATE: 40, // ≥40% pro STEADY_HOLD
  FUND_WATCH_HIGH: 35, // 35% = 49b
  FUND_WATCH_LOW: 20, // 20% = 28b

  // Analyst
  ANALYST_QUALITY: 55, // ≥55% pro QUALITY_CORE

  // Insider (max 25b z News+Insider)
  INSIDER_WEAK: 35, // <35% = 9b

  // News (max 35b z News+Insider)
  NEWS_WATCH_LOW: 25, // 25% = 9b
  NEWS_WATCH_HIGH: 50, // 50% = 17.5b

  // DIP
  DIP_TRIGGER: 50,
  DIP_ACCUMULATE_MIN: 15, // rozšířeno z 20
  DIP_ACCUMULATE_MAX: 50, // rozšířeno z 40
};
```

### Signal Types

| Signal            | Priorita | Badge       | Podmínky                                                             |
| ----------------- | -------- | ----------- | -------------------------------------------------------------------- |
| `DIP_OPPORTUNITY` | 1        | DIP         | dipScore ≥ 50 && quality check passes                                |
| `MOMENTUM`        | 2        | Momentum    | technicalScore ≥ 60% && RSI 45-75 (rozšířeno)                        |
| `CONVICTION_HOLD` | 3        | Conviction  | convictionLevel === 'HIGH'                                           |
| `QUALITY_CORE`    | 4        | Quality     | fundamentalScore ≥ 60% && analystScore ≥ 55% && conviction != LOW    |
| `NEAR_TARGET`     | 5        | Near Target | \|targetUpside\| ≤ 8%                                                |
| `ACCUMULATE`      | 6        | Accumulate  | conviction != LOW && dipScore 15-50 && fundamental ≥ 50%             |
| `STEADY_HOLD`     | 7        | Hold        | fundamentalScore ≥ 40% && technicalScore ≥ 35% && conviction != LOW  |
| `WATCH_CLOSELY`   | 8        | Watch       | (fundamental 20-35%) OR insider < 35% OR (news 25-50%)               |
| `CONSIDER_TRIM`   | 9        | Trim        | technicalScore < 40% && RSI > 70 && weight > 8% && targetUpside < 5% |
| `NEUTRAL`         | 10       | Neutral     | Žádný jiný signál (fallback)                                         |

### Signal Flow Logic

```
Akcie přichází → Kontrola podmínek od priority 1 do 10
                 ↓
   ┌─────────────────────────────────────────────────────────────┐
   │ DIP_OPPORTUNITY: Přeprodané + kvalitní fundamenty           │
   │ MOMENTUM: Technicky silné + potvrzený trend                 │
   │ CONVICTION_HOLD: Špičková dlouhodobá kvalita                │
   │ QUALITY_CORE: Vysoké fundamenty + pozitivní analytici       │ ← NEW
   │ NEAR_TARGET: Blízko cílové ceny                             │
   │ ACCUMULATE: Kvalitní akcie, prostor pro DCA                 │
   │ STEADY_HOLD: Solidní akcie, držet bez akce                  │ ← NEW
   │ WATCH_CLOSELY: Něco se zhoršuje, sledovat                   │
   │ CONSIDER_TRIM: Překoupeno + vysoká váha                     │
   │ NEUTRAL: Fallback když nic jiného nesedí                    │
   └─────────────────────────────────────────────────────────────┘
```

### Signal Structure

```typescript
interface StockSignal {
  type: SignalType;
  strength: number; // 0-100
  title: string;
  description: string;
  priority: number; // Pro řazení (nižší = vyšší priorita)
}
```

---

## 8. Buy Strategy

> **Horizont:** Měsíční až roční (position trading)

### Position Sizing (nová pozice)

| Composite Score | Max pozice | Poznámka                        |
| --------------- | ---------- | ------------------------------- |
| ≥80% (320/400)  | 5%         | Silná konvikce, plná pozice     |
| ≥60% (240/400)  | 3%         | Dobrý kandidát, střední pozice  |
| ≥50% (200/400)  | 2%         | Průměrný, malá startovní pozice |
| <50%            | 0%         | Nedostatečné skóre, nekupovat   |

### Buy Zone Calculation

```typescript
// Buy Zone Low: Support level nebo 10% pod aktuální cenou
buyZoneLow = supportPrice || currentPrice * 0.9;

// Buy Zone High: Nepřekročit avg buy price + 5%
buyZoneHigh = Math.min(avgBuyPrice * 1.05, currentPrice);

// In Buy Zone?
inBuyZone = currentPrice >= buyZoneLow && currentPrice <= buyZoneHigh;
```

### DCA Recommendations (Position Trading)

| Weight | Recommendation | Max Add % | Min interval | Důvod                     |
| ------ | -------------- | --------- | ------------ | ------------------------- |
| >12%   | NO_DCA         | 0%        | -            | Pozice overweight         |
| 8-12%  | CAUTIOUS       | 0.5%      | 2 měsíce     | Lehce overweight          |
| 3-8%   | NORMAL         | 1%        | 1 měsíc      | Vyvážená pozice           |
| <3%    | AGGRESSIVE     | 2%        | 2 týdny      | Underweight, buduj pozici |

**Override pravidla:**

- Pokud není buy signal → snížit na CAUTIOUS
- Pokud conviction === LOW → snížit na CAUTIOUS nebo NO_DCA
- Pokud RSI > 70 → snížit doporučení o 1 úroveň

### Risk Management

| Situace           | Pravidlo                                |
| ----------------- | --------------------------------------- |
| Max single stock  | 12% portfolia                           |
| Initial stop-loss | -15% od nákupní ceny                    |
| Trailing stop     | Aktivovat při +20% zisku, trailing -10% |
| Sector limit      | Max 30% v jednom sektoru                |

### Risk/Reward Ratio

```typescript
riskRewardRatio = (targetPrice - currentPrice) / (currentPrice - supportPrice);

// Minimum pro nákup:
// R/R ≥ 2.0 = Dobrý
// R/R ≥ 3.0 = Výborný
// R/R < 1.5 = Nedostatečný, nekupovat
```

---

## 9. Rozdíly Holdings vs Research

### Klíčové rozdíly

| Aspekt             | Holdings View        | Research View     |
| ------------------ | -------------------- | ----------------- |
| Max Score          | **500 bodů**         | **400 bodů**      |
| Portfolio Score    | Zahrnut (100b = 20%) | **Vynechan (0%)** |
| `portfolioScore`   | number (0-100)       | **null**          |
| `targetPrice`      | Z DB (osobní)        | null              |
| `isResearch` param | false (default)      | **true**          |

### Rozložení vah

```
RESEARCH (400b)                    HOLDINGS (500b)
┌─────────────────────┐           ┌─────────────────────┐
│ Fundamental   140b  │ 35%       │ Fundamental   140b  │ 28%
│ Technical     120b  │ 30%       │ Technical     120b  │ 24%
│ Analyst        80b  │ 20%       │ Analyst        80b  │ 16%
│ News+Insider   60b  │ 15%       │ News+Insider   60b  │ 12%
├─────────────────────┤           │ Portfolio     100b  │ 20%
│ TOTAL         400b  │ 100%      ├─────────────────────┤
└─────────────────────┘           │ TOTAL         500b  │ 100%
                                  └─────────────────────┘
```

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
// Input pro generování doporučení
interface RecommendationInput {
  analystData: EnrichedAnalystData;
  technicalData?: TechnicalData;
  newsArticles?: NewsArticle[];
  insiderTimeRange: InsiderTimeRange;
  isResearch?: boolean; // Pokud true, portfolio score se vynechá
}

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
  portfolioScore: number | null; // null pro Research view

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

  // Exit Strategy (v3.1)
  exitStrategy?: ExitStrategy;

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

## 11. Exit Strategy

> **Position trading = méně časté obchodování, ale disciplinovaný exit.**

### Exit Signal Types

| Signal              | Priorita | Ikona | Podmínky                         | Akce           |
| ------------------- | -------- | ----- | -------------------------------- | -------------- |
| `TARGET_REACHED`    | 1        | 🎯    | price ≥ targetPrice              | Prodat 50-100% |
| `TRAILING_STOP`     | 2        | 📉    | price -10% od peak && gain > 20% | Prodat 100%    |
| `STOP_LOSS`         | 3        | 🛑    | loss > 15%                       | Prodat 100%    |
| `FUNDAMENTAL_BREAK` | 4        | ⚠️    | fundamentalScore < 25% (35b)     | Zvážit prodej  |
| `CONVICTION_DROP`   | 5        | 📊    | conviction HIGH→LOW              | Redukovat 50%  |
| `REBALANCE`         | 6        | ⚖️    | weight > 15%                     | Trim na 10-12% |
| `ANALYST_DOWNGRADE` | 7        | 👎    | consensus < -0.5 && dříve > 0    | Zvážit redukci |

### Trailing Stop Logic

```typescript
interface TrailingStop {
  activationGain: number; // Při jakém % zisku aktivovat
  trailPercent: number; // Jak daleko od peak
}

const TRAILING_STOPS: TrailingStop[] = [
  { activationGain: 50, trailPercent: 6 }, // +50%: trail -6%
  { activationGain: 30, trailPercent: 8 }, // +30%: trail -8%
  { activationGain: 20, trailPercent: 10 }, // +20%: trail -10%
];

function calculateTrailingStop(
  currentPrice: number,
  peakPrice: number,
  avgBuyPrice: number
): { triggered: boolean; stopPrice: number } {
  const gainFromAvg = ((peakPrice - avgBuyPrice) / avgBuyPrice) * 100;

  // Najdi odpovídající trailing stop
  const stop = TRAILING_STOPS.find((s) => gainFromAvg >= s.activationGain);
  if (!stop) return { triggered: false, stopPrice: 0 };

  const stopPrice = peakPrice * (1 - stop.trailPercent / 100);
  const triggered = currentPrice <= stopPrice;

  return { triggered, stopPrice };
}
```

### Partial Exit Strategy

```typescript
interface ExitPlan {
  condition: string;
  action: string;
  percentage: number;
}

const EXIT_PLANS: ExitPlan[] = [
  {
    condition: 'Target reached (price ≥ targetPrice)',
    action: 'Prodat část, posunout stop na breakeven',
    percentage: 50,
  },
  {
    condition: 'Trailing stop triggered',
    action: 'Prodat zbytek pozice',
    percentage: 100,
  },
  {
    condition: '+75% gain && RSI > 70',
    action: 'Realizovat významnou část zisku',
    percentage: 50,
  },
];
```

### Exit Confirmation (multi-signal)

**Prodej pouze pokud 2+ signály souhlasí:**

```typescript
function shouldExit(recommendation: StockRecommendation): {
  shouldExit: boolean;
  signals: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
} {
  const exitSignals: string[] = [];

  // Technical bearish
  if (recommendation.technicalScore < 48) {
    // <40%
    exitSignals.push('TECH_BEARISH');
  }

  // RSI overbought declining
  if (
    recommendation.metadata.rsiValue &&
    recommendation.metadata.rsiValue > 70
  ) {
    exitSignals.push('RSI_OVERBOUGHT');
  }

  // Fundamental degrading
  if (recommendation.fundamentalScore < 35) {
    // <25%
    exitSignals.push('FUND_WEAK');
  }

  // Conviction dropped
  if (recommendation.convictionLevel === 'LOW') {
    exitSignals.push('CONVICTION_LOW');
  }

  // Near or above target
  if (
    recommendation.targetUpside !== null &&
    recommendation.targetUpside <= 0
  ) {
    exitSignals.push('TARGET_REACHED');
  }

  const signalCount = exitSignals.length;

  return {
    shouldExit: signalCount >= 2,
    signals: exitSignals,
    confidence: signalCount >= 3 ? 'HIGH' : signalCount >= 2 ? 'MEDIUM' : 'LOW',
  };
}
```

### Exit Strategy Interface

```typescript
interface ExitStrategy {
  recommendation: 'HOLD' | 'TRIM' | 'SELL' | 'CONSIDER_EXIT';
  signals: ExitSignal[];
  trailingStop: {
    active: boolean;
    stopPrice: number | null;
    peakPrice: number | null;
  };
  targetReached: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ExitSignal {
  type: ExitSignalType;
  reason: string;
  priority: number;
}

type ExitSignalType =
  | 'TARGET_REACHED'
  | 'TRAILING_STOP'
  | 'STOP_LOSS'
  | 'FUNDAMENTAL_BREAK'
  | 'CONVICTION_DROP'
  | 'REBALANCE'
  | 'ANALYST_DOWNGRADE';
```

---

## Changelog

| Verze | Datum      | Změny                                                                                                                                                                                                                                                   |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1   | 1.12.2025  | **Conviction:** 200-MA Position + Volume Health (nahrazuje RSI momentum). **DIP:** MACD Divergence + Volume Confirmation (nahrazuje Stochastic). **Signals:** prahy v %. **Buy Strategy:** Position Trading pravidla. **Exit Strategy:** nová sekce 11. |
| 3.0   | 1.12.2025  | **MAJOR:** Nový 500-bodový systém. Research=400b, Holdings=500b (+100 portfolio overlay). Sloučen News+Insider (60b). Nové váhy všech kategorií.                                                                                                        |
| 2.2   | 1.12.2025  | Portfolio Score: upravené prahy pro position trading (Target 25b, Distance 25b, Weight 25b, Unrealized 25b), rebalance logika pro 40%+ zisky                                                                                                            |
| 2.1   | 1.12.2025  | Analyst Score: nové rozložení (Consensus 55, Coverage 20, Target Upside 15, Agreement 10). Přidán Price Target Upside a Analyst Agreement                                                                                                               |
| 2.0   | 1.12.2025  | **MAJOR:** Horizont změněn na měsíční/roční (position trading). Technical Score: nové váhy (MACD 25, ADX 20, 200-MA 20, RSI 15, Volume 10, BB 10), přidán 200-day MA a Volume, odebrán Stochastic                                                       |
| 1.9   | 1.12.2025  | Technical: Stochastic 8 pásem + crossover bonus (±2b)                                                                                                                                                                                                   |
| 1.8   | 1.12.2025  | Technical: ADX - síla trendu primární, směr sekundární                                                                                                                                                                                                  |
| 1.7   | 1.12.2025  | Technical: Bollinger 6 zón + bandwidth/volume adj                                                                                                                                                                                                       |
| 1.6   | 1.12.2025  | Technical: MACD divergence (+/-5b), granulárnější base score                                                                                                                                                                                            |
| 1.5   | 1.12.2025  | Technical: RSI rozšířeno na 8 pásem (granulárnější)                                                                                                                                                                                                     |
| 1.4   | 1.12.2025  | Fundamental: nové rozložení bodů, přidán Current Ratio (14b)                                                                                                                                                                                            |
| 1.3   | 1.12.2025  | ROE scoring: nová pásma 0-5%, D/E quality penalty                                                                                                                                                                                                       |
| 1.2   | 1.12.2025  | P/E scoring: nový PEG + absolutní P/E (20→10+10)                                                                                                                                                                                                        |
| 1.1   | 30.11.2025 | Research view: portfolio score vynechán, nové váhy                                                                                                                                                                                                      |
| 1.0   | 28.11.2025 | Initial documentation                                                                                                                                                                                                                                   |

---

**Poznámka:** Při změně algoritmu **vždy aktualizuj tuto dokumentaci!**
