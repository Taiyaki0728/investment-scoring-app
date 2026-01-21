/**
 * サンプルデータ生成
 * 
 * 実際のAPIがない場合のデモ用データ
 */

import { scoreAsset } from './scoringEngine';

// 銘柄マスターデータ
const ASSETS_MASTER = [
    // 米国株
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'us-stock', sector: 'テクノロジー', market: 'US' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'us-stock', sector: 'テクノロジー', market: 'US' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'us-stock', sector: 'テクノロジー', market: 'US' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'us-stock', sector: '消費財', market: 'US' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'us-stock', sector: 'テクノロジー', market: 'US' },
    { symbol: 'META', name: 'Meta Platforms Inc.', type: 'us-stock', sector: 'テクノロジー', market: 'US' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'us-stock', sector: '自動車', market: 'US' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', type: 'us-stock', sector: '金融', market: 'US' },
    { symbol: 'V', name: 'Visa Inc.', type: 'us-stock', sector: '金融', market: 'US' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'us-stock', sector: 'ヘルスケア', market: 'US' },

    // 日本株
    { symbol: '7203.T', name: 'トヨタ自動車', type: 'jp-stock', sector: '自動車', market: 'JP' },
    { symbol: '6758.T', name: 'ソニーグループ', type: 'jp-stock', sector: 'テクノロジー', market: 'JP' },
    { symbol: '9984.T', name: 'ソフトバンクグループ', type: 'jp-stock', sector: '通信', market: 'JP' },
    { symbol: '6861.T', name: 'キーエンス', type: 'jp-stock', sector: '電気機器', market: 'JP' },
    { symbol: '8306.T', name: '三菱UFJフィナンシャル', type: 'jp-stock', sector: '金融', market: 'JP' },
    { symbol: '9433.T', name: 'KDDI', type: 'jp-stock', sector: '通信', market: 'JP' },
    { symbol: '6501.T', name: '日立製作所', type: 'jp-stock', sector: '電気機器', market: 'JP' },
    { symbol: '4063.T', name: '信越化学工業', type: 'jp-stock', sector: '化学', market: 'JP' },

    // 金・コモディティ
    { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'gold', sector: 'コモディティ', market: 'US' },
    { symbol: 'IAU', name: 'iShares Gold Trust', type: 'gold', sector: 'コモディティ', market: 'US' },
    { symbol: 'SLV', name: 'iShares Silver Trust', type: 'gold', sector: 'コモディティ', market: 'US' },

    // ETF
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'etf', sector: 'インデックス', market: 'US' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', sector: 'インデックス', market: 'US' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market', type: 'etf', sector: 'インデックス', market: 'US' },
    { symbol: '1306.T', name: 'TOPIX連動型ETF', type: 'etf', sector: 'インデックス', market: 'JP' },
];

// ランダム値を生成するユーティリティ
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
}

// ファンダメンタルデータを生成
function generateFundamentalData(assetType) {
    if (assetType === 'gold') {
        return null; // 金にはファンダメンタルなし
    }

    return {
        per: randomBetween(8, 45),
        pbr: randomBetween(0.8, 4.5),
        roe: randomBetween(-5, 35),
        revenueGrowth: randomBetween(-15, 40),
        debtRatio: randomBetween(0.1, 2.0),
        dividendYield: randomBetween(0, 5),
        industryAvgPER: randomBetween(15, 25),
    };
}

// テクニカルデータを生成
function generateTechnicalData() {
    const price = randomBetween(50, 500);
    const shortMA = price * randomBetween(0.95, 1.05);
    const longMA = price * randomBetween(0.90, 1.10);
    const bbMiddle = (shortMA + longMA) / 2;
    const bbWidth = price * 0.1;

    return {
        price,
        rsi: randomBetween(20, 80),
        macdLine: randomBetween(-5, 5),
        signalLine: randomBetween(-5, 5),
        histogram: randomBetween(-2, 2),
        shortMA,
        longMA,
        bbUpper: bbMiddle + bbWidth,
        bbMiddle,
        bbLower: bbMiddle - bbWidth,
    };
}

