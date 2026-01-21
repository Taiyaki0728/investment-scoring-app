/**
 * リアル株価データ取得とスコア計算
 * CORSプロキシ経由でYahoo Financeからデータを取得
 * scoringEngine.jsの正規アルゴリズムを使用
 */

import {
    scoreAsset,
    calculateTotalScore
} from './scoringEngine';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Yahoo Finance APIからリアルタイム価格を取得
 * 期間を長めに取得して長期MAなどを計算可能にする
 */
async function fetchYahooQuote(symbol) {
    // 日本株の場合は .T を追加するなどの処理が必要だが、
    // sp500Data.jsは米国株前提なのでそのまま使用
    const querySymbol = symbol;

    try {
        // 6ヶ月分のデータを取得
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1d&range=6mo`;
        const response = await fetch(CORS_PROXY + encodeURIComponent(url));

        if (!response.ok) {
            console.warn(`HTTP error fetching ${symbol}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

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
            closes: cleanData.map(d => d.close) // 計算用
        };
    } catch (error) {
        console.warn(`Failed to fetch ${symbol}:`, error.message);
        return null;
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

    // AssetData構築
    const assetData = {
        technical: {
            rsi,
            macdLine,
            signalLine: 0,
            histogram: macdLine, // 簡易
            shortMA, longMA,
            price: currentPrice,
            bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower
        },
        momentum: {
            oneMonthReturn,
            threeMonthReturn,
            sixMonthReturn,
            relativeStrength: 0 // 比較対象なしのため0
        },
        risk: {
            volatility,
            beta: 1.0,
            maxDrawdown: -10, // 簡易
            sharpeRatio: 1.0
        },
        // Yahoo Financeの無料APIではファンダメンタルやセンチメントは取得困難なため、
        // ニュートラル値またはランダムなシード値で埋める（完全な0だとスコアが低くなりすぎる）
        sentiment: {
            newsScore: 50,
            analystRating: 3,
            epsRevision: 0,
            socialScore: 50
        },
        fundamental: {
            per: 20,
            pbr: 2,
            roe: 10,
            revenueGrowth: 5,
            debtRatio: 0.5,
            dividendYield: 2,
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
    const batchSize = 3; // レート制限回避のため少なめに

    for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        // 並列処理だが、それぞれの完了を待つ
        const promises = batch.map(s => fetchYahooQuote(s));
        const batchResults = await Promise.all(promises);

        batchResults.forEach((result, idx) => {
            const symbol = batch[idx];
            if (result) {
                const scoring = calculateRealScore(result);
                results[symbol] = {
                    ...result,
                    ...scoring, // totalScore, factors, etc.
                    // UI互換性のフィールド
                    rawData: scoring.rawData,
                    market: 'US',
                    type: 'us-stock',
                    sector: 'Unknown', // セクター情報は失われるので後でマージが必要
                };
            }
        });

        if (onProgress) {
            onProgress(Math.min(100, Math.round(((i + batchSize) / symbols.length) * 100)));
        }

        // インターバル（無料APIへの攻撃とみなされないように）
        if (i + batchSize < symbols.length) {
            await new Promise(r => setTimeout(r, 800));
        }
    }

    return results;
}

/**
 * キャッシュ付きデータ取得
 */
const CACHE_KEY = 'real_stock_quotes_v1';
const CACHE_DURATION = 15 * 60 * 1000; // 15分キャッシュ

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
        if (onProgress) onProgress(10); // 開始の合図
        const freshData = await fetchMultipleQuotes(missingSymbols, (p) => {
            if (onProgress) onProgress(10 + (p * 0.9)); // 10%〜100%
        });

        // マージ
        cachedData = { ...cachedData, ...freshData };

        // 保存
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: cachedData,
                timestamp: now,
            }));
        } catch (e) {
            console.warn('Cache write failed (storage full?):', e);
        }
    } else {
        if (onProgress) onProgress(100);
    }

    return cachedData;
}
