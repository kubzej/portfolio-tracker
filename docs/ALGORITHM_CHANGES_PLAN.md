# Plán úprav algoritmů

> **Vytvořeno:** 1. prosince 2025
> **Verze:** 3.1 (500-bodový systém + Exit Strategy)

---

## Přehled systému

```
┌─────────────────────────────────────────────────────────────────┐
│                    500-BODOVÝ SYSTÉM                            │
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

---

## Přehled změn

| #   | Oblast            | Popis                           | Docs | Kód |
| --- | ----------------- | ------------------------------- | ---- | --- |
| 1   | P/E Scoring       | PEG (20b) + absolutní P/E (20b) | ✅   | ⬜  |
| 2   | ROE Scoring       | Pásma + D/E penalty (30b)       | ✅   | ⬜  |
| 3   | Net Margin        | Rozšířeno na 25b                | ✅   | ⬜  |
| 4   | Revenue Gr.       | Rozšířeno na 25b                | ✅   | ⬜  |
| 5   | D/E               | Sníženo na 10b                  | ✅   | ⬜  |
| 6   | Current Ratio     | Sníženo na 10b                  | ✅   | ⬜  |
| 7   | RSI               | 15b (bez změny)                 | ✅   | ⬜  |
| 8   | MACD              | Navýšeno na 35b 👑              | ✅   | ⬜  |
| 9   | Bollinger         | 10b (bez změny)                 | ✅   | ⬜  |
| 10  | ADX               | Navýšeno na 25b                 | ✅   | ⬜  |
| 11  | 200-day MA        | Navýšeno na 25b                 | ✅   | ⬜  |
| 12  | Volume            | 10b (bez změny)                 | ✅   | ⬜  |
| 13  | Consensus         | Sníženo na 50b                  | ✅   | ⬜  |
| 14  | Coverage          | Sníženo na 15b                  | ✅   | ⬜  |
| 15  | Target Upside     | Sníženo na 10b                  | ✅   | ⬜  |
| 16  | Agreement         | Sníženo na 5b                   | ✅   | ⬜  |
| 17  | News Sentiment    | **NOVÝ** sloučený (35b)         | ✅   | ⬜  |
| 18  | Insider Score     | **NOVÝ** sloučený (25b)         | ✅   | ⬜  |
| 19  | P. Target Up      | Navýšeno na 35b                 | ✅   | ⬜  |
| 20  | P. Distance       | 25b (bez změny)                 | ✅   | ⬜  |
| 21  | P. Weight         | Sníženo na 20b                  | ✅   | ⬜  |
| 22  | P. Unreal.Gain    | Sníženo na 20b                  | ✅   | ⬜  |
| --- | **v3.1 ZMĚNY**    | ---------------------------     | --   | --  |
| 23  | Conviction Score  | 200-MA + Volume Health          | ✅   | ⬜  |
| 24  | DIP Score         | MACD Div + Volume Confirm       | ✅   | ⬜  |
| 25  | Signal Thresholds | Přepočet na % škálu             | ✅   | ⬜  |
| 26  | Buy Strategy      | Position Trading pravidla       | ✅   | ⬜  |
| 27  | Exit Strategy     | **NOVÁ** sekce 11               | ✅   | ⬜  |

---

## Implementace

**Soubory k úpravě:**

1. `src/utils/recommendations.ts` - hlavní scoring logika
2. `supabase/functions/fetch-technical-data/index.ts` - přidat `macdDivergence`

### Kroky implementace:

1. [ ] Upravit `calculateFundamentalScore()` - změny 1-6 (140b)
2. [ ] Upravit `calculateTechnicalScore()` - změny 7-12 (120b)
3. [ ] Upravit `calculateAnalystScore()` - změny 13-16 (80b)
4. [ ] Sloučit News+Insider do `calculateNewsInsiderScore()` (60b)
5. [ ] Upravit `calculatePortfolioScore()` - změny 19-22 (100b)
6. [ ] Upravit composite score výpočet (400/500b)
7. [ ] Přidat MACD divergence detekci do edge function
8. [ ] Přidat UI popisky jako konstanty
9. [ ] Otestovat na reálných datech

---

## FUNDAMENTAL SCORE (140 bodů)

### 1. P/E Scoring (40b celkem)

#### PEG Score (20b)

| PEG       | Body | UI Label              | UI Interpretace                                                                                      |
| --------- | ---- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| 0.5 - 1.2 | 20   | "Ideální ocenění"     | "Cena akcie odpovídá růstu zisků. PEG kolem 1 znamená, že platíte férovou cenu za očekávaný růst."   |
| 1.2 - 2.0 | 15   | "Mírně drahé vs růst" | "Akcie je lehce nadhodnocená vzhledem k růstu. Trh očekává lepší výsledky, než analytici predikují." |
| 0.3 - 0.5 | 10   | "Velmi levné"         | "Nízké PEG může znamenat příležitost, ale ověřte proč je tak levné. Může signalizovat rizika."       |
| 2.0 - 3.0 | 5    | "Drahé vs růst"       | "Platíte vysokou prémii za růst. Jakékoliv zklamání ve výsledcích může vést k poklesu ceny."         |
| <0.3      | 0    | "Extrémně levné"      | "Buď trh podceňuje potenciál, nebo existují vážná rizika. Důkladně prověřte fundamenty."             |
| >3.0      | 0    | "Extrémně drahé"      | "Valuace neodpovídá růstu. Vysoké riziko korekce, pokud firma nesplní vysoká očekávání."             |
| null/záp. | -    | "N/A"                 | "PEG nelze spočítat (záporný růst nebo zisk). Použijte jiné metriky pro ocenění."                    |

#### Absolutní P/E (20b)

| P/E          | Body | UI Label            | UI Interpretace                                                             |
| ------------ | ---- | ------------------- | --------------------------------------------------------------------------- |
| 10 - 20      | 20   | "Férové ocenění"    | "Standardní valuace pro ziskové společnosti. Přiměřená cena za zisky."      |
| 7-10 / 20-30 | 15   | "Levné / Dražší"    | "Pod/nad průměrem trhu. Může být příležitost, nebo trh vidí růst/problémy." |
| 5-7 / 30-40  | 8    | "Velmi levné/drahé" | "Výrazně mimo normu. Prověřte důvody."                                      |
| <5 / 40-60   | 3    | "Extrémní"          | "Varování: buď mimořádná příležitost, nebo spekulativní valuace."           |
| <0 / >60     | 0    | "Ztrátové/Extrém"   | "P/E není relevantní metrika nebo spekulativní valuace."                    |

**Fallback:** `pegRatio` null → max 20b z absolutního P/E

---

### 2. ROE Scoring (30b celkem)

#### Base ROE Score

| ROE  | Body | UI Label                  | UI Interpretace                                                                                         |
| ---- | ---- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| >25% | 30   | "Vynikající rentabilita"  | "Společnost excelentně zhodnocuje kapitál akcionářů. Typické pro kvalitní firmy s konkurenční výhodou." |
| >18% | 24   | "Velmi dobrá rentabilita" | "Nadprůměrné zhodnocení kapitálu. Firma efektivně využívá prostředky akcionářů."                        |
| >12% | 18   | "Dobrá rentabilita"       | "Solidní výnosnost odpovídající průměru kvalitních firem."                                              |
| >5%  | 9    | "Průměrná rentabilita"    | "Akceptovatelné, ale bez výrazné konkurenční výhody."                                                   |
| 0-5% | 4    | "Slabá rentabilita"       | "Nízká efektivita využití kapitálu. Společnost negeneruje dostatečnou hodnotu."                         |
| <0%  | 0    | "Záporná rentabilita"     | "Firma je ztrátová. Kapitál akcionářů se zmenšuje."                                                     |

#### D/E Penalty (pokud D/E > 1.5)

| ROE  | Penalty | UI Label (přípona) | UI Interpretace                                                                         |
| ---- | ------- | ------------------ | --------------------------------------------------------------------------------------- |
| >25% | -6      | "(vysoký dluh)"    | "Pozor: vysoké ROE je částečně způsobeno pákou. Při problémech je firma zranitelnější." |
| >18% | -5      | "(vysoký dluh)"    | "Pozor: vysoké ROE je částečně způsobeno pákou. Při problémech je firma zranitelnější." |
| >12% | -3      | "(vysoký dluh)"    | "Pozor: vysoké ROE je částečně způsobeno pákou. Při problémech je firma zranitelnější." |
| ≤12% | 0       | -                  | -                                                                                       |

---

### 3. Net Margin (25b)

| Net Margin | Body | UI Label            | UI Interpretace                                                                  |
| ---------- | ---- | ------------------- | -------------------------------------------------------------------------------- |
| >25%       | 25   | "Vynikající marže"  | "Výjimečná ziskovost. Firma má silnou cenovou sílu nebo velmi efektivní provoz." |
| >15%       | 20   | "Velmi dobrá marže" | "Nadprůměrná ziskovost indikující konkurenční výhodu."                           |
| >8%        | 13   | "Dobrá marže"       | "Zdravá ziskovost odpovídající dobře řízeným firmám."                            |
| >0%        | 6    | "Nízká marže"       | "Malý prostor pro chyby. Konkurenční prostředí nebo vysoké náklady."             |
| ≤0%        | 0    | "Ztrátová"          | "Firma prodělává na každé koruně tržeb."                                         |

---

### 4. Revenue Growth (25b)

| Revenue Gr. | Body | UI Label         | UI Interpretace                                                             |
| ----------- | ---- | ---------------- | --------------------------------------------------------------------------- |
| >25%        | 25   | "Silný růst"     | "Dynamicky rostoucí firma. Typické pro růstové akcie s expandujícím trhem." |
| >15%        | 20   | "Dobrý růst"     | "Nadprůměrný růst signalizující zdravý byznys model."                       |
| >5%         | 13   | "Mírný růst"     | "Stabilní růst odpovídající zralým firmám."                                 |
| >0%         | 6    | "Minimální růst" | "Stagnující tržby. Firma může mít problém s expanzí."                       |
| ≤0%         | 0    | "Pokles tržeb"   | "Klesající tržby jsou varováním. Ověřte příčinu a zda je dočasná."          |

---

### 5. D/E Ratio (10b)

| D/E  | Body | UI Label            | UI Interpretace                                                                     |
| ---- | ---- | ------------------- | ----------------------------------------------------------------------------------- |
| <0.3 | 10   | "Minimální dluh"    | "Konzervativní financování. Firma je finančně velmi stabilní."                      |
| <0.7 | 8    | "Nízký dluh"        | "Zdravá míra zadlužení. Dobrá rovnováha mezi pákou a bezpečností."                  |
| <1.5 | 5    | "Střední dluh"      | "Průměrné zadlužení. Sledujte úrokové náklady a cash flow."                         |
| <2.5 | 2    | "Vysoký dluh"       | "Vyšší riziko při ekonomických problémech. Firma je závislá na schopnosti splácet." |
| ≥2.5 | 0    | "Velmi vysoký dluh" | "Vysoké finanční riziko. Jakékoliv problémy s cash flow mohou být kritické."        |

---

### 6. Current Ratio (10b)

| Curr. Ratio | Body | UI Label               | UI Interpretace                                                             |
| ----------- | ---- | ---------------------- | --------------------------------------------------------------------------- |
| >2.0        | 10   | "Silná likvidita"      | "Firma má dostatek krátkodobých aktiv na pokrytí závazků. Bezpečná pozice." |
| >1.5        | 8    | "Dobrá likvidita"      | "Zdravá likviditní pozice bez zjevných rizik."                              |
| >1.0        | 5    | "Dostatečná likvidita" | "Na hraně. Krátkodobá aktiva pokrývají závazky, ale bez rezervy."           |
| >0.5        | 2    | "Nízká likvidita"      | "Varování: firma může mít problém platit krátkodobé závazky."               |
| ≤0.5        | 0    | "Kritická likvidita"   | "Vážné riziko. Firma nemá dostatek prostředků na běžné závazky."            |

---

## TECHNICAL SCORE (120 bodů)

> **Horizont:** Měsíční až roční (position trading / swing na delší vlnu)
>
> Optimalizováno pro zachycení velkých trendů a odfiltrování krátkodobého šumu.

### 7. RSI Scoring (15b)

| RSI   | Body | UI Label                    | UI Interpretace                                                                                                                            |
| ----- | ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| <20   | 15   | "Extrémně přeprodané"       | "Akcie je výrazně pod tlakem prodejců. Historicky takto nízké RSI často předchází odrazu. Zvažte nákup, ale počkejte na potvrzení obratu." |
| 20-30 | 13   | "Přeprodané"                | "Prodejní tlak je silný, ale může se blížit vyčerpání. Sledujte známky obratu - rostoucí objem při růstu ceny."                            |
| 30-40 | 11   | "Podhodnocené"              | "Mírný prodejní tlak. Akcie se obchoduje pod svým průměrem, což může být příležitost pokud fundamenty jsou v pořádku."                     |
| 40-50 | 9    | "Neutrální, mírně slabší"   | "Trh je v rovnováze s mírnou převahou prodejců. Žádný jasný signál, vyčkejte na vývoj."                                                    |
| 50-60 | 7    | "Neutrální, mírně silnější" | "Trh je v rovnováze s mírnou převahou kupců. Pozitivní momentum, ale bez extrémů."                                                         |
| 60-70 | 5    | "Spíše překoupené"          | "Kupující tlačí cenu nahoru. Trend je pozitivní, ale opatrnost při nových nákupech."                                                       |
| 70-80 | 3    | "Překoupené"                | "Silný nákupní tlak, ale blíží se vyčerpání. Zvažte realizaci zisků nebo nastavení stop-lossu."                                            |
| >80   | 1    | "Extrémně překoupené"       | "Akcie je přehřátá. Vysoké riziko korekce. Nedoporučuje se nakupovat, zvažte prodej části pozice."                                         |

---

### 8. MACD Scoring (35b) 👑

> **Nejvyšší váha** - klíčový indikátor pro dlouhodobé trendy.

#### Base Score

| MACD Situace              | Base | UI Label                 | UI Interpretace                                                                                                               |
| ------------------------- | ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Bullish + histogram roste | 28   | "Silně býčí momentum"    | "MACD je nad signální linií a síla roste. Trend je jasně rostoucí s akcelerujícím momentem. Dobrý čas držet nebo přikupovat." |
| Bullish                   | 23   | "Býčí"                   | "MACD nad signální linií indikuje rostoucí trend. Momentum je pozitivní, ale sledujte případné zpomalení."                    |
| MACD > Signal (neutral)   | 16   | "Mírně býčí"             | "Lehká převaha kupců. Trend může sílit, ale zatím bez jasného potvrzení."                                                     |
| MACD < Signal (neutral)   | 12   | "Mírně medvědí"          | "Lehká převaha prodejců. Sledujte zda se jedná o korekci nebo začátek poklesu."                                               |
| Bearish                   | 7    | "Medvědí"                | "MACD pod signální linií signalizuje klesající trend. Opatrnost při nákupech."                                                |
| Bearish + histogram klesá | 3    | "Silně medvědí momentum" | "MACD klesá pod signální linii s rostoucí silou. Trend je jasně klesající. Vyčkejte na stabilizaci před nákupem."             |

#### Divergence Adjustment

| Divergence | Úprava | UI Label (přípona)     | UI Interpretace                                                                                 |
| ---------- | ------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Bullish    | +7     | "+ Býčí divergence"    | "Cena dělá nová dna, ale MACD ne. To naznačuje slábnutí prodejního tlaku a možný obrat nahoru." |
| Žádná      | 0      | -                      | -                                                                                               |
| Bearish    | -7     | "- Medvědí divergence" | "Cena dělá nová maxima, ale MACD ne. To varuje před možným vyčerpáním růstu a obratem dolů."    |

**Detekce (20 dní):** Bullish = Cena lower low + MACD higher low, Bearish = Cena higher high + MACD lower high

**Finální:** `max(0, min(35, base + divergence))`

**Implementace:** Přidat `macdDivergence: 'bullish' | 'bearish' | null` do edge function

---

### 9. Bollinger Bands Scoring (10b)

> Doplňkový indikátor pro volatilitu a squeeze.

#### Base Score (6 zón)

| Pozice      | Definice                  | Base | UI Label             | UI Interpretace                                                                                                          |
| ----------- | ------------------------- | ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Far below   | price < lower - 0.5×width | 9    | "Výrazně pod pásmem" | "Cena je extrémně nízko oproti své volatilitě. Silný signál přeprodanosti. Historicky často následuje návrat k průměru." |
| Below lower | price < lower             | 7    | "Pod dolním pásmem"  | "Cena prorazila dolní pásmo. Buď pokračuje silný downtrend, nebo se blíží odraz. Sledujte objem."                        |
| Lower zone  | lower ≤ price < middle    | 5    | "Spodní zóna"        | "Cena se drží v dolní části pásma. Mírný prodejní tlak, ale v rámci normální volatility."                                |
| Upper zone  | middle ≤ price < upper    | 4    | "Horní zóna"         | "Cena se drží v horní části pásma. Mírný nákupní tlak, trend je pozitivní."                                              |
| Above upper | price ≥ upper             | 2    | "Nad horním pásmem"  | "Cena prorazila horní pásmo. Silné momentum, ale riziko korekce. Při slabém objemu falešný signál."                      |
| Far above   | price > upper + 0.5×width | 1    | "Výrazně nad pásmem" | "Cena je extrémně vysoko oproti své volatilitě. Riziko prudké korekce. Zvažte realizaci zisků."                          |

#### Squeeze Bonus (+1b)

| Bandwidth | Situace             | Adj | UI Label (přípona) | UI Interpretace                                                                                                     |
| --------- | ------------------- | --- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| < 5%      | Squeeze (kontrakce) | +1  | "(squeeze)"        | "Pásma jsou stažená, trh je v klidu. Často předchází prudkému pohybu (nahoru nebo dolů). Připravte se na breakout." |
| ≥ 5%      | Normální/Vysoká     | 0   | -                  | -                                                                                                                   |

**Finální:** `max(0, min(10, base + squeeze_adj))`

---

### 10. ADX Scoring (25b)

**Princip:** Síla trendu má prioritu před směrem. Klíčové pro dlouhodobé trendy.

| ADX   | Směr (+DI vs -DI) | Body | UI Label            | UI Interpretace                                                                                                                        |
| ----- | ----------------- | ---- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| >40   | jakýkoliv         | 25   | "Velmi silný trend" | "Extrémně silný trend bez ohledu na směr. Ideální pro trend-following strategie. Trend je spolehlivý a pravděpodobně bude pokračovat." |
| 30-40 | +DI > -DI (up)    | 21   | "Silný uptrend"     | "Silný rostoucí trend. Ideální pro držení nebo přikupování na pullbackech. Momentum je jasně na straně kupců."                         |
| 30-40 | +DI < -DI (down)  | 14   | "Silný downtrend"   | "Silný klesající trend. Opatrnost při nákupech. Počkejte na známky obratu nebo oslabení trendu."                                       |
| 25-30 | +DI > -DI (up)    | 16   | "Střední uptrend"   | "Mírně rostoucí trend. Pozitivní momentum, ale sledujte potvrzení. Trend se může buď posílit nebo oslabit."                            |
| 25-30 | +DI < -DI (down)  | 10   | "Střední downtrend" | "Mírně klesající trend. Vyčkejte na stabilizaci před nákupem."                                                                         |
| 20-25 | jakýkoliv         | 6    | "Slabý trend"       | "Trend se formuje nebo slábne. Sledujte další vývoj."                                                                                  |
| <20   | jakýkoliv         | 3    | "Sideways"          | "Trh je v bočním pohybu (range). Trend-following strategie nefungují dobře. Zvažte jiné indikátory nebo počkejte na breakout."         |

---

### 11. 200-day MA Scoring (25b)

> **Klíčový trend filtr** pro position trading. Určuje dlouhodobý směr.

| Situace                  | Body | UI Label           | UI Interpretace                                                                           |
| ------------------------ | ---- | ------------------ | ----------------------------------------------------------------------------------------- |
| Cena > 200 MA + MA roste | 25   | "Silný uptrend"    | "Cena je nad rostoucí 200denní klouzavou průměr. Ideální podmínky pro dlouhodobé držení." |
| Cena > 200 MA            | 19   | "Bullish trend"    | "Cena je nad 200 MA. Dlouhodobý trend je pozitivní."                                      |
| Cena mezi 95-105% MA     | 12   | "U klíčové úrovně" | "Cena testuje 200 MA. Sledujte průraz nebo odraz - rozhodující moment pro trend."         |
| Cena < 200 MA            | 6    | "Pod trendem"      | "Cena je pod 200 MA. Dlouhodobý trend je negativní. Opatrnost při nákupech."              |
| Cena < 200 MA + MA klesá | 0    | "Silný downtrend"  | "Cena je pod klesající 200 MA. Vyčkejte na obrat trendu před nákupem."                    |

---

### 12. Volume Scoring (10b)

> **Potvrzení breakoutů** a trendů. Vysoký objem = institucionální zájem.

| Situace                    | Body | UI Label            | UI Interpretace                                                                          |
| -------------------------- | ---- | ------------------- | ---------------------------------------------------------------------------------------- |
| Volume > 1.5× avg + cena ↑ | 10   | "Silné potvrzení"   | "Vysoký objem potvrzuje růst. Institucionální zájem, pohyb je pravděpodobně udržitelný." |
| Volume > 1.5× avg + cena ↓ | 8    | "Kapitulace?"       | "Vysoký objem při poklesu může signalizovat kapitulaci prodejců. Sledujte možný obrat."  |
| Volume > avg               | 7    | "Nadprůměrný objem" | "Zvýšený zájem o akcii. Pohyb má větší váhu než při nízkém objemu."                      |
| Normální volume (0.7-1.3×) | 5    | "Normální objem"    | "Běžná obchodní aktivita. Žádný speciální signál z objemu."                              |
| Volume < 0.5× avg          | 2    | "Nízký objem"       | "Malý zájem o akcii. Cenové pohyby mohou být nespolehlivé a snadno zmanipulovatelné."    |

---

## ANALYST SCORE (80 bodů)

### 13. Consensus Score (50b)

| Consensus Score | Body | UI Label       | UI Interpretace                                                                      |
| --------------- | ---- | -------------- | ------------------------------------------------------------------------------------ |
| >1.5            | 50   | "Strong Buy"   | "Většina analytiků doporučuje silnou koupi. Velmi pozitivní sentiment profesionálů." |
| >1.0            | 40   | "Buy"          | "Analytici doporučují nákup. Pozitivní výhled pro akcii."                            |
| >0.5            | 32   | "Moderate Buy" | "Mírně pozitivní doporučení. Více analystů doporučuje koupi než prodej."             |
| >0.0            | 25   | "Weak Buy"     | "Lehce pozitivní sentiment. Analytici jsou opatrně optimističtí."                    |
| >-0.5           | 16   | "Hold"         | "Neutrální postoj. Analytici nedoporučují ani nákup ani prodej."                     |
| >-1.0           | 8    | "Underperform" | "Mírně negativní výhled. Akcie může zaostávat za trhem."                             |
| ≤-1.0           | 0    | "Sell"         | "Analytici doporučují prodej. Negativní výhled pro akcii."                           |

**Výpočet:** `(strongBuy*2 + buy*1 + hold*0 + sell*-1 + strongSell*-2) / total`

---

### 14. Analyst Coverage (15b)

| Počet analytiků | Body | UI Label            | UI Interpretace                                                                 |
| --------------- | ---- | ------------------- | ------------------------------------------------------------------------------- |
| ≥20             | 15   | "Vysoká pozornost"  | "Mnoho analytiků sleduje akcii. Data jsou spolehlivejší díky širokému pokrytí." |
| ≥10             | 12   | "Dobrá pozornost"   | "Solidní počet analytiků. Dostatek dat pro spolehlivou analýzu."                |
| ≥5              | 8    | "Střední pozornost" | "Omezený počet analytiků. Data mohou být méně reprezentativní."                 |
| ≥1              | 4    | "Nízká pozornost"   | "Málo analytiků. Doporučení mohou být méně spolehlivá."                         |
| 0               | 0    | "Žádná data"        | "Akcie není pokryta žádným analytikem. Schází profesionální hodnocení."         |

---

### 15. Price Target Upside (10b)

| Upside | Body | UI Label            | UI Interpretace                                                                           |
| ------ | ---- | ------------------- | ----------------------------------------------------------------------------------------- |
| >30%   | 10   | "Vysoký potenciál"  | "Cena je výrazně pod cílovou cenou analytiků. Značný prostor pro růst."                   |
| 15-30% | 8    | "Solidní upside"    | "Dobrý potenciál růstu k cílové ceně. Analytici vidí prostor pro zhodnocení."             |
| 5-15%  | 5    | "Mírný upside"      | "Mírný potenciál růstu. Cena se blíží k fair value podle analytiků."                      |
| ±5%    | 3    | "Blízko fair value" | "Cena je blízko cílové ceně analytiků. Omezený potenciál dalšího růstu z tohoto pohledu." |
| <-5%   | 1    | "Nad cílem"         | "Cena je nad cílovou cenou analytiků. Možné nadhodnocení podle profesionálů."             |
| N/A    | 0    | "Chybí data"        | "Cílová cena není dostupná. Nelze vyhodnotit potenciál."                                  |

---

### 16. Analyst Agreement (5b)

| Situace                          | Body | UI Label           | UI Interpretace                                                              |
| -------------------------------- | ---- | ------------------ | ---------------------------------------------------------------------------- |
| Většina v jedné kategorii (>60%) | 5    | "Silný konsensus"  | "Analytici se shodují na doporučení. Vysoká jistota v hodnocení."            |
| Převažuje jedna strana (>50%)    | 4    | "Mírný konsensus"  | "Většina analytiků se shoduje. Střední jistota v hodnocení."                 |
| Rozložené názory (30-50% každá)  | 2    | "Smíšené názory"   | "Analytici jsou rozděleni. Vyšší nejistota ohledně budoucího vývoje."        |
| Extrémně rozdělené (<30% každá)  | 1    | "Vysoká nejistota" | "Analytici se významně neshodují. Vysoká nejistota, zvažte vlastní analýzu." |

---

## NEWS+INSIDER SCORE (60 bodů)

> Sloučená kategorie pro sentiment z médií a insider aktivity.

### 17. News Sentiment (35b)

| Sentiment    | Body | UI Label          | UI Interpretace                                                       |
| ------------ | ---- | ----------------- | --------------------------------------------------------------------- |
| > 0.5        | 35   | "Velmi pozitivní" | "Mediální pokrytí je výrazně pozitivní. Silná podpora pro akcii."     |
| 0.15 - 0.5   | 28   | "Pozitivní"       | "Většina zpráv je pozitivních. Dobrý sentiment v médiích."            |
| -0.15 - 0.15 | 17   | "Neutrální"       | "Vyvážené mediální pokrytí. Žádný jasný směr ze zpráv."               |
| -0.5 - -0.15 | 8    | "Negativní"       | "Převažují negativní zprávy. Opatrnost doporučena."                   |
| < -0.5       | 0    | "Velmi negativní" | "Silně negativní mediální pokrytí. Zvažte důvody a zda jsou dočasné." |

**Výpočet:** `newsScore = (avgSentiment + 1) * 17.5` (clamped 0-35)

---

### 18. Insider Score (25b)

| MSPR      | Body | UI Label                | UI Interpretace                                                                   |
| --------- | ---- | ----------------------- | --------------------------------------------------------------------------------- |
| > 50      | 25   | "Silné insider nákupy"  | "Management výrazně nakupuje. Vysoká důvěra ve společnost zevnitř."               |
| 25 - 50   | 21   | "Insider nákupy"        | "Více nákupů než prodejů od insiderů. Pozitivní signál."                          |
| 0 - 25    | 16   | "Mírné insider nákupy"  | "Lehká převaha nákupů. Neutrální až lehce pozitivní signál."                      |
| -25 - 0   | 12   | "Mírné insider prodeje" | "Lehká převaha prodejů. Může být daňová optimalizace nebo diverzifikace."         |
| -50 - -25 | 6    | "Insider prodeje"       | "Více prodejů než nákupů. Sledujte důvody - může signalizovat obavy managementu." |
| < -50     | 0    | "Silné insider prodeje" | "Management výrazně prodává. Varování - může signalizovat interní problémy."      |

**Výpočet:** `insiderScore = 12.5 + (mspr / 4)` (clamped 0-25)

---

## PORTFOLIO SCORE (100 bodů) ⚠️ POUZE HOLDINGS

> **Horizont:** Měsíční až roční (position trading)
>
> Optimalizováno pro méně časté obchodování a větší pozice.
> ⚠️ Tento score existuje POUZE pro Holdings view!

### 19. Target Upside (35b)

| Upside k targetu | Body | UI Label            | UI Interpretace                                                                    |
| ---------------- | ---- | ------------------- | ---------------------------------------------------------------------------------- |
| >30%             | 35   | "Vysoký potenciál"  | "Významný prostor k osobní cílové ceně. Ideální pro držení nebo navýšení pozice."  |
| >20%             | 28   | "Dobrý potenciál"   | "Dobrý prostor k cílové ceně. Pozice má smysl držet."                              |
| >10%             | 21   | "Střední potenciál" | "Mírný prostor k cílové ceně. Sledujte vývoj."                                     |
| >5%              | 14   | "Omezený potenciál" | "Blíží se k cílové ceně. Zvažte částečnou realizaci při dosažení."                 |
| >0%              | 7    | "Blízko cíle"       | "Téměř u cílové ceny. Připravte strategii pro realizaci."                          |
| ≤0%              | 0    | "Nad cílem"         | "Cena překročila cíl. Silný signál pro realizaci zisků nebo přehodnocení targetu." |

---

### 20. Distance from Avg Buy (25b)

| Distance od avg | Body | UI Label          | UI Interpretace                                                                    |
| --------------- | ---- | ----------------- | ---------------------------------------------------------------------------------- |
| <-15%           | 25   | "DCA příležitost" | "Cena je výrazně pod průměrnou nákupní cenou. Ideální moment pro dokoupení (DCA)." |
| <-10%           | 20   | "Přidej na dipu"  | "Cena je pod průměrem. Dobrá příležitost navýšit pozici pokud fundamenty drží."    |
| <0%             | 15   | "Pod průměrem"    | "Mírně pod nákupní cenou. Vyčkejte nebo přidejte menší částku."                    |
| <25%            | 10   | "Mírný zisk"      | "Pozice je v zisku. Žádný tlak na akci."                                           |
| <50%            | 5    | "Solidní zisk"    | "Dobrý papírový zisk. Zvažte částečnou realizaci při slabosti."                    |
| ≥50%            | 2    | "Výrazný zisk"    | "Vysoký papírový zisk. Zvažte rebalancing nebo trailing stop-loss."                |

---

### 21. Position Weight (20b)

| Váha v portfoliu | Body | UI Label      | UI Interpretace                                                                              |
| ---------------- | ---- | ------------- | -------------------------------------------------------------------------------------------- |
| >12%             | 4    | "Převážená"   | "Pozice je příliš velká. Zvažte redukci pro snížení rizika koncentrace."                     |
| >6%              | 12   | "Mírně velká" | "Pozice je nad ideální váhou. Sledujte a zvažte postupnou redukci při růstu."                |
| ≥3%              | 20   | "Vyvážená"    | "Ideální velikost pozice. Umožňuje růst i ochranu diverzifikací."                            |
| <3%              | 15   | "Malá pozice" | "Pozice je menší. Zvažte navýšení pokud máte konvikci, nebo přehodnoťte zda má smysl držet." |

---

### 22. Unrealized Gain (20b)

| Nerealizovaný zisk | Body | UI Label           | UI Interpretace                                                                            |
| ------------------ | ---- | ------------------ | ------------------------------------------------------------------------------------------ |
| >75%               | 10   | "Rebalance!"       | "Velmi vysoký zisk. Silný signál pro realizaci části pozice a snížení rizika."             |
| >40%               | 13   | "Zvažte realizaci" | "Dobrý zisk. Zvažte realizaci části (30-50%) pro zamknutí zisku."                          |
| >15%               | 16   | "Zdravý zisk"      | "Solidní pozice v zisku. Držte s trailing stopem."                                         |
| >0%                | 20   | "V zisku"          | "Pozice je v zisku. Ideální stav - držte dokud fundamenty drží."                           |
| >-15%              | 14   | "Mírná ztráta"     | "Malá ztráta, běžná volatilita. Sledujte, ale nepanikařte."                                |
| >-30%              | 10   | "Větší ztráta"     | "Významnější ztráta. Přehodnoťte fundamenty - stále věříte investiční tezi?"               |
| ≤-30%              | 4    | "Velká ztráta"     | "Vážná ztráta. Buď je čas koupit více (pokud fundamenty drží), nebo uznat chybu a prodat." |

---

## Shrnutí bodů

### Fundamental Score (140b)

| Kategorie     | Max bodů |
| ------------- | -------- |
| PEG Ratio     | 20       |
| Absolutní P/E | 20       |
| ROE           | 30       |
| Net Margin    | 25       |
| Revenue Gr.   | 25       |
| D/E Ratio     | 10       |
| Current Ratio | 10       |
| **CELKEM**    | **140**  |

### Technical Score (120b)

| Kategorie  | Max bodů | Poznámka           |
| ---------- | -------- | ------------------ |
| MACD       | 35       | 👑 Klíčový - trend |
| ADX        | 25       | Síla trendu        |
| 200-day MA | 25       | Trend směr         |
| RSI        | 15       | Weekly momentum    |
| Volume     | 10       | Potvrzení          |
| Bollinger  | 10       | Volatilita/squeeze |
| **CELKEM** | **120**  |                    |

### Analyst Score (80b)

| Kategorie           | Max bodů |
| ------------------- | -------- |
| Consensus Score     | 50       |
| Analyst Coverage    | 15       |
| Price Target Upside | 10       |
| Analyst Agreement   | 5        |
| **CELKEM**          | **80**   |

### News+Insider Score (60b)

| Kategorie      | Max bodů |
| -------------- | -------- |
| News Sentiment | 35       |
| Insider Score  | 25       |
| **CELKEM**     | **60**   |

### Portfolio Score (100b) - Holdings only

| Kategorie         | Max bodů |
| ----------------- | -------- |
| Target Upside     | 35       |
| Distance from Avg | 25       |
| Position Weight   | 20       |
| Unrealized Gain   | 20       |
| **CELKEM**        | **100**  |

---

## Celkové rozložení

### Research Mode (400b)

| Kategorie    | Body | Váha |
| ------------ | ---- | ---- |
| Fundamental  | 140  | 35%  |
| Technical    | 120  | 30%  |
| Analyst      | 80   | 20%  |
| News+Insider | 60   | 15%  |
| **CELKEM**   | 400  | 100% |

### Holdings Mode (500b)

| Kategorie    | Body | Váha |
| ------------ | ---- | ---- |
| Fundamental  | 140  | 28%  |
| Technical    | 120  | 24%  |
| Analyst      | 80   | 16%  |
| News+Insider | 60   | 12%  |
| Portfolio    | 100  | 20%  |
| **CELKEM**   | 500  | 100% |

---

## v3.1 ZMĚNY - Sekundární systémy

### 23. Conviction Score (0-100)

**Změna:** Nahrazení RSI momentum za 200-MA Position + Volume Health

| Kategorie                 | Staré         | Nové                 |
| ------------------------- | ------------- | -------------------- |
| Momentum & Sentiment (30) | RSI 50-70: 8b | 200-MA Position: 10b |
|                           |               | Volume Health: 8b    |
| Insider Buying (12b)      | beze změny    | beze změny           |

**Nová logika:**

```
200-MA Position (0-10):
  price > sma200 * 1.05: 10 (solidní uptrend)
  price > sma200: 7 (nad podporou)
  price > sma200 * 0.95: 3 (blízko MA)

