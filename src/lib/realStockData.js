/**
 * リアル株価データ取得とスコア計算
 * CORSプロキシ経由でYahoo Financeからデータを取得
 * scoringEngine.jsの正規アルゴリズムを使用
 */

import {
    scoreAsset
} from './scoringEngine';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Fundamental & Sentimentデータを取得
 * quoteSummaryエンドポイントを使用
 */
async function fetchFundamentalData(symbol) {
    try {
        // 必要なモジュールを指定 (財務データ, 統計, アナリスト推奨)
        const modules = 'financialData,defaultKeyStatistics,recommendationTrend';
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
        const response = await fetch(CORS_PROXY + encodeURIComponent(url));

        if (!response.ok) return null;

        const data = await response.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) return null;

        const fin = result.financialData || {};
        const stats = result.defaultKeyStatistics || {};
        const trend = result.recommendationTrend?.trend?.[0] || {};

        // アナリスト評価（1=Strong Buy, 5=Sellなので逆転させる必要あり、またはトレンド数を使う）
        // ここではトレンド構成比からスコアを算出
        let analystRating = 3; // default hold
        const totalRatings = (trend.strongBuy || 0) + (trend.buy || 0) + (trend.hold || 0) + (trend.sell || 0) + (trend.strongSell || 0);
        if (totalRatings > 0) {
            // 加重平均スコア (5:StrongBuy ... 1:StrongSell)
            const weightedSum =
                (trend.strongBuy || 0) * 5 +
                (trend.buy || 0) * 4 +
                (trend.hold || 0) * 3 +
                (trend.sell || 0) * 2 +
                (trend.strongSell || 0) * 1;
            analystRating = weightedSum / totalRatings;
        } else if (fin.recommendationMean) {
            // 1(Strong Buy) - 5(Strong Sell) 形式の平均値がある場合
            // 1->5, 5->1 に変換
            analystRating = 6 - (fin.recommendationMean.raw || 3);
        }

        return {
            fundamental: {
                per: stats.forwardPE?.raw || fin.currentPrice?.raw / (stats.trailingEps?.raw || 1) || 20,
                pbr: stats.priceToBook?.raw || 2,
                roe: (fin.returnOnEquity?.raw || 0.1) * 100, // %表記に変換
                revenueGrowth: (fin.revenueGrowth?.raw || 0.05) * 100,
                debtRatio: fin.debtToEquity?.raw ? fin.debtToEquity.raw / 100 : 0.5,
                dividendYield: (fin.dividendYield?.raw || 0) * 100,
                targetPrice: fin.targetMeanPrice?.raw
            },
            sentiment: {
                analystRating: analystRating, // 1-5 scale (5=Best)
                recommendationKey: fin.recommendationKey // 'buy', 'hold' etc.
            }
        };
    } catch (error) {
        console.warn(`Failed to fetch fundamental for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Yahoo Finance APIからリアルタイム価格を取得
 * 期間を長めに取得して長期MAなどを計算可能にする
 */
async function fetchYahooQuote(symbol) {
    // 日本株の場合は .T を追加するなどの処理が必要だが、
    // sp500Data.jsは米国株前提なのでそのまま使用
    const querySymbol = symbol;

    try {
        // 並列でデータ取得：価格履歴 & ファンダメンタル
        const [chartDataResult, fundamentalResult] = await Promise.all([
            (async () => {
                // 6ヶ月分のデータを取得
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1d&range=6mo`;
                const response = await fetch(CORS_PROXY + encodeURIComponent(url));
                if (!response.ok) return null;
                return response.json();
            })(),
            fetchFundamentalData(querySymbol)
        ]);

        // チャートデータの処理
        if (!chartDataResult) return null; // チャートがないと始まらない
        const result = chartDataResult.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0];
        const timestamps = result.timestamp;

        if (!quotes || !timestamps || timestamps.length === 0) return null;

        // null値を除去しながら価格配列を作成
        const cleanData = timestamps.map((t, i) => ({
            date: new Date(t * 1000).toISOString().split('T')[0],
            close: quotes.close[i],
            high: quotes.high[i],
            low: quotes.low[i],
            open: quotes.open[i],
            volume: quotes.volume[i]
        })).filter(d => d.close !== null && d.close !== undefined);

        if (cleanData.length < 30) return null; // データ不足

        const currentPrice = meta.regularMarketPrice || cleanData[cleanData.length - 1].close;
        const previousClose = meta.previousClose || cleanData[cleanData.length - 2].close;

        // ファンダメンタルデータの結合
        const fundamentalData = fundamentalResult ? fundamentalResult.fundamental : {};
        const sentimentData = fundamentalResult ? fundamentalResult.sentiment : {};

        return {
            symbol,
            currentPrice,
            previousClose,
            change: ((currentPrice - previousClose) / previousClose) * 100,
            high52Week: meta.fiftyTwoWeekHigh,
            low52Week: meta.fiftyTwoWeekLow,
            volume: meta.regularMarketVolume,
            marketCap: meta.marketCap || 0,
            history: cleanData, // 全履歴
            closes: cleanData.map(d => d.close), // 計算用
            // 追加データ
            fundamental: fundamentalData,
            sentiment: sentimentData
        };
    } catch (error) {
        console.warn(`Failed to fetch ${symbol}:`, error.message);
        return null; // 重大なエラー
    }
}

/**
 * テクニカル指標計算ヘルパー
 */
