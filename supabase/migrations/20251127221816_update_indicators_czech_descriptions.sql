-- Update indicator descriptions to Czech

UPDATE analysis_indicators SET description = '**P/E Ratio** | Poměr ceny k zisku na akcii. | • Pod 15 = levné | • 15-25 = normální | • Nad 25 = drahé nebo růstové' WHERE key = 'peRatio';

UPDATE analysis_indicators SET description = '**Forward P/E** | P/E založené na odhadovaných budoucích ziscích. | • Fwd P/E < P/E = očekávaný růst zisků | • Fwd P/E > P/E = očekávaný pokles zisků' WHERE key = 'forwardPe';

UPDATE analysis_indicators SET description = '**P/B Ratio** | Poměr ceny k účetní hodnotě. | • Pod 1 = potenciálně levná | • Nad 3 = drahá nebo silná značka | Tech firmy mají běžně vysoké P/B.' WHERE key = 'pbRatio';

UPDATE analysis_indicators SET description = '**P/S Ratio** | Poměr ceny k tržbám. Užitečné pro firmy bez zisku. | • Pod 1 = velmi levné | • 1-3 = normální | • Nad 5 = drahé' WHERE key = 'psRatio';

UPDATE analysis_indicators SET description = '**EV/EBITDA** | Hodnota firmy dělená provozním ziskem. | • Pod 10 = levné | • 10-15 = normální | • Nad 15 = drahé nebo růstové' WHERE key = 'evEbitda';

UPDATE analysis_indicators SET description = '**ROE** | Návratnost vlastního kapitálu. | • Nad 15% = dobré | • Nad 20% = výborné | • Pod 10% = slabé' WHERE key = 'roe';

UPDATE analysis_indicators SET description = '**ROA** | Návratnost aktiv. | • Nad 5% = dobré | • Nad 10% = výborné | Závisí na odvětví.' WHERE key = 'roa';

UPDATE analysis_indicators SET description = '**Čistá marže** | Kolik procent z tržeb zůstane jako zisk. | • Nad 10% = dobré | • Nad 20% = výborné | Tech firmy mají vyšší marže.' WHERE key = 'netMargin';

UPDATE analysis_indicators SET description = '**Hrubá marže** | Tržby minus náklady na výrobu. | • Nad 40% = dobré | • Nad 60% = silné konkurenční výhody' WHERE key = 'grossMargin';

UPDATE analysis_indicators SET description = '**Provozní marže** | Zisk z provozu jako procento tržeb. | • Nad 15% = dobré | • Nad 25% = výborné' WHERE key = 'operatingMargin';

UPDATE analysis_indicators SET description = '**Růst tržeb** | Meziroční změna tržeb. | • Kladné = firma roste | • Záporné = tržby klesají | • Nad 10% = zdravý růst' WHERE key = 'revenueGrowth';

UPDATE analysis_indicators SET description = '**Růst zisku** | Meziroční změna zisku. | • Kladné = zisky rostou | • Záporné = zisky klesají | Porovnejte s růstem tržeb.' WHERE key = 'epsGrowth';

UPDATE analysis_indicators SET description = '**Beta** | Volatilita ve srovnání s trhem. | • Beta = 1 = pohyb s trhem | • Beta > 1 = větší výkyvy | • Beta < 1 = stabilnější' WHERE key = 'beta';

UPDATE analysis_indicators SET description = '**Debt-to-Equity** | Poměr dluhu k vlastnímu kapitálu. | • Pod 0.5 = nízký dluh | • 0.5-2 = normální | • Nad 2 = vysoký dluh' WHERE key = 'debtToEquity';

UPDATE analysis_indicators SET description = '**Current Ratio** | Schopnost splácet krátkodobé dluhy. | • Nad 1 = může pokrýt závazky | • Nad 2 = velmi silná pozice | • Pod 1 = problémy s likviditou' WHERE key = 'currentRatio';

UPDATE analysis_indicators SET description = '**Quick Ratio** | Rychlá likvidita (bez zásob). | • Nad 1 = dobrá likvidita | • Pod 1 = možné problémy' WHERE key = 'quickRatio';

UPDATE analysis_indicators SET description = '**Dividendový výnos** | Roční dividenda jako procento ceny. | • 2-4% = normální | • Nad 5% = vysoký výnos | • 0% = nevyplácí dividendy' WHERE key = 'dividendYield';

UPDATE analysis_indicators SET description = '**Payout Ratio** | Kolik procent zisku jde na dividendy. | • Pod 50% = udržitelné | • 50-75% = normální | • Nad 100% = neudržitelné' WHERE key = 'payoutRatio';

UPDATE analysis_indicators SET description = '**52W změna** | Změna ceny za poslední rok. | • Kladné = akcie vzrostla | • Záporné = akcie klesla | Porovnejte s indexem.' WHERE key = 'fiftyTwoWeekChange';

UPDATE analysis_indicators SET description = '**Tržní kapitalizace** | Celková hodnota všech akcií. | • Mega Cap: >200B | • Large Cap: 10-200B | • Mid Cap: 2-10B | • Small Cap: <2B' WHERE key = 'marketCap';

UPDATE analysis_indicators SET description = '**Enterprise Value** | Tržní kapitalizace + dluh - hotovost. | Ukazuje cenu za koupi celé firmy. | EV > Market Cap = více dluhu než hotovosti.' WHERE key = 'enterpriseValue';

UPDATE analysis_indicators SET description = '**EPS (TTM)** | Zisk na akcii za 12 měsíců. | • Vyšší = více zisku na akcii | • Rostoucí EPS = pozitivní signál' WHERE key = 'eps';

UPDATE analysis_indicators SET description = '**Book Value** | Účetní hodnota na akcii. | • Cena < Book Value = možná podhodnocená | • Cena > Book Value = trh oceňuje nehmotná aktiva' WHERE key = 'bookValuePerShare';

UPDATE analysis_indicators SET description = '**Free Cash Flow** | Hotovost po investicích. | • Kladný = generuje přebytek | • Záporný = spotřebovává hotovost | Rostoucí FCF = velmi pozitivní.' WHERE key = 'freeCashFlow';

UPDATE analysis_indicators SET description = '**Tržby (TTM)** | Celkové tržby za 12 měsíců. | • Rostoucí = firma expanduje | • Klesající = varovný signál' WHERE key = 'revenue';

UPDATE analysis_indicators SET description = '**EBITDA** | Zisk před úroky, daněmi a odpisy. | Ukazuje provozní výkonnost. | Vyšší = silnější provozní výsledky.' WHERE key = 'ebitda';