Volume Health (0-8):
  avg volume > 50-day avg * 1.2: 8 (rostoucí zájem)
  avg volume > 50-day avg: 5 (stabilní)
  avg volume < 50-day avg * 0.7: 2 (nízký zájem)
```

---

### 24. DIP Score (0-100)

**Změna:** Odstranění Stochastic, přidání MACD Divergence + Volume Confirmation

| Kategorie               | Staré          | Nové                           |
| ----------------------- | -------------- | ------------------------------ |
| RSI Based (25b)         | beze změny     | + RSI 35: 15b                  |
| Bollinger (20b)         | beze změny     | far below/below/lower zone     |
| SMA Position (20b)      | SMA50 + SMA200 | 200-MA only (position trading) |
| 52-Week (15b)           | beze změny     | beze změny                     |
| Stochastic (10b)        | %K < 20/30     | **ODSTRANĚNO**                 |
| Distance from Avg (10b) | >15% below     | **ODSTRANĚNO**                 |
| MACD Divergence (10b)   | -              | **NOVÉ**                       |
| Volume Confirm (10b)    | -              | **NOVÉ**                       |

**Nová logika:**

```
MACD Divergence (0-10):
  bullish divergence detected: 10
  MACD histogram improving: 5

Volume Confirmation (0-10):
  volume > 2× avg on down day: 10 (kapitulace)
  volume > 1.5× avg: 7
  volume > avg: 3