// モメンタムデータを生成
function generateMomentumData() {
    return {
        oneMonthReturn: randomBetween(-15, 25),
        threeMonthReturn: randomBetween(-25, 45),
        sixMonthReturn: randomBetween(-35, 70),
        relativeStrength: randomBetween(-20, 20),
    };
}

// センチメントデータを生成
function generateSentimentData() {
    return {
        newsScore: randomBetween(30, 85),
        analystRating: randomBetween(1.5, 4.8),
        epsRevision: randomBetween(-15, 25),
        socialScore: randomBetween(35, 80),
    };
}

// リスクデータを生成
function generateRiskData() {
    return {
        volatility: randomBetween(10, 50),
        beta: randomBetween(0.5, 1.8),
        maxDrawdown: randomBetween(-50, -5),
        sharpeRatio: randomBetween(-0.5, 2.5),
    };
}

// 価格履歴を生成
function generatePriceHistory(days = 30) {
    const history = [];
    let price = randomBetween(100, 300);

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        const dailyChange = randomBetween(-0.03, 0.03);
        price *= (1 + dailyChange);

        history.push({
            date: date.toISOString().split('T')[0],
            open: price * randomBetween(0.99, 1.01),
            high: price * randomBetween(1.01, 1.03),
            low: price * randomBetween(0.97, 0.99),
            close: price,
            volume: randomInt(1000000, 50000000),
        });
    }

    return history;
}

// NISA区分を判定
function determineNisaCategory(asset) {
    // 簡易的な判定ロジック
    const categories = ['growth']; // ほとんどの上場株式・ETFは成長枠対象

    // つみたて枠の対象判定（シミュレーション：インデックスETFのみ対象とする）
    if (asset.type === 'etf' && asset.sector === 'インデックス') {
        categories.push('tsumitate');
    }

    return categories;
}

// 完全な資産データを生成
function generateAssetData(asset) {
    const assetType = asset.type === 'us-stock' || asset.type === 'jp-stock' ? 'stock' : asset.type;

    const assetData = {
        fundamental: generateFundamentalData(assetType),
        technical: generateTechnicalData(),
        momentum: generateMomentumData(),
        sentiment: generateSentimentData(),
        risk: generateRiskData(),
    };

    const scoring = scoreAsset(assetData, assetType);
    const priceHistory = generatePriceHistory(30);
    const currentPrice = priceHistory[priceHistory.length - 1].close;
    const previousPrice = priceHistory[priceHistory.length - 2].close;
    const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;

    const nisaCategories = determineNisaCategory(asset);

    return {
        ...asset,
        ...scoring,
        currentPrice: Math.round(currentPrice * 100) / 100,
        priceChange: Math.round(priceChange * 100) / 100,
        priceHistory,
        volume: randomInt(1000000, 100000000),
        marketCap: randomInt(10, 3000) * 1000000000,
        rawData: assetData,
        nisa: {
            isGrowth: nisaCategories.includes('growth'),
            isTsumitate: nisaCategories.includes('tsumitate'),
            categories: nisaCategories
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
        if (filters.sector && asset.sector !== filters.sector) return false;
        if (filters.type && asset.type !== filters.type) return false;
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
    return [...new Set(ASSETS_MASTER.map(a => a.market))];
}

// セクター一覧を取得
export function getSectors() {
    return [...new Set(ASSETS_MASTER.map(a => a.sector))];
}

// 資産タイプ一覧を取得
export function getAssetTypes() {
    return [
        { value: 'us-stock', label: '米国株' },
        { value: 'jp-stock', label: '日本株' },
        { value: 'gold', label: '金・コモディティ' },
        { value: 'etf', label: 'ETF' },
    ];
}
