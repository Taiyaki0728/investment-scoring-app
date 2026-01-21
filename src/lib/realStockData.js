/**
 * リアル株価データ取得とスコア計算
 * CORSプロキシ経由でYahoo Financeからデータを取得
 */

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Yahoo Finance APIからリアルタイム価格を取得
 */
async function fetchYahooQuote(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
        const response = await fetch(CORS_PROXY + encodeURIComponent(url));

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            return null;
        }

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0];
        const timestamps = result.timestamp;

        if (!quotes || !timestamps || timestamps.length === 0) {
            return null;
        }

        // 直近の価格データを取得
        const closes = quotes.close.filter(c => c !== null);
        const currentPrice = meta.regularMarketPrice || closes[closes.length - 1];
        const previousClose = meta.previousClose || closes[closes.length - 2];

        return {
            symbol,
            currentPrice,
            previousClose,
            change: ((currentPrice - previousClose) / previousClose) * 100,
            closes, // 過去の終値（スコア計算用）
            high52Week: meta.fiftyTwoWeekHigh,
            low52Week: meta.fiftyTwoWeekLow,
            volume: meta.regularMarketVolume,
        };
    } catch (error) {
        console.warn(`Failed to fetch ${symbol}:`, error.message);
        return null;
    }
}

/**
 * RSI（相対力指数）を計算
 */
function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * モメンタム（変化率）を計算
 */
function calculateMomentum(closes, days = 20) {
    if (closes.length < days) return 0;
    const recent = closes[closes.length - 1];
    const past = closes[closes.length - days];
    return ((recent - past) / past) * 100;
}

/**
 * ボラティリティを計算
 */
function calculateVolatility(closes, days = 20) {
    if (closes.length < days) return 0;

    const recentCloses = closes.slice(-days);
    const returns = [];

    for (let i = 1; i < recentCloses.length; i++) {
        returns.push((recentCloses[i] - recentCloses[i - 1]) / recentCloses[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(252) * 100; // 年率換算
}

/**
 * 総合スコアを計算（0-100）
 */
function calculateScore(quoteData) {
    if (!quoteData || !quoteData.closes || quoteData.closes.length < 5) {
        return 50; // データ不十分の場合は中立
    }

    const closes = quoteData.closes;

    // RSIスコア（30以下で買い、70以上で売りシグナル）
    const rsi = calculateRSI(closes);
    let rsiScore;
    if (rsi < 30) rsiScore = 80;
    else if (rsi < 45) rsiScore = 65;
    else if (rsi < 55) rsiScore = 50;
    else if (rsi < 70) rsiScore = 40;
    else rsiScore = 25;

    // モメンタムスコア
    const momentum = calculateMomentum(closes);
    let momentumScore = 50 + momentum * 2; // -25% to +25% -> 0 to 100
    momentumScore = Math.max(0, Math.min(100, momentumScore));

    // ボラティリティスコア（低いほど高スコア）
    const volatility = calculateVolatility(closes);
    let volatilityScore = 100 - volatility * 2; // 低ボラティリティが好ましい
    volatilityScore = Math.max(0, Math.min(100, volatilityScore));

    // 52週レンジスコア
    let rangeScore = 50;
    if (quoteData.high52Week && quoteData.low52Week) {
        const range = quoteData.high52Week - quoteData.low52Week;
        const position = (quoteData.currentPrice - quoteData.low52Week) / range;
        // 中間付近が良い（底値からの上昇余地あり、天井ではない）
        rangeScore = position < 0.3 ? 70 : position > 0.8 ? 30 : 55;
    }

    // 総合スコア（重み付け平均）
    const totalScore =
        rsiScore * 0.30 +
        momentumScore * 0.35 +
        volatilityScore * 0.15 +
        rangeScore * 0.20;

    return Math.round(totalScore);
}

/**
 * 複数銘柄のデータを一括取得
 */
export async function fetchMultipleQuotes(symbols, onProgress = null) {
    const results = {};
    const batchSize = 5; // 同時リクエスト数

    for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        const promises = batch.map(s => fetchYahooQuote(s));
        const batchResults = await Promise.all(promises);

        batchResults.forEach((result, idx) => {
            const symbol = batch[idx];
            if (result) {
                results[symbol] = {
                    ...result,
                    score: calculateScore(result),
                };
            }
        });

        if (onProgress) {
            onProgress(Math.min(100, Math.round(((i + batchSize) / symbols.length) * 100)));
        }

        // レートリミット対策
        if (i + batchSize < symbols.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return results;
}

/**
 * キャッシュ付きデータ取得（LocalStorage使用）
 */
const CACHE_KEY = 'stock_quotes_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5分

export async function getCachedQuotes(symbols, forceRefresh = false, onProgress = null) {
    const now = Date.now();

    if (!forceRefresh) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (now - timestamp < CACHE_DURATION) {
                    return data;
                }
            }
        } catch (e) {
            console.warn('Cache read failed:', e);
        }
    }

    const data = await fetchMultipleQuotes(symbols, onProgress);

    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: now,
        }));
    } catch (e) {
        console.warn('Cache write failed:', e);
    }

    return data;
}

export { calculateRSI, calculateMomentum, calculateVolatility, calculateScore };
