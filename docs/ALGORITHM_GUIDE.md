# Portfolio Tracker - Algoritmus doporučení

> Kompletní dokumentace scorovacího systému, signálů a strategií.  
> Verze: 3.3 (prosinec 2024)

---

## Obsah

1. [Přehled systému](#1-přehled-systému)
2. [Datové zdroje](#2-datové-zdroje)
3. [Scorovací systém](#3-scorovací-systém)
4. [Signály](#4-signály)
5. [DIP detekce](#5-dip-detekce)
6. [Conviction score](#6-conviction-score)
7. [Strategie (Buy/Exit)](#7-strategie-buyexit)
8. [Rozdíly Holdings vs Research](#8-rozdíly-holdings-vs-research)
9. [Thresholds reference](#9-thresholds-reference)

---

## 1. Přehled systému

Systém generuje **kontextuální doporučení** pro akcie kombinací:

- **Fundamentální analýza** (valuace, profitabilita, růst, zdraví)
- **Technická analýza** (RSI, MACD, Bollinger, ADX, 200-MA)
- **Sentiment analytiků** (konsensus, cílová cena)
- **Sentiment zpráv** (analýza článků)
- **Insider aktivita** (MSPR, čisté změny)
- **Portfolio kontext** (váha, průměrná cena, nerealizovaný zisk) - pouze Holdings

### Dva režimy

| Režim        | Body celkem | Portfolio score | Použití                |
| ------------ | ----------- | --------------- | ---------------------- |
| **Holdings** | 500         | Ano (100b)      | Akcie v portfoliu      |
| **Research** | 400         | Ne              | Watchlist / nové akcie |

---

## 2. Datové zdroje

### APIs

| Zdroj              | Typ         | Limity     | Data                                                              |
| ------------------ | ----------- | ---------- | ----------------------------------------------------------------- |
| **Finnhub** (FREE) | REST        | 60 req/min | Recommendations, Quote, Earnings, Metric, Peers, Profile, Insider |
| **Yahoo Finance**  | Neoficiální | Bez limitu | Historical prices, Technical calc, Analyst target, Description    |

### Supabase Edge Functions

```
fetch-analyst-data/     → Finnhub + Yahoo analyst data
fetch-technical-data/   → Technical indicators (calculated from Yahoo)
fetch-news/             → News + sentiment analysis
fetch-prices/           → Price refresh
fetch-peers-data/       → Peer comparison
```

---

## 3. Scorovací systém

### 3.1 Fundamental Score (max 140 bodů → normalizováno na 0-100%)

| Komponenta          | Body    | Logika                                                           |
| ------------------- | ------- | ---------------------------------------------------------------- |
| **PEG Ratio**       | 0-20    | 0.5-1.2 = 20b (ideální), 1.2-2.0 = 15b, <0.5 = 10b, 2.0-3.0 = 5b |
| **P/E Ratio**       | 0-20    | 10-20 = 20b (férové), 7-10 = 15b, 20-30 = 15b, 30-40 = 8b        |
| **ROE**             | 0-30    | >25% = 30b, >18% = 24b, >12% = 18b, >5% = 9b, >0% = 4b           |
| **ROE D/E Penalty** | -6 až 0 | D/E > 1.5 penalizuje vysoké ROE (páka)                           |
| **Net Margin**      | 0-25    | >25% = 25b, >15% = 20b, >8% = 13b, >0% = 6b                      |
| **Revenue Growth**  | 0-25    | >25% = 25b, >15% = 20b, >5% = 13b, >0% = 6b                      |
| **Debt/Equity**     | 0-10    | <0.3 = 10b, <0.7 = 8b, <1.5 = 5b, <2.5 = 2b                      |
| **Current Ratio**   | 0-10    | >2.0 = 10b, >1.5 = 8b, >1.0 = 5b, >0.5 = 2b                      |

### 3.2 Technical Score (max 120 bodů → normalizováno na 0-100%)

Optimalizováno pro **position trading** (měsíce/roky).

| Komponenta    | Body | Logika                                                                                        |
| ------------- | ---- | --------------------------------------------------------------------------------------------- |
| **RSI (14)**  | 0-15 | <20 = 15b, 20-30 = 13b, 30-40 = 11b, 40-50 = 9b, 50-60 = 7b, 60-70 = 5b, 70-80 = 3b, >80 = 1b |
| **MACD**      | 0-35 | Histogram>0 + bullish = 28b, Histogram>0 = 23b, -0.5<H<0 = 12b, H<0 + bearish = 3b            |
| **Bollinger** | 0-10 | Pod lower - 50% = 9b, Pod lower = 7b, Lower zóna = 5b, Upper zóna = 4b                        |
| **ADX**       | 0-25 | >40 = 25b, 30-40 uptrend = 21b, 30-40 downtrend = 14b, 25-30 = 16/10b, 20-25 = 6b             |
| **200-MA**    | 0-25 | Nad rostoucí = 25b, Nad = 19b, U MA = 12b, Pod (-15%) = 6b, Výrazně pod = 0b                  |
| **Volume**    | 0-10 | >1.5× + růst = 10b, >1.5× + pokles = 8b, >1× = 7b, 0.7-1× = 5b, <0.7× = 2b                    |

### 3.3 Analyst Score (max 80 bodů → normalizováno na 0-100%)

| Komponenta        | Body | Logika                                                                                                                                   |
| ----------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Consensus**     | 0-50 | Strong Buy (>1.5) = 50b, Buy (>1.0) = 40b, Moderate Buy (>0.5) = 32b, Weak Buy (>0) = 25b, Hold (>-0.5) = 16b, Underperform (>-1.0) = 8b |
| **Coverage**      | 0-15 | ≥20 analytiků = 15b, ≥10 = 12b, ≥5 = 8b, ≥1 = 4b                                                                                         |
| **Target Upside** | 0-10 | >30% = 10b, >15% = 8b, >5% = 5b, -5% až 5% = 3b, <-5% = 1b                                                                               |
| **Agreement**     | 0-5  | >60% v jednom směru = 5b, >50% = 4b, ≥30% = 2b                                                                                           |

### 3.4 News + Insider Score (max 60 bodů → normalizováno na 0-100%)

**News Sentiment (max 35b):**

| Avg Sentiment | Body |
| ------------- | ---- |
| > 0.5         | 35   |
| 0.15 - 0.5    | 28   |
| -0.15 - 0.15  | 17   |
| -0.5 - -0.15  | 8    |
| < -0.5        | 0    |

**Insider Activity (max 25b):**

| MSPR Range | Body |
| ---------- | ---- |
| > 50       | 25   |
| 25 - 50    | 21   |
| 0 - 25     | 16   |
| -25 - 0    | 12   |
| -50 - -25  | 6    |
| < -50      | 0    |

### 3.5 Portfolio Score (max 100 bodů) - pouze Holdings

| Komponenta            | Body | Logika                                                               |
| --------------------- | ---- | -------------------------------------------------------------------- |
| **Target Upside**     | 0-35 | >30% = 35b, >20% = 28b, >10% = 21b, >5% = 14b, >0% = 7b, <0% = 0b    |
| **Distance from Avg** | 0-25 | <-15% = 25b (DCA), <-10% = 20b, <0% = 15b, <25% = 10b, <50% = 5b     |
| **Weight**            | 0-20 | 3-6% = 20b (ideální), <3% = 15b, 6-12% = 12b, >12% = 4b              |
| **Unrealized Gain**   | 0-20 | 0-15% = 20b, 15-40% = 16b, 40-75% = 13b, >75% = 10b, záporný = 4-14b |

### 3.6 Composite Score - váhy

**Holdings (500 bodů):**

```
Composite = Fund×0.28 + Tech×0.24 + Analyst×0.16 + NewsInsider×0.12 + Portfolio×0.20
```

**Research (400 bodů):**

```
Composite = Fund×0.35 + Tech×0.30 + Analyst×0.20 + NewsInsider×0.15
```

---

## 4. Signály

### 4.1 Dvě kategorie

| Kategorie   | Účel                             | Počet na akcii |
| ----------- | -------------------------------- | -------------- |
| **ACTION**  | Co dělat (koupit, prodat, držet) | 0-1            |
| **QUALITY** | Hodnocení kvality akcie          | vždy 1         |

### 4.2 ACTION signály (priorita 1-10)

| Signál            | Priorita | Podmínky                                                          | Popis                     |
| ----------------- | -------- | ----------------------------------------------------------------- | ------------------------- |
| `DIP_OPPORTUNITY` | 1        | dipScore ≥ 50 && qualityCheck                                     | Přeprodáno, fundamenty OK |
| `BREAKOUT`        | 2        | Bollinger overbought + high volume + tech ≥ 60                    | Průraz s objemem          |
| `REVERSAL`        | 3        | MACD bullish divergence + RSI < 40                                | Potenciální obrat         |
| `MOMENTUM`        | 4        | tech ≥ 60 && RSI 45-70                                            | Býčí technický trend      |
| `ACCUMULATE`      | 5        | conviction ≠ LOW && dipScore 20-50 && fund ≥ 40                   | DCA příležitost           |
| `GOOD_ENTRY`      | 6        | **Research only** + upside ≥ 15% + fund ≥ 40 + conviction ≠ LOW   | Kvalitní vstup            |
| `WAIT_FOR_DIP`    | 7        | **Research only** + (upside < 10% or null) + RSI > 55 + fund ≥ 40 | Počkat na pokles          |
| `NEAR_TARGET`     | 8        | 0 < upside ≤ 10%                                                  | Blízko cílové ceny        |
| `TAKE_PROFIT`     | 9        | gain ≥ 50% && conviction ≠ HIGH                                   | Realizovat zisk           |
| `CONSIDER_TRIM`   | 10       | RSI > 70 && weight > 8%                                           | Redukovat pozici          |

### 4.3 QUALITY signály (priorita 11-20)

| Signál         | Priorita | Podmínky                                   | Popis                         |
| -------------- | -------- | ------------------------------------------ | ----------------------------- |
| `CONVICTION`   | 11       | convictionLevel = HIGH                     | Top kvalita, dlouhodobě držet |
| `QUALITY_CORE` | 12       | fund ≥ 60 && analyst ≥ 55                  | Silné fundamenty + analytici  |
| `UNDERVALUED`  | 13       | upside ≥ 30% && fund ≥ 40                  | Vysoký potenciál              |
| `STRONG_TREND` | 14       | ADX ≥ 25 && adxTrend = bullish             | Silný býčí trend              |
| `STEADY`       | 15       | fund ≥ 40 && tech ≥ 40 && conviction ≠ LOW | Stabilní, držet               |
| `OVERBOUGHT`   | 16       | RSI > 70 && StochK > 80                    | Překoupeno                    |
| `WATCH`        | 17       | fund < 35 OR insider < 35 OR news < 40     | Zhoršující se metriky         |
| `WEAK`         | 18       | fund < 25 OR tech < 30                     | Slabá akcie                   |
| `NEUTRAL`      | 20       | fallback                                   | Žádné výrazné signály         |

---

## 5. DIP detekce

### DIP Score (max 100 bodů)

| Komponenta          | Body | Logika                                                        |
| ------------------- | ---- | ------------------------------------------------------------- |
| **RSI**             | 0-25 | <25 = 25b, <30 = 20b, <35 = 15b, <40 = 8b                     |
| **Bollinger**       | 0-20 | Pod lower - 50% = 20b, Pod lower = 15b, Lower zóna = 8b       |
| **200-MA Position** | 0-20 | <-15% = 20b, <-10% = 15b, <-5% = 10b, <0% = 5b                |
| **52W Position**    | 0-15 | >35% pod max = 15b, >25% = 12b, >15% = 8b, >10% = 4b          |
| **MACD Divergence** | 0-10 | Bullish divergence v downtrend = 10b, Histogram zlepšení = 5b |
| **Volume**          | 0-10 | >2× avg = 10b (kapitulace), >1.5× = 7b, >1× = 3b              |

### DIP Quality Check

Pro validní DIP musí platit:

- `fundamentalScore ≥ 35`
- `analystScore ≥ 25`
- `newsScore ≥ 20`

---

## 6. Conviction Score

Měří **dlouhodobou kvalitu** pro držení (max 100 bodů).

### Fundamental Stability (max 40b)

- ROE > 20% = 12b
- 5Y Revenue CAGR > 15% = 10b
- Net Margin > 20% = 10b
- D/E < 0.5 = 8b

### Market Position (max 30b)

- Positive analyst consensus = 0-12b
- Target upside > 25% = 10b
- Earnings beats 4/4 = 8b

### Momentum & Sentiment (max 30b)

- Insider buying > 65 score = 12b
- Price > 5% above 200-MA = 10b
- Rising volume = 8b

### Conviction Level

| Score | Level  |
| ----- | ------ |
| ≥ 70  | HIGH   |
| 45-69 | MEDIUM |
| < 45  | LOW    |

---

## 7. Strategie (Buy/Exit)

### 7.1 Buy Strategy

**Buy Zone:**

- Low: Support (Bollinger lower, 200-MA, 52W low) nebo -10% od aktuální
- High: Min(avgBuyPrice × 1.05, currentPrice)

**DCA Recommendation:**

| Weight | DCA        | Interval |
| ------ | ---------- | -------- |
| > 12%  | NO_DCA     | -        |
| 8-12%  | CAUTIOUS   | 2 měsíce |
| 3-8%   | NORMAL     | 1 měsíc  |
| < 3%   | AGGRESSIVE | 2 týdny  |

**Risk/Reward Ratio:**

```
R:R = (targetPrice - currentPrice) / (currentPrice - supportPrice)
```

### 7.2 Exit Strategy

**Take Profit Levels:**

- TP1: 8-12% gain nebo první resistance
- TP2: 20-25% gain nebo analyst target
- TP3: 35-50% gain nebo 52W high

**Stop Loss:**

- Base: avgBuyPrice × (1 - maxDrawdown)
- maxDrawdown: HIGH conviction = 15%, MEDIUM = 12%, LOW = 8%

**Trailing Stop:**

| Gain    | Trailing |
| ------- | -------- |
| ≥ 50%   | 6%       |
| ≥ 30%   | 8%       |
| ≥ 20%   | 10%      |
| default | 10-15%   |

**Holding Period:**

- LONG: conviction HIGH + tech ≠ BEARISH
- SWING: conviction LOW OR tech = BEARISH
- MEDIUM: ostatní

---

## 8. Rozdíly Holdings vs Research

| Aspekt               | Holdings      | Research        |
| -------------------- | ------------- | --------------- |
| Portfolio Score      | ✅ Ano        | ❌ Ne           |
| Target Price         | Osobní (z DB) | Analyst (Yahoo) |
| Celkem bodů          | 500           | 400             |
| TAKE_PROFIT          | Možný         | Nikdy           |
| CONSIDER_TRIM        | Možný         | Nikdy           |
| GOOD_ENTRY           | Nikdy         | Možný           |
| WAIT_FOR_DIP         | Nikdy         | Možný           |
| Weight-based signals | ✅ Ano        | ❌ N/A          |
| Gain-based signals   | ✅ Ano        | ❌ N/A          |

### Proč rozdíl?

- **Holdings**: Máme osobní kontext - váhu pozice, nákupní cenu, unrealized gain
- **Research**: Žádný osobní kontext, jen "je to dobrá akcie na koupi?"

---

## 9. Thresholds Reference

```typescript
const SIGNAL_THRESHOLDS = {
  // Technical
  TECH_STRONG: 60,
  TECH_MODERATE: 40,
  TECH_WEAK: 30,

  // Fundamental
  FUND_QUALITY: 60,
  FUND_STRONG: 50,
  FUND_MODERATE: 40,
  FUND_WATCH: 35,
  FUND_WEAK: 25,

  // Analyst
  ANALYST_QUALITY: 55,

  // Insider
  INSIDER_WEAK: 35,

  // News
  NEWS_WATCH: 40,

  // DIP
  DIP_TRIGGER: 50,
  DIP_ACCUMULATE_MIN: 20,
  DIP_ACCUMULATE_MAX: 50,

  // Position
  WEIGHT_OVERWEIGHT: 8,
  WEIGHT_MAX: 15,

  // Target
  TARGET_NEAR: 10,
  TARGET_UPSIDE_HIGH: 30,
  TARGET_LOW_UPSIDE: 5,

  // Gain
  GAIN_TAKE_PROFIT: 50,

  // RSI
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,

  // ADX
  ADX_STRONG: 25,
  ADX_WEAK: 20,
};
```

---

## Příklad rozhodovacího procesu

### Scénář: AAPL v portfoliu

**Data:**

- Price: $180, Avg Buy: $150, Target: $200
- Weight: 5%, Gain: +20%
- RSI: 45, ADX: 32 (bullish), MACD: positive
- Fund: 72%, Tech: 65%, Analyst: 70%

**Výpočet:**

1. Composite = 72×0.28 + 65×0.24 + 70×0.16 + 55×0.12 + 60×0.20 = **66.5**
2. Conviction = 75 → **HIGH**
3. DIP Score = 15 (RSI normální, nad MA)
4. Target Upside = +11%

**Signal evaluation:**

- DIP_OPPORTUNITY: ❌ (dipScore 15 < 50)
- MOMENTUM: ✅ (tech 65 ≥ 60, RSI 45-70)
- NEAR_TARGET: ❌ (upside 11% > 10%)
- CONVICTION: ✅ (level = HIGH)

**Výsledek:**

- Action Signal: `MOMENTUM` (bullish technicals)
- Quality Signal: `CONVICTION` (vysoká kvalita)

---

## Klíčové soubory

```
src/utils/recommendations.ts  - Hlavní algoritmus
src/utils/signals.ts          - Signal config pro UI
src/services/api/analysis.ts  - AnalystData types
src/services/api/technical.ts - TechnicalData types
supabase/functions/           - Edge functions (API calls)
```