```

---

### 25. Signal Thresholds

**Změna:** Přepočet na % škálu místo absolutních hodnot

```typescript
const SIGNAL_THRESHOLDS = {
  // Technical (max 120b)
  TECH_STRONG: 0.7, // ≥70% = 84b
  TECH_WEAK: 0.4, // <40% = 48b

  // Fundamental (max 140b)
  FUND_WATCH_LOW: 0.2, // 20% = 28b
  FUND_WATCH_HIGH: 0.35, // 35% = 49b
  FUND_STRONG: 0.5, // ≥50% = 70b

  // Insider (max 25b)
  INSIDER_WEAK: 0.35, // <35% = 9b

  // News (max 35b)
  NEWS_WATCH_LOW: 0.25, // 25% = 9b
  NEWS_WATCH_HIGH: 0.5, // 50% = 17.5b
};
```

---

### 26. Buy Strategy - Position Trading

**Nové sekce:**

| Sekce           | Obsah                                              |
| --------------- | -------------------------------------------------- |
| Position Sizing | Max 5% při ≥80% score, 3% při ≥60%, 2% při ≥50%    |
| DCA Intervals   | AGGRESSIVE: 2 týdny, NORMAL: 1 měsíc, CAUTIOUS: 2m |
| Risk Management | Stop-loss -15%, Trailing +20%→-10%, Max 12%        |
| R/R Minimum     | ≥2.0 = Dobrý, ≥3.0 = Výborný, <1.5 = Nekupovat     |

---

### 27. Exit Strategy (NOVÁ SEKCE 11)

**Exit Signal Types:**

| Signal              | Priorita | Podmínky                   | Akce           |
| ------------------- | -------- | -------------------------- | -------------- |
| `TARGET_REACHED`    | 1        | price ≥ targetPrice        | Prodat 50-100% |
| `TRAILING_STOP`     | 2        | price -10% od peak && +20% | Prodat 100%    |
| `STOP_LOSS`         | 3        | loss > 15%                 | Prodat 100%    |
| `FUNDAMENTAL_BREAK` | 4        | fundamentalScore < 25%     | Zvážit prodej  |
| `CONVICTION_DROP`   | 5        | conviction HIGH→LOW        | Redukovat 50%  |
| `REBALANCE`         | 6        | weight > 15%               | Trim na 10-12% |

**Trailing Stop Logic:**

```
+50% gain: trailing -6%
+30% gain: trailing -8%
+20% gain: trailing -10%
```

**Exit Confirmation:** Prodej pouze pokud 2+ signály souhlasí.
