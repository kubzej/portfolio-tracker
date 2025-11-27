-- Update indicator descriptions to Czech

UPDATE analysis_indicators SET description = 'CO TO JE: Price-to-Earnings = poměr ceny akcie k zisku na akcii. Udává, kolik let by trvalo, než se investice "vrátí" ze zisků. JAK ČÍST: Nižší P/E = akcie může být levnější (podhodnocená). Vyšší P/E = investoři očekávají růst. TYPICKÉ HODNOTY: Pod 15 = levné, 15-25 = normální, Nad 25 = drahé nebo růstové.' WHERE key = 'peRatio';

UPDATE analysis_indicators SET description = 'CO TO JE: Forward P/E = P/E založené na ODHADOVANÝCH budoucích ziscích (následující rok). JAK ČÍST: Porovnejte s běžným P/E. Fwd P/E NIŽŠÍ než P/E = analytici očekávají růst zisků. Fwd P/E VYŠŠÍ než P/E = analytici očekávají pokles zisků.' WHERE key = 'forwardPe';

UPDATE analysis_indicators SET description = 'CO TO JE: Price-to-Book = poměr ceny akcie k účetní hodnotě (aktiva - dluhy). JAK ČÍST: P/B pod 1 = akcie se obchoduje pod hodnotou majetku (potenciálně levná). P/B nad 3 = akcie je drahá nebo má velkou hodnotu značky/technologií. POZOR: Tech firmy mají běžně vysoké P/B.' WHERE key = 'pbRatio';

UPDATE analysis_indicators SET description = 'CO TO JE: Price-to-Sales = poměr ceny akcie k tržbám. Užitečné pro firmy, které ještě nemají zisk. JAK ČÍST: Nižší = levnější. Pod 1 = velmi levné. 1-3 = normální. Nad 5 = drahé. Růstové tech firmy mají často P/S nad 10.' WHERE key = 'psRatio';

UPDATE analysis_indicators SET description = 'CO TO JE: Enterprise Value / EBITDA = hodnota firmy dělená provozním ziskem. Lepší než P/E pro porovnání firem s různým zadlužením. JAK ČÍST: Nižší = levnější. TYPICKÉ HODNOTY: Pod 10 = levné, 10-15 = normální, Nad 15 = drahé nebo růstové.' WHERE key = 'evEbitda';

UPDATE analysis_indicators SET description = 'CO TO JE: Return on Equity = návratnost vlastního kapitálu. Ukazuje, jak efektivně firma využívá peníze akcionářů k tvorbě zisku. JAK ČÍST: Vyšší = lepší. Nad 15% je obecně dobré. Nad 20% je výborné. Pod 10% je slabé. IDEÁLNÍ: Co nejvyšší ROE.' WHERE key = 'roe';

UPDATE analysis_indicators SET description = 'CO TO JE: Return on Assets = návratnost aktiv. Ukazuje, jak efektivně firma využívá svůj majetek k tvorbě zisku. JAK ČÍST: Vyšší = lepší. Nad 5% je dobré. Nad 10% je výborné. Závisí na odvětví - banky mají nižší ROA.' WHERE key = 'roa';

UPDATE analysis_indicators SET description = 'CO TO JE: Net Profit Margin = čistá zisková marže. Kolik procent z tržeb zůstane jako čistý zisk. JAK ČÍST: Vyšší = lepší. Nad 10% je dobré. Nad 20% je výborné. Závisí na odvětví - tech firmy mají vyšší marže než maloobchod.' WHERE key = 'netMargin';

UPDATE analysis_indicators SET description = 'CO TO JE: Gross Margin = hrubá marže. Tržby minus náklady na výrobu/služby. JAK ČÍST: Vyšší = větší cenová síla a konkurenceschopnost. Nad 40% je dobré. Nad 60% značí silné konkurencenční výhody (jako Apple, Microsoft).' WHERE key = 'grossMargin';

UPDATE analysis_indicators SET description = 'CO TO JE: Operating Margin = provozní marže. Zisk z běžného provozu jako procento tržeb (před úroky a daněmi). JAK ČÍST: Vyšší = efektivnější provoz. Nad 15% je dobré. Nad 25% je výborné.' WHERE key = 'operatingMargin';

UPDATE analysis_indicators SET description = 'CO TO JE: Revenue Growth = růst tržeb za poslední rok. JAK ČÍST: Kladné číslo (+) = firma roste. Záporné číslo (-) = tržby klesají. TYPICKÉ HODNOTY: Růstové firmy: +15% a více. Stabilní firmy: 0-10%. Pokles tržeb: varovný signál. IDEÁLNÍ: Kladný růst, ideálně nad 10%.' WHERE key = 'revenueGrowth';

UPDATE analysis_indicators SET description = 'CO TO JE: Earnings Growth = růst zisku za poslední rok. JAK ČÍST: Kladné číslo (+) = zisky rostou. Záporné číslo (-) = zisky klesají. Důležité porovnat s růstem tržeb - pokud zisky rostou rychleji než tržby, firma zlepšuje efektivitu.' WHERE key = 'epsGrowth';

UPDATE analysis_indicators SET description = 'CO TO JE: Beta = míra volatility (kolísavosti) ve srovnání s trhem (S&P 500). JAK ČÍST: Beta = 1 znamená pohyb s trhem. Beta > 1 = větší výkyvy než trh (riskantnější). Beta < 1 = menší výkyvy (stabilnější). Beta < 0 = pohyb opačně než trh. IDEÁLNÍ: Záleží na vaší toleranci k riziku. Konzervativní investoři preferují Beta pod 1.' WHERE key = 'beta';

