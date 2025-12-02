# Signal System Documentation

> **Verze:** 1.0  
> **Poslední aktualizace:** 2. prosince 2025  
> **Source of Truth** pro signály v Portfolio Tracker

---

## Obsah

1. [Přehled systému](#1-přehled-systému)
2. [Kategorie signálů](#2-kategorie-signálů)
3. [Action Signals (Akční signály)](#3-action-signals-akční-signály)
4. [Quality Signals (Kvalitativní signály)](#4-quality-signals-kvalitativní-signály)
5. [Signal Flow Logic](#5-signal-flow-logic)
6. [Prahové hodnoty](#6-prahové-hodnoty)
7. [Data validace](#7-data-validace)
8. [Holdings vs Research rozdíly](#8-holdings-vs-research-rozdíly)
9. [UI zobrazení](#9-ui-zobrazení)
10. [Debugging](#10-debugging)

---

## 1. Přehled systému

### Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIGNAL GENERATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT DATA                                                      │
│  ├── AnalystData (Finnhub)     → Consensus, recommendations     │
│  ├── TechnicalData (Yahoo)     → RSI, MACD, Bollinger, ADX      │
│  ├── NewsArticles              → Sentiment score                 │
│  └── PortfolioContext          → Weight, avg price, gain        │
│                                                                  │
│          ↓                                                       │
│                                                                  │
│  SCORING (6 kategorií)                                          │
│  ├── Fundamental Score    0-140b  (28% Holdings / 35% Research) │
│  ├── Technical Score      0-120b  (24% / 30%)                   │
│  ├── Analyst Score        0-80b   (16% / 20%)                   │
│  ├── News+Insider Score   0-60b   (12% / 15%)                   │
│  └── Portfolio Score      0-100b  (20% / 0%) ← Holdings only    │
│                                                                  │
│          ↓                                                       │
│                                                                  │
│  DERIVED METRICS                                                 │
│  ├── Composite Score      0-500 (Holdings) / 0-400 (Research)   │
│  ├── Conviction Score     0-100 → HIGH/MEDIUM/LOW               │
│  └── DIP Score            0-100 + Quality Check                 │
│                                                                  │
│          ↓                                                       │
│                                                                  │
│  SIGNAL GENERATION                                               │
│  ├── Action Signal (1x)   → Co dělat (DIP, HOLD, TRIM...)      │
│  └── Quality Signal (1x)  → Hodnocení kvality (CONVICTION...)   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Klíčové principy

1. **Každá akcie dostane max 2 signály:** 1 action + 1 quality
2. **Prioritní systém:** Signály se vyhodnocují v pořadí priority (nižší = vyšší priorita)
3. **První vyhovující vyhrává:** Jakmile podmínky splní jeden signál, další v kategorii se netestují
4. **Fallback garantován:** HOLD/NEUTRAL jako záchytné signály když nic nesedí
5. **Data validace:** Signály se generují jen pro akcie s kompletními daty

---

## 2. Kategorie signálů

### Action Signals (14 typů)

| Signál               | Priorita | Badge Class          | Popis                              |
| -------------------- | -------- | -------------------- | ---------------------------------- |
| `DIP_OPPORTUNITY`    | 1        | `dip`                | Přeprodané s kvalitními fundamenty |
| `BREAKOUT`           | 2        | `breakout`           | Cenový průlom s vysokým objemem    |
| `REVERSAL`           | 3        | `reversal`           | MACD divergence naznačuje obrat    |
| `MOMENTUM`           | 4        | `momentum`           | Býčí technický trend               |
| `ACCUMULATE`         | 5        | `accumulate`         | Kvalitní akcie, prostor pro DCA    |
| `GOOD_ENTRY`         | 6        | `good-entry`         | **Research:** Pod cílem analytiků  |
| `WAIT_FOR_DIP`       | 7        | `wait`               | **Holdings:** Kvalitní, ale drahá  |
| `NEAR_TARGET`        | 8        | `target`             | Blízko cílové ceny                 |
| `TAKE_PROFIT`        | 9        | `take-profit`        | Vysoký zisk, zvážit realizaci      |
| `CONSIDER_TRIM`      | 10       | `trim`               | Překoupeno + vysoká váha           |
| `HOLD`               | 11       | `hold`               | Kvalitní, bez specifické akce      |
| `FUNDAMENTALLY_WEAK` | 12       | `fundamentally-weak` | Slabé fundamenty, OK technika      |
| `TECHNICALLY_WEAK`   | 13       | `technically-weak`   | OK fundamenty, slabá technika      |
| `PROBLEMATIC`        | 14       | `problematic`        | Obojí slabé                        |

### Quality Signals (9 typů)

| Signál         | Priorita | Badge Class    | Popis                          |
| -------------- | -------- | -------------- | ------------------------------ |
| `CONVICTION`   | 15       | `conviction`   | Nejvyšší kvalita, long-term    |
| `QUALITY_CORE` | 16       | `quality`      | Silné fundamenty + analytici   |
| `UNDERVALUED`  | 17       | `undervalued`  | 30%+ potenciál růstu           |
| `STRONG_TREND` | 18       | `strong-trend` | Silný ADX trend                |
| `STEADY`       | 19       | `steady`       | Solidní, bez akce              |
| `WATCH`        | 20       | `watch`        | Některé metriky se zhoršují    |
| `WEAK`         | 21       | `weak`         | Slabé fundamenty/technika      |
| `OVERBOUGHT`   | 22       | `overbought`   | RSI + Stochastic překoupeno    |
| `NEUTRAL`      | 24       | `neutral`      | Žádné silné signály (fallback) |

---

## 3. Action Signals (Akční signály)

### 3.1 DIP_OPPORTUNITY

**Účel:** Identifikace přeprodaných akcií s kvalitními fundamenty = nákupní příležitost.

**Podmínky:**

```typescript
dipScore >= 50 && dipQualityPasses === true;
```

**DIP Score komponenty (0-100):**
| Komponenta | Max bodů | Podmínky |
| ------------------ | -------- | ------------------------------------- |
| RSI Based | 25 | RSI < 25: 25b, < 30: 20b, < 35: 15b |
| Bollinger Position | 20 | Pod lower band: 15-20b |
| 200-MA Position | 20 | >15% pod 200-MA: 20b |
| 52-Week Position | 15 | >30% pod 52W high: 15b |
| MACD Divergence | 10 | Bullish divergence: 10b |
| Volume Confirm | 10 | 2× avg volume: 10b (kapitulace) |

**DIP Quality Check (musí projít!):**

```typescript
fundamentalScore >= 35b (25% z 140)  // Fundamenty OK
analystScore >= 24b (30% z 80)        // Analytici ne-bearish
newsScore >= 10.5b (30% z 35)         // Zprávy ne-negativní
```

**Use case:**

- Apple spadl -25% na špatných zprávách, ale fundamenty silné
- RSI = 28, pod Bollingerem, MACD bullish divergence
- → DIP_OPPORTUNITY s strength 65

---

### 3.2 BREAKOUT

**Účel:** Zachycení cenového průlomu potvrzeného objemem.

**Podmínky:**

```typescript
bollingerSignal === 'overbought' &&
  volumeSignal === 'high' &&
  technicalScore >= 60; // TECH_STRONG
```

**Use case:**

- Tesla prorazila nad Bollinger s 2.5× průměrným objemem
- Technické skóre 78
- → BREAKOUT signál

---

### 3.3 REVERSAL

**Účel:** Včasné zachycení potenciálního obratu trendu.

**Podmínky:**

```typescript
macdDivergence === 'bullish' && rsiValue < 40;
```

**Use case:**

- Akcie v klesajícím trendu, ale MACD tvoří vyšší low
- RSI = 35 (blízko přeprodanosti)
- → REVERSAL signál naznačuje možný obrat

---

### 3.4 MOMENTUM

**Účel:** Identifikace akcií v silném býčím trendu.

**Podmínky:**

```typescript
technicalScore >= 60 && // TECH_STRONG
  rsiValue > 45 &&
  rsiValue < 70; // RSI_OVERBOUGHT
```

**Use case:**

- NVDA s technical score 72
- RSI = 58 (zdravé momentum, ne překoupeno)
- → MOMENTUM signál

---

### 3.5 ACCUMULATE

**Účel:** Doporučení pro DCA u kvalitních akcií v mírném poklesu.

**Podmínky:**

```typescript
convictionLevel !== 'LOW' &&
  dipScore >= 15 && // DIP_ACCUMULATE_MIN (rozšířeno z 20)
  dipScore < 50 && // DIP_ACCUMULATE_MAX
  fundamentalScore >= 40; // FUND_MODERATE (40% z 140 = 56b)
```

**Use case:**

- Microsoft s conviction MEDIUM
- Dip score 32 (mírný pokles)
- Fundamenty 85b
- → ACCUMULATE signál pro postupný nákup

---

### 3.6 GOOD_ENTRY ⚠️ Research only

**Účel:** Identifikace kvalitních akcií pod cílovou cenou analytiků.

**Podmínky:**

```typescript
isResearch === true &&
  targetUpside >= 15 &&
  fundamentalScore >= 40 && // FUND_MODERATE
  convictionLevel !== 'LOW';
```

**Use case:**

- Zkoumám novou akcii v Research
- Analyst target = $150, current = $120 (+25% upside)
- Fundamenty solidní
- → GOOD_ENTRY signál

---

### 3.7 WAIT_FOR_DIP ⚠️ Holdings only

**Účel:** Upozornění na kvalitní akcii, která je momentálně příliš drahá na dokupování.

**Podmínky:**

```typescript
isResearch === false && // Portfolio only
  convictionLevel !== 'LOW' &&
  fundamentalScore >= 40 &&
  dipScore < 15 && // Není v dip territory
  rsiValue > 55; // Není přeprodáno
```

**Use case:**

- Vlastním AAPL, chci dokoupit
- RSI = 62, dip score = 8
- → WAIT_FOR_DIP - počkej na lepší cenu

---

### 3.8 NEAR_TARGET

**Účel:** Upozornění že se akcie blíží k cílové ceně.

**Podmínky:**

```typescript
targetUpside <= 10 && // TARGET_NEAR (10%)
  targetUpside > 0;
```

**Use case:**

- Target = $105, current = $98 (+7% upside)
- → NEAR_TARGET - zvažte strategii výstupu

---

### 3.9 TAKE_PROFIT

**Účel:** Připomenutí realizace zisku u velkých gains.

**Podmínky:**

```typescript
gainPercentage >= 50 && // GAIN_TAKE_PROFIT
  convictionLevel !== 'HIGH';
```

**Use case:**

- Nákup za $50, aktuálně $82 (+64%)
- Conviction MEDIUM
- → TAKE_PROFIT signál

---

### 3.10 CONSIDER_TRIM

**Účel:** Doporučení redukce převážené pozice.

**Podmínky:**

```typescript
rsiValue > 70 && // RSI_OVERBOUGHT
  weight > 8; // WEIGHT_OVERWEIGHT
```

**Use case:**

- MSFT tvoří 12% portfolia
- RSI = 75 (překoupeno)
- → CONSIDER_TRIM

---

### 3.11 HOLD

**Účel:** Fallback pro kvalitní akcie bez specifické akce.

**Podmínky:**

```typescript
isResearch === false &&  // Portfolio only
fundamentalScore >= 40 &&
convictionLevel !== 'LOW' &&
// Žádný předchozí action signál
```

**Use case:**

- Kvalitní akcie v portfoliu
- RSI = 52 (neutrální)
- Dip score = 25 (nic zajímavého)
- → HOLD signál

---

### 3.12-3.14 Negativní signály

**FUNDAMENTALLY_WEAK:**

```typescript
isResearch === false && fundamentalScore < 40 && technicalScore >= 35; // TECH_MODERATE
```

**TECHNICALLY_WEAK:**

```typescript
isResearch === false && fundamentalScore >= 40 && technicalScore < 35;
```

**PROBLEMATIC:**

```typescript
isResearch === false && fundamentalScore < 40 && technicalScore < 35;
```

---

## 4. Quality Signals (Kvalitativní signály)

### 4.1 CONVICTION

**Účel:** Identifikace top-tier akcií pro dlouhodobé držení.

**Podmínky:**

```typescript
convictionLevel === 'HIGH'; // convictionScore >= 70
```

**Conviction Score komponenty (0-100):**
| Kategorie | Max bodů | Metriky |
| ------------------- | -------- | ------------------------------------ |
| ROE | 12 | >20%: 12, >15%: 9, >10%: 5 |
| Revenue Growth 5Y | 10 | >15%: 10, >10%: 7, >5%: 4 |
| Net Margin | 10 | >20%: 10, >12%: 7, >5%: 3 |
| Low Debt | 8 | D/E <0.5: 8, <1: 5, <2: 2 |
| Analyst Consensus | 12 | consensus >0.5: min(12, score×6) |
| Target Upside | 10 | >25%: 10, >15%: 7, >5%: 3 |
| Earnings Beats | 8 | 4/4: 8, 3/4: 6, 2/4: 3 |
| Insider Buying | 12 | insiderScore >65: 12 |
| 200-MA Position | 10 | >5% nad 200-MA: 10 |
| Volume Health | 8 | Vol >120% avg: 8 |

---

### 4.2 QUALITY_CORE

**Podmínky:**

```typescript
fundamentalScore >= 60 && // FUND_QUALITY (84b z 140)
  analystScore >= 55; // ANALYST_QUALITY (44b z 80)
```

---

### 4.3 UNDERVALUED

**Podmínky:**

```typescript
targetUpside >= 30 && // TARGET_UPSIDE_HIGH
  fundamentalScore >= 40; // FUND_MODERATE
```

---

### 4.4 STRONG_TREND

**Podmínky:**

```typescript
adxValue >= 25 && // ADX_STRONG
  adxTrend === 'bullish';
```

---

### 4.5 STEADY

**Podmínky:**

```typescript
fundamentalScore >= 40 && // FUND_MODERATE
  technicalScore >= 35 && // TECH_MODERATE
  convictionLevel !== 'LOW';
```

---

### 4.6 OVERBOUGHT

**Podmínky:**

```typescript
rsiValue > 70 && stochK > 80;
```

---

### 4.7 WATCH

**Podmínky:**

```typescript
fundamentalScore < 35 || // FUND_WATCH
  insiderScore < 35 || // INSIDER_WEAK
  newsScore < 40; // NEWS_WATCH
```

---

### 4.8 WEAK

**Podmínky:**

```typescript
fundamentalScore < 25 || // FUND_WEAK (35b z 140)
  technicalScore < 30; // TECH_WEAK (36b z 120)
```

---

### 4.9 NEUTRAL

**Fallback signál** - přiřazen vždy, když žádný jiný quality signál nesplňuje podmínky.

---

## 5. Signal Flow Logic

### Algoritmus generování signálů

```
START
  │
  ├─► Zkontroluj DIP_OPPORTUNITY
  │     ├─ dipScore >= 50 && qualityCheck? → PŘIŘAĎ, KONEC ACTION
  │     └─ ne → pokračuj
  │
  ├─► Zkontroluj BREAKOUT
  │     ├─ podmínky splněny? → PŘIŘAĎ, KONEC ACTION
  │     └─ ne → pokračuj
  │
  ├─► Zkontroluj REVERSAL
  │     └─ ... (podobně)
  │
  ├─► Zkontroluj MOMENTUM
  │     └─ ...
  │
  ├─► Zkontroluj ACCUMULATE
  │     └─ ...
  │
  ├─► Zkontroluj GOOD_ENTRY (pouze Research)
  │     └─ ...
  │
  ├─► Zkontroluj WAIT_FOR_DIP (pouze Holdings)
  │     └─ ...
  │
  ├─► Zkontroluj NEAR_TARGET
  │     └─ ...
  │
  ├─► Zkontroluj TAKE_PROFIT
  │     └─ ...
  │
  ├─► Zkontroluj CONSIDER_TRIM
  │     └─ ...
  │
  ├─► Zkontroluj HOLD (pouze Holdings, fallback kvalitních)
  │     └─ ...
  │
  ├─► Zkontroluj FUNDAMENTALLY_WEAK
  │     └─ ...
  │
  ├─► Zkontroluj TECHNICALLY_WEAK
  │     └─ ...
  │
  └─► PROBLEMATIC (ostatní nekvalitní akcie v Holdings)
        └─ Pokud stále žádný action signál

  // Opakuj stejně pro QUALITY signály
  // NEUTRAL je vždy fallback
```

---

## 6. Prahové hodnoty

```typescript
const SIGNAL_THRESHOLDS = {
  // === Technical (max 120b) ===
  TECH_STRONG: 60, // 72b - pro MOMENTUM
  TECH_MODERATE: 35, // 42b - pro STEADY, HOLD
  TECH_WEAK: 30, // 36b - pro WEAK quality

  // === Fundamental (max 140b) ===
  FUND_QUALITY: 60, // 84b - pro QUALITY_CORE
  FUND_STRONG: 50, // 70b
  FUND_MODERATE: 40, // 56b - pro HOLD, ACCUMULATE
  FUND_WATCH: 35, // 49b - pro WATCH quality
  FUND_WEAK: 25, // 35b - pro WEAK quality

  // === Analyst (max 80b) ===
  ANALYST_QUALITY: 55, // 44b - pro QUALITY_CORE

  // === Insider (max 25b) ===
  INSIDER_WEAK: 35, // 9b - pro WATCH

  // === News (max 35b) ===
  NEWS_WATCH: 40, // 14b - pro WATCH

  // === DIP ===
  DIP_TRIGGER: 50, // Minimální dip score pro DIP_OPPORTUNITY
  DIP_ACCUMULATE_MIN: 15, // Min pro ACCUMULATE
  DIP_ACCUMULATE_MAX: 50, // Max pro ACCUMULATE (jinak je to už DIP)

  // === Position ===
  WEIGHT_OVERWEIGHT: 8, // Pro CONSIDER_TRIM
  WEIGHT_MAX: 15, // Absolutní max váha

  // === Target ===
  TARGET_NEAR: 10, // 10% do cíle = NEAR_TARGET
  TARGET_UPSIDE_HIGH: 30, // 30%+ = UNDERVALUED
  TARGET_LOW_UPSIDE: 5, // <5% = omezený potenciál

  // === Gain ===
  GAIN_TAKE_PROFIT: 50, // 50%+ zisk = TAKE_PROFIT

  // === RSI ===
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,

  // === ADX ===
  ADX_STRONG: 25, // Silný trend
  ADX_WEAK: 20, // Slabý/žádný trend
};
```

---

## 7. Data validace

### Požadovaná data pro generování signálů

Signály se generují **pouze** pro akcie které mají **všechna** následující data:

| Typ dat          | Podmínka validity                                                              |
| ---------------- | ------------------------------------------------------------------------------ |
| **Price**        | `currentPrice` je číslo > 0                                                    |
| **Analyst**      | `hasPrice` AND (`recommendationKey` OR `consensusScore` OR `numberOfAnalysts`) |
| **Fundamentals** | Alespoň 2 fundamentální metriky jako čísla (PE, ROE, margin...)                |
| **Technical**    | `rsi14` OR `macd` je reálné číslo (ne null/undefined)                          |

### Validační logika (Analysis.tsx)

```typescript
const isValid = hasPrice && hasAnalyst && hasFundamentals && hasTech;

// Pouze validní akcie dostávají signály
const validEnriched = enriched.filter((stock) => {
  const status = stockStatuses.find((s) => s.ticker === stock.ticker);
  return status?.isValid ?? false;
});

const recs = generateAllRecommendations(
  validEnriched,
  techData,
  news,
  timeRange
);
```

### Debug panel

Debug panel v Analysis zobrazuje status dat pro každou akcii:

| Sloupec | Význam                                   |
| ------- | ---------------------------------------- |
| Ticker  | Symbol akcie                             |
| Analyst | ✓/✗ Má analyst data                      |
| Fund.   | ✓/✗ Má fundamentální data                |
| Tech    | ✓/○ Má technická data (○ = chybí)        |
| News    | ✓/○ Má novinky (○ = chybí, není povinné) |
| Valid   | ✓/✗ Celková validita pro signály         |

**Rate limit indikace:**

- Finnhub: API limit překročen
- Yahoo: API limit překročen

---

## 8. Holdings vs Research rozdíly

### Signály dostupné pouze v kontextu

| Signál               | Holdings | Research | Důvod                               |
| -------------------- | -------- | -------- | ----------------------------------- |
| `GOOD_ENTRY`         | ❌       | ✅       | Research: hledání nových pozic      |
| `WAIT_FOR_DIP`       | ✅       | ❌       | Holdings: čekat na lepší cenu k DCA |
| `HOLD`               | ✅       | ❌       | Holdings: akce "drž co máš"         |
| `FUNDAMENTALLY_WEAK` | ✅       | ❌       | Holdings: varování o pozici         |
| `TECHNICALLY_WEAK`   | ✅       | ❌       | Holdings: varování o pozici         |
| `PROBLEMATIC`        | ✅       | ❌       | Holdings: varování o pozici         |
| `TAKE_PROFIT`        | ✅       | ❌       | Holdings: má unrealized gain        |
| `CONSIDER_TRIM`      | ✅       | ❌       | Holdings: má weight                 |

### Scoring rozdíly

| Aspekt          | Holdings (500b) | Research (400b)          |
| --------------- | --------------- | ------------------------ |
| Portfolio Score | 100b (20%)      | Vynecháno (0%)           |
| Target Price    | Z DB (osobní)   | Z Yahoo (analyst target) |
| Weight data     | ✅ Dostupná     | ❌ Není                  |
| Gain data       | ✅ Dostupná     | ❌ Není                  |

---

## 9. UI zobrazení

### Badge varianty (Typography.css)

```css
/* Action signály - pozitivní */
.badge--dip {
  background: #1a5f2a;
  color: white;
}
.badge--breakout {
  background: #155724;
  color: white;
}
.badge--reversal {
  background: #1e7e34;
  color: white;
}
.badge--momentum {
  background: #28a745;
  color: white;
}
.badge--accumulate {
  background: #20c997;
  color: white;
}
.badge--good-entry {
  background: #17a2b8;
  color: white;
}

/* Action signály - neutrální */
.badge--wait {
  background: #6c757d;
  color: white;
}
.badge--target {
  background: #fd7e14;
  color: white;
}
.badge--hold {
  background: #6c757d;
  color: white;
}

/* Action signály - varování */
.badge--take-profit {
  background: #ffc107;
  color: #212529;
}
.badge--trim {
  background: #e67e22;
  color: white;
}

/* Action signály - negativní */
.badge--fundamentally-weak {
  background: #856404;
  color: white;
}
.badge--technically-weak {
  background: #856404;
  color: white;
}
.badge--problematic {
  background: #721c24;
  color: white;
}

/* Quality signály */
.badge--conviction {
  background: linear-gradient(135deg, #1a5f2a, #28a745);
}
.badge--quality {
  background: #155724;
  color: white;
}
.badge--undervalued {
  background: #17a2b8;
  color: white;
}
.badge--strong-trend {
  background: #28a745;
  color: white;
}
.badge--steady {
  background: #6c757d;
  color: white;
}
.badge--watch {
  background: #856404;
  color: white;
}
.badge--weak {
  background: #dc3545;
  color: white;
}
.badge--overbought {
  background: #e67e22;
  color: white;
}
.badge--neutral {
  background: #6c757d;
  color: white;
}
```

### Tile header coloring (Recommendations.css)

```css
/* Pozitivní signály - zelené odstíny */
.tile-signal-header--dip {
  background: linear-gradient(...);
}
.tile-signal-header--breakout {
  background: linear-gradient(...);
}
.tile-signal-header--momentum {
  background: linear-gradient(...);
}
.tile-signal-header--accumulate {
  background: linear-gradient(...);
}

/* Neutrální signály - šedé */
.tile-signal-header--hold {
  background: linear-gradient(...);
}
.tile-signal-header--wait {
  background: linear-gradient(...);
}

/* Varování - oranžové */
.tile-signal-header--take-profit {
  background: linear-gradient(...);
}
.tile-signal-header--trim {
  background: linear-gradient(...);
}

/* Negativní - červené */
.tile-signal-header--problematic {
  background: linear-gradient(...);
}
```

### SignalBadge component

```typescript
// src/components/shared/SignalBadge/SignalBadge.tsx

const CLASS_TO_VARIANT: Record<string, BadgeVariant> = {
  // Action
  dip: 'dip',
  breakout: 'breakout',
  reversal: 'reversal',
  momentum: 'momentum',
  accumulate: 'accumulate',
  'good-entry': 'good-entry',
  wait: 'wait',
  target: 'target',
  'take-profit': 'take-profit',
  trim: 'trim',
  hold: 'hold',
  'fundamentally-weak': 'fundamentally-weak',
  'technically-weak': 'technically-weak',
  problematic: 'problematic',

  // Quality
  conviction: 'conviction',
  quality: 'quality',
  undervalued: 'undervalued',
  'strong-trend': 'strong-trend',
  steady: 'steady',
  watch: 'watch',
  weak: 'weak',
  overbought: 'overbought',
  neutral: 'neutral',
};
```

---

## 10. Debugging

### Console logy

Pokud akcie nedostane action signál, generuje se debug log:

```typescript
console.log(`[DEBUG] No action signal for ${ticker}:`, {
  dipScore,
  dipQualityPasses,
  technicalScore,
  fundamentalScore,
  rsiValue,
  convictionLevel,
  targetUpside,
  gainPercentage,
  weight,
  bollingerSignal,
  volumeSignal,
  macdDivergence,
  isResearch,
  thresholds: { ... }
});
```

### Explanation object

Každá `StockRecommendation` obsahuje `explanation` objekt:

```typescript
interface SignalExplanation {
  technicalIndicators: { rsi14, macdHistogram, stochK, adx, ... };
  fundamentalData: { peRatio, roe, debtToEquity, ... };
  analystData: { targetPrice, upside, strongBuy, buy, ... };
  scoreBreakdown: { fundamental, technical, analyst, news, insider, portfolio };
  signalEvaluation: SignalEvaluationResult[];  // Každý signál + jeho podmínky
  decisionPath: {
    actionSignal: { chosen, reason };
    qualitySignal: { chosen, reason };
  };
  thresholds: SIGNAL_THRESHOLDS;
}
```

### Debug panel (Analysis)

1. Klikni na debug header (horní lišta s počty)
2. Rozbalí se tabulka se statusem všech akcií
3. ✓ = data OK, ✗ = chybí povinná data, ○ = chybí nepovinná data

### Filtry v Recommendations

Recommendations UI podporuje filtrování podle action signálů:

```typescript
type FilterType =
  | 'all'
  | 'dip'
  | 'breakout'
  | 'reversal'
  | 'momentum'
  | 'accumulate'
  | 'good-entry'
  | 'wait'
  | 'target'
  | 'take-profit'
  | 'trim'
  | 'hold'
  | 'fundamentally-weak'
  | 'technically-weak'
  | 'problematic';
```

---

## Appendix: Quick Reference Card

### Kdy dostanu který signál?

| Situace                           | Action Signal      | Quality Signal |
| --------------------------------- | ------------------ | -------------- |
| RSI=25, fundamenty OK             | DIP_OPPORTUNITY    | záleží         |
| RSI=55, tech score 75, momentum   | MOMENTUM           | STRONG_TREND?  |
| Conviction HIGH, RSI=50           | HOLD/ACCUMULATE    | CONVICTION     |
| +60% gain, conviction MEDIUM      | TAKE_PROFIT        | záleží         |
| RSI=75, weight=12%                | CONSIDER_TRIM      | OVERBOUGHT     |
| Research, +25% upside, fund OK    | GOOD_ENTRY         | UNDERVALUED    |
| Holdings, kvalitní, RSI=60, dip=8 | WAIT_FOR_DIP       | STEADY         |
| Fund 30, tech 45                  | FUNDAMENTALLY_WEAK | WATCH          |
| Fund 50, tech 25                  | TECHNICALLY_WEAK   | WATCH          |
| Fund 25, tech 20                  | PROBLEMATIC        | WEAK           |

---

**Poznámka:** Při změně signálové logiky **vždy aktualizuj tuto dokumentaci!**