const Indicators = {
    ma: (prices, period) => {
        if (prices.length < period) return prices[prices.length - 1];
        const slice = prices.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    },
    rsi: (prices, period = 14) => {
        if (prices.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        if (losses === 0) return 100;
        const rs = gains / losses;
        return 100 - (100 / (1 + rs));
    },
    bollingerBands: (prices, period = 20, multiplier = 2) => {
        if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
        const slice = prices.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        return { upper: mean + multiplier * stdDev, middle: mean, lower: mean - multiplier * stdDev };
    },
    volatility: (prices, period = 20) => {
        if (prices.length < period) return 0;
        const slice = prices.slice(-period);
        const returns = [];
        for (let i = 1; i < slice.length; i++) returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(252) * 100;
    }
};

/**
 * 取得したリアルデータからAssetDataオブジェクトを構築してスコア計算
 */
function calculateRealScore(quoteData) {
    if (!quoteData || !quoteData.closes || quoteData.closes.length < 30) {
        return { totalScore: 50, factors: {}, category: { label: 'Unknown', color: 'neutral' } };
    }

    const prices = quoteData.closes;
    const currentPrice = prices[prices.length - 1];

    // 1. テクニカル分析
    const rsi = Indicators.rsi(prices);
    const shortMA = Indicators.ma(prices, 10);
    const longMA = Indicators.ma(prices, 50);
    const macdLine = shortMA - longMA;
    const bb = Indicators.bollingerBands(prices);

    // 2. モメンタム分析
    const oneMonthReturn = prices.length >= 21 ? (currentPrice / prices[prices.length - 21] - 1) * 100 : 0;
    const threeMonthReturn = prices.length >= 63 ? (currentPrice / prices[prices.length - 63] - 1) * 100 : oneMonthReturn;
    const sixMonthReturn = prices.length >= 126 ? (currentPrice / prices[prices.length - 126] - 1) * 100 : threeMonthReturn;

    // 3. リスク分析
    const volatility = Indicators.volatility(prices);

    // 4. ファンダメンタル & センチメント (取得できていれば使用、なければデフォルト)
    const fund = quoteData.fundamental || {};
    const sent = quoteData.sentiment || {};

    // AssetData構築
    const assetData = {
        technical: {
            rsi, macdLine, signalLine: 0, histogram: macdLine,
            shortMA, longMA, price: currentPrice,
            bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower
        },
        momentum: {
            oneMonthReturn, threeMonthReturn, sixMonthReturn, relativeStrength: 0
        },
        risk: {
            volatility, beta: 1.0, maxDrawdown: -10, sharpeRatio: 1.0
        },
        sentiment: {
            newsScore: 50, // ニュースは取得困難
            analystRating: sent.analystRating || 3, // アナリスト評価を使用！
            epsRevision: 0,
            socialScore: 50
        },
        fundamental: {
            per: fund.per || 20,
            pbr: fund.pbr || 2,
            roe: fund.roe || 10,
            revenueGrowth: fund.revenueGrowth || 5,
            debtRatio: fund.debtRatio || 0.5,
            dividendYield: fund.dividendYield || 2,
            industryAvgPER: 20
        }
    };

    return scoreAsset(assetData, 'stock');
}

/**
 * 複数銘柄のデータを一括取得（レートリミット考慮）
 */
export async function fetchMultipleQuotes(symbols, onProgress = null) {
    const results = {};
    const batchSize = 3;

    for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        // 並列処理
        const promises = batch.map(s => fetchYahooQuote(s));
        const batchResults = await Promise.all(promises);

        batchResults.forEach((result, idx) => {
            const symbol = batch[idx];
            if (result) {
                const scoring = calculateRealScore(result);
                results[symbol] = {
                    ...result,
                    ...scoring, // totalScoreなど
                    rawData: scoring.rawData,
                    market: 'US',
                    type: 'us-stock',
                    sector: 'Unknown', // セクターはsp500Data等から補完推奨
                };
            }
        });

        if (onProgress) {
            onProgress(Math.min(100, Math.round(((i + batchSize) / symbols.length) * 100)));
        }

        // 負荷軽減のため少し待機
        if (i + batchSize < symbols.length) {
            await new Promise(r => setTimeout(r, 800));
        }
    }

    return results;
}

const CACHE_KEY = 'real_stock_quotes_v2'; // バージョンアップ
const CACHE_DURATION = 30 * 60 * 1000; // データが増えたのでキャッシュ期間を30分に延長

export async function getCachedQuotes(symbols, forceRefresh = false, onProgress = null) {
    const now = Date.now();
    let cachedData = {};

    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (!forceRefresh && (now - parsed.timestamp < CACHE_DURATION)) {
                cachedData = parsed.data || {};
            }
        }
    } catch (e) {
        console.warn('Cache read failed:', e);
    }

    // キャッシュにない銘柄だけ取得
    const missingSymbols = symbols.filter(s => !cachedData[s]);

    if (missingSymbols.length > 0) {
        if (onProgress) onProgress(10);
        const freshData = await fetchMultipleQuotes(missingSymbols, (p) => {
            if (onProgress) onProgress(10 + (p * 0.9));
        });

        cachedData = { ...cachedData, ...freshData };

        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: cachedData,
                timestamp: now,
            }));
        } catch (e) {
            console.warn('Cache write failed (Storage full?):', e);
        }
    } else {
        if (onProgress) onProgress(100);
    }

    return cachedData;
}