UPDATE analysis_indicators SET description = 'CO TO JE: Debt-to-Equity = poměr dluhu k vlastnímu kapitálu. Ukazuje, jak moc je firma zadlužená. JAK ČÍST: Nižší = bezpečnější. Pod 0.5 = nízký dluh (výborné). 0.5-2 = normální. Nad 2 = vysoký dluh (rizikovější). POZOR: Některá odvětví (banky, reality) mají přirozeně vyšší D/E.' WHERE key = 'debtToEquity';

UPDATE analysis_indicators SET description = 'CO TO JE: Current Ratio = poměr oběžných aktiv k krátkodobým závazkům. Ukazuje schopnost splácet krátkodobé dluhy. JAK ČÍST: Nad 1 = firma může pokrýt závazky (dobré). Nad 2 = velmi silná pozice. Pod 1 = potenciální problémy s likviditou.' WHERE key = 'currentRatio';

UPDATE analysis_indicators SET description = 'CO TO JE: Quick Ratio = jako Current Ratio, ale bez zásob (rychleji přeměnitelná aktiva). JAK ČÍST: Nad 1 = dobrá likvidita. Pod 1 = možné problémy s okamžitou platební schopností. Konzervativnější měřítko než Current Ratio.' WHERE key = 'quickRatio';

UPDATE analysis_indicators SET description = 'CO TO JE: Dividend Yield = dividendový výnos. Roční dividenda jako procento ceny akcie. JAK ČÍST: Vyšší = větší pravidelný příjem. 2-4% = normální. Nad 5% = vysoký výnos (ale pozor na udržitelnost). 0% = firma nevyplácí dividendy. IDEÁLNÍ: Záleží na strategii - příjmoví investoři preferují vyšší výnos.' WHERE key = 'dividendYield';

UPDATE analysis_indicators SET description = 'CO TO JE: Payout Ratio = poměr vyplácených dividend k zisku. Kolik procent zisku firma vyplácí akcionářům. JAK ČÍST: Pod 50% = udržitelné, prostor pro růst dividend. 50-75% = normální. Nad 75% = riziko snížení dividend v budoucnu. Nad 100% = firma vyplácí více než vydělá (neudržitelné).' WHERE key = 'payoutRatio';

UPDATE analysis_indicators SET description = 'CO TO JE: 52-Week Change = změna ceny za poslední rok (52 týdnů). JAK ČÍST: Kladné číslo (+) = akcie za rok vzrostla. Záporné číslo (-) = akcie za rok klesla. Porovnejte s indexem S&P 500 (cca 10% ročně dlouhodobě).' WHERE key = 'fiftyTwoWeekChange';

UPDATE analysis_indicators SET description = 'CO TO JE: Market Capitalization = tržní kapitalizace. Celková hodnota všech akcií firmy (cena × počet akcií). JAK ČÍST: Mega Cap: >200B, Large Cap: 10-200B, Mid Cap: 2-10B, Small Cap: <2B. Větší firmy = stabilnější, menší = větší růstový potenciál ale i riziko.' WHERE key = 'marketCap';

UPDATE analysis_indicators SET description = 'CO TO JE: Enterprise Value = hodnota podniku. Tržní kapitalizace + dluh - hotovost. Ukazuje, kolik by stálo koupit celou firmu. JAK ČÍST: Používá se pro EV/EBITDA a další poměry. Vyšší EV než Market Cap = firma má více dluhu než hotovosti.' WHERE key = 'enterpriseValue';

UPDATE analysis_indicators SET description = 'CO TO JE: EPS (TTM) = Earnings Per Share (Trailing Twelve Months) = zisk na akcii za posledních 12 měsíců. JAK ČÍST: Vyšší = více zisku na každou akcii. Porovnejte s cenou akcie (P/E). Sledujte růst EPS v čase - rostoucí EPS je pozitivní signál.' WHERE key = 'eps';

UPDATE analysis_indicators SET description = 'CO TO JE: Book Value per Share = účetní hodnota na akcii. Vlastní kapitál dělený počtem akcií. JAK ČÍST: Porovnejte s cenou akcie. Cena < Book Value = akcie může být podhodnocená. Cena > Book Value = trh oceňuje nehmotná aktiva (značka, technologie).' WHERE key = 'bookValuePerShare';

UPDATE analysis_indicators SET description = 'CO TO JE: Free Cash Flow = volný peněžní tok. Hotovost, kterou firma generuje po investicích. JAK ČÍST: Kladný FCF = firma generuje přebytek hotovosti (může vyplácet dividendy, splácet dluh, investovat). Záporný FCF = firma spotřebovává hotovost. Rostoucí FCF je velmi pozitivní signál.' WHERE key = 'freeCashFlow';

UPDATE analysis_indicators SET description = 'CO TO JE: Revenue (TTM) = tržby za posledních 12 měsíců. Celkové příjmy z prodeje produktů/služeb. JAK ČÍST: Sledujte růst v čase. Rostoucí tržby = firma expanduje. Klesající tržby = varovný signál (pokud není plánovaná restrukturalizace).' WHERE key = 'revenue';

UPDATE analysis_indicators SET description = 'CO TO JE: EBITDA = Earnings Before Interest, Taxes, Depreciation, and Amortization = zisk před úroky, daněmi a odpisy. JAK ČÍST: Ukazuje provozní výkonnost bez vlivu financování a účetnictví. Používá se pro EV/EBITDA. Vyšší = silnější provozní výsledky.' WHERE key = 'ebitda';
