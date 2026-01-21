/**
 * サンプルデータ生成 (S&P 500 全銘柄対応版 + リアルデータサポート)
 * デフォルトでは決定論的モックデータを返し、別途リアルデータで上書きする機能を提供
 */

import { scoreAsset } from './scoringEngine';
import { STOCK_DATA } from './sp500Data';
import { getCachedQuotes } from './realStockData';

// マスタデータをSTOCK_DATAから構築
const ASSETS_MASTER = Object.entries(STOCK_DATA).map(([symbol, data]) => ({
    symbol,
    name: data.name,
    type: 'us-stock', // S&P500は米国株
    sector: data.sector,
    market: 'US',
    basePrice: data.basePrice
}));

/**
 * シード付き擬似乱数生成器
 */
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * シミュレーション価格を生成（モック用）
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
 * モックデータを生成（決定論的）
 */
function generateAssetData(asset) {
    const today = new Date();
    const startDate = new Date('2024-01-01');
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

    // 価格履歴生成 (簡易版)
    const history = [];
    const lookback = 30;
    let currentPrice = asset.basePrice;

    for (let i = lookback; i >= 0; i--) {
        const price = generateSimulatedPrice(asset.basePrice, daysSinceStart - i, asset.symbol);
        currentPrice = price;
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        history.push({
            date: date.toISOString().split('T')[0],
            close: price,
            open: price, high: price, low: price,
            volume: Math.floor(generateSimulatedPrice(1000000, i, asset.symbol))
        });
    }

    const previousPrice = history[history.length - 2].close;

    // モック用のスコアリングデータ（実際にはrealStockDataで上書きされることを期待）
    const assetData = {
        technical: {
            rsi: 50, macdLine: 0, signalLine: 0, histogram: 0, shortMA: currentPrice, longMA: currentPrice,
            price: currentPrice, bbUpper: currentPrice * 1.05, bbMiddle: currentPrice, bbLower: currentPrice * 0.95
        },
        momentum: { oneMonthReturn: 0, threeMonthReturn: 0, sixMonthReturn: 0, relativeStrength: 0 },
        risk: { volatility: 20, beta: 1.0, maxDrawdown: -10, sharpeRatio: 1.0 },
        sentiment: { newsScore: 50, analystRating: 3, epsRevision: 0, socialScore: 50 },
        fundamental: { per: 20, pbr: 2, roe: 15, revenueGrowth: 5, debtRatio: 0.5, dividendYield: 2, industryAvgPER: 20 }
    };

    const scoring = scoreAsset(assetData, 'stock');

    return {
        ...asset,
        ...scoring,
        currentPrice: Math.round(currentPrice * 100) / 100,
        priceChange: Math.round(((currentPrice - previousPrice) / previousPrice) * 100 * 100) / 100,
        priceHistory: history,
        volume: history[history.length - 1].volume,
        marketCap: currentPrice * 100000000,
        nisa: { isGrowth: true, isTsumitate: false, categories: ['growth'] },
        isMock: true // モックであることを示すフラグ
    };
}

// 全資産のサンプルデータ（モック）を生成
export function generateSampleData() {
    return ASSETS_MASTER.map(asset => generateAssetData(asset));
}

/**
 * 【重要】リアルデータを使用して資産リストを更新
 */
export async function updateAssetsWithRealData(currentAssets, onProgress = null) {
    const symbols = currentAssets.map(a => a.symbol);

    // リアルデータ取得（キャッシュ優先）
    const realDataMap = await getCachedQuotes(symbols, false, onProgress);

    // 取得できたデータだけ上書き
    return currentAssets.map(asset => {
        const realData = realDataMap[asset.symbol];
        if (!realData) return asset; // 取得失敗時はモックのまま

        return {
            ...asset,
            // リアルデータで上書き
            currentPrice: realData.currentPrice,
            priceChange: realData.change,
            totalScore: realData.totalScore,
            category: realData.category,
            factors: realData.factors,
            priceHistory: realData.history.map(h => ({
                date: h.date,
                close: h.close,
                open: h.open || h.close,
                high: h.high || h.close,
                low: h.low || h.close,
                volume: h.volume || 0
            })),
            marketCap: realData.marketCap || asset.marketCap,
            volume: realData.volume || asset.volume,
            isMock: false // リアルデータになった
        };
    });
}

// フィルタリング
export function filterAssets(assets, filters) {
    return assets.filter(asset => {
        if (filters.market && asset.market !== filters.market) return false;
        if (filters.sector && filters.sector !== 'all' && asset.sector !== filters.sector) return false;
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

export function getMarkets() { return ['US']; }
export function getSectors() { return [...new Set(ASSETS_MASTER.map(a => a.sector))]; }
export function getAssetTypes() { return [{ value: 'us-stock', label: '米国株' }]; }
