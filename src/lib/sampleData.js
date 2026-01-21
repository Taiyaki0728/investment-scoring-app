/**
 * サンプルデータ生成 (S&P 500 全銘柄対応版)
 * サーバー不要、決定論的なデータ生成によりリロードしてもスコアを維持
 */

import { scoreAsset } from './scoringEngine';
import { STOCK_DATA } from './sp500Data';
import {
    calculateTechnicalScore,
    calculateMomentumScore,
    calculateRiskScore,
    calculateTotalScore
} from './scoringEngine';

// マスタデータをSTOCK_DATAから構築
// STOCK_DATAは { "AAPL": { name: "Apple", sector: "Technology", ... } } 形式を想定
const ASSETS_MASTER = Object.entries(STOCK_DATA).map(([symbol, data]) => ({
    symbol,
    name: data.name,
    type: 'us-stock', // S&P500は全て米国株として扱う
    sector: data.sector,
    market: 'US', // フィルタリング用にUSで統一
    basePrice: data.basePrice
}));

/**
 * シード付き擬似乱数生成器（simulator.jsと共有可能なロジック）
 */
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * シミュレーション価格を生成（決定論的）
 */
function generateSimulatedPrice(basePrice, daysSinceStart, symbol) {
    const symbolSeed = symbol.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
    const daySeed = daysSinceStart * 7919;

    // 複数の波を組み合わせて自然な価格変動を模倣
    const wave1 = Math.sin((daysSinceStart + symbolSeed) * 0.05) * 0.03;
    const wave2 = Math.sin((daysSinceStart + symbolSeed) * 0.15) * 0.015;
    const wave3 = Math.sin((daysSinceStart + symbolSeed) * 0.02) * 0.05;
    const microNoise = seededRandom(daySeed + symbolSeed) * 0.02 - 0.01;

    const dailyVariation = 1 + wave1 + wave2 + wave3 + microNoise;
    const trendFactor = ((symbolSeed % 40) - 20) / 100;
    const trend = 1 + (daysSinceStart / 365) * trendFactor;

    return basePrice * dailyVariation * trend;
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
 * 資産データを生成（決定論的）
 */
function generateAssetData(asset) {
    const today = new Date();
    const startDate = new Date('2024-01-01');
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

    // 価格履歴生成 (過去130日)
    const prices = [];
    const history = [];
    const lookback = 130;

    for (let i = lookback; i >= 0; i--) {
        const price = generateSimulatedPrice(asset.basePrice, daysSinceStart - i, asset.symbol);
        prices.push(price);

        // 直近30日は履歴として保存
        if (i <= 30) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            history.push({
                date: date.toISOString().split('T')[0],
                close: price,
                open: price * 1.002, // 簡易生成
                high: price * 1.01,
                low: price * 0.99,
                volume: Math.floor(generateSimulatedPrice(1000000, i, asset.symbol)) // 音量も決定論的
            });
        }
    }

    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2];

    // テクニカル指標計算
    const rsi = Indicators.rsi(prices);
    const shortMA = Indicators.ma(prices, 10);
    const longMA = Indicators.ma(prices, 30);
    const bb = Indicators.bollingerBands(prices);

    // スコアリング用データ構築
    const assetData = {
        technical: {
            rsi,
            macdLine: shortMA - longMA,
            signalLine: 0,
            histogram: (shortMA - longMA),
            shortMA, longMA,
            price: currentPrice,
            bbUpper: bb.upper, bbMiddle: bb.middle, bbLower: bb.lower
        },
        momentum: {
            oneMonthReturn: (currentPrice / prices[prices.length - 21] - 1) * 100,
            threeMonthReturn: (currentPrice / prices[prices.length - 63] - 1) * 100,
            sixMonthReturn: (currentPrice / prices[0] - 1) * 100,
            relativeStrength: 0
        },
        risk: {
            volatility: Indicators.volatility(prices),
            beta: 1.0,
            maxDrawdown: -10,
            sharpeRatio: 1.0
        },
        sentiment: { // 決定論的中立
            newsScore: 50 + (asset.symbol.charCodeAt(0) % 20),
            analystRating: 3,
            epsRevision: 0,
            socialScore: 50
        },
        fundamental: { // 決定論的中立
            per: 20 + (asset.symbol.charCodeAt(1) % 15 - 7),
            pbr: 2,
            roe: 15,
            revenueGrowth: 5,
            debtRatio: 0.5,
            dividendYield: 2,
            industryAvgPER: 20
        }
    };

    // 正しいスコアリングエンジン実行
    const scoring = scoreAsset(assetData, 'stock');

    return {
        ...asset,
        ...scoring,
        currentPrice: Math.round(currentPrice * 100) / 100,
        priceChange: Math.round(((currentPrice - previousPrice) / previousPrice) * 100 * 100) / 100,
        priceHistory: history,
        volume: history[history[0] ? 0 : 0]?.volume || 1000000,
        marketCap: currentPrice * 100000000,
        nisa: {
            isGrowth: true,
            isTsumitate: false,
            categories: ['growth']
        }
    };
}

// 全資産のサンプルデータを生成
export function generateSampleData() {
    return ASSETS_MASTER.map(asset => generateAssetData(asset));
}

// 単一資産のデータを更新
export function refreshAssetData(assetSymbol) {
    const asset = ASSETS_MASTER.find(a => a.symbol === assetSymbol);
    if (!asset) return null;
    return generateAssetData(asset);
}

// フィルタリング
export function filterAssets(assets, filters) {
    return assets.filter(asset => {
        if (filters.market && asset.market !== filters.market) return false;

        // セクターフィルター
        // filters.sectorが日本語で来る場合と英語で来る場合があるため柔軟に対応
        if (filters.sector && filters.sector !== 'all') {
            if (asset.sector !== filters.sector) return false;
        }

        if (filters.type && filters.type !== 'all' && asset.type !== filters.type) return false;
        if (filters.minScore && asset.totalScore < filters.minScore) return false;
        if (filters.maxScore && asset.totalScore > filters.maxScore) return false;
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const matchSymbol = asset.symbol.toLowerCase().includes(searchLower);
            const matchName = asset.name.toLowerCase().includes(searchLower);
            if (!matchSymbol && !matchName) return false;
        }
        return true;
    });
}

// ソート
export function sortAssets(assets, sortBy = 'totalScore', order = 'desc') {
    return [...assets].sort((a, b) => {
        const aValue = a[sortBy] ?? 0;
        const bValue = b[sortBy] ?? 0;
        return order === 'desc' ? bValue - aValue : aValue - bValue;
    });
}

// 市場一覧を取得
export function getMarkets() {
    return ['US'];
}

// セクター一覧を取得
export function getSectors() {
    return [...new Set(ASSETS_MASTER.map(a => a.sector))];
}

// 資産タイプ一覧を取得
export function getAssetTypes() {
    return [
        { value: 'us-stock', label: '米国株' },
    ];
}
