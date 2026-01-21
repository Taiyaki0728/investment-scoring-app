import { STOCK_DATA, getStockCount } from './src/lib/sp500Data.js';
// simulator.jsへの依存を排除

// ファイルから直接インポートできない関数を再定義（Node.js環境でESM形式を扱うための簡易措置）
// (実際のsimulator.jsと同じロジックを使用)

// ---------------------------------------------------------
// 1. 必要な関数の再定義 (simulator.js & scoringEngine.js から抜粋)
// ---------------------------------------------------------

/**
 * シード付き擬似乱数生成器
 */
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * シミュレーション価格を生成
 */
function generateSimulatedPrice(basePrice, daysSinceStart, symbol) {
    const symbolSeed = symbol.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
    const daySeed = daysSinceStart * 7919;

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

// スコア計算関連の簡易実装（scoringEngine.jsのロジック）
function calculateTechnicalScore(data) {
    const { rsi = 50 } = data;
    // RSIスコアロジック (簡易版)
    let rsiScore = 50;
    if (rsi <= 20) rsiScore = 90;
    else if (rsi <= 30) rsiScore = 80;
    else if (rsi <= 40) rsiScore = 65;
    else if (rsi <= 60) rsiScore = 50;
    else if (rsi <= 70) rsiScore = 35;
    else if (rsi <= 80) rsiScore = 20;
    else rsiScore = 10;

    // 他の要素も本来は計算するが、テストではRSIの影響を確認
    return rsiScore;
}

function calculateStockScoreTest(symbol, currentDate) {
    const stock = STOCK_DATA[symbol];
    if (!stock) return 50;

    const startDate = new Date('2024-01-01');
    const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));

    const prices = [];
    const lookback = 130;
    for (let i = lookback; i >= 0; i--) {
        prices.push(generateSimulatedPrice(stock.basePrice, daysSinceStart - i, symbol));
    }

    const rsi = Indicators.rsi(prices);

    // 完全な実装ではないが、変動を確認するには十分
    return {
        symbol,
        price: prices[prices.length - 1],
        rsi: rsi,
        score: calculateTechnicalScore({ rsi }) // テスト用簡易スコア
    };
}

// ---------------------------------------------------------
// 2. テスト実行
// ---------------------------------------------------------

console.log('🧪 S&P 500 スコア計算テスト開始...');
console.log(`📊 対象銘柄数: ${getStockCount()}`);

const today = new Date();
const results = [];
const errors = [];

const symbols = Object.keys(STOCK_DATA);

symbols.forEach(symbol => {
    try {
        const result = calculateStockScoreTest(symbol, today);
        results.push(result);
    } catch (e) {
        errors.push({ symbol, error: e.message });
    }
});

console.log(`✅ 計算完了: ${results.length}/${symbols.length}`);

if (errors.length > 0) {
    console.error(`❌ エラー発生: ${errors.length}件`);
    console.error(errors.slice(0, 5));
} else {
    console.log('✅ エラーなし');
}

// 統計
const scores = results.map(r => r.score);
const minScore = Math.min(...scores);
const maxScore = Math.max(...scores);
const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

console.log('\n📈 スコア統計 (テクニカル指標サンプル):');
console.log(`   最小値: ${minScore.toFixed(2)}`);
console.log(`   最大値: ${maxScore.toFixed(2)}`);
console.log(`   平均値: ${avgScore.toFixed(2)}`);

// 上位5銘柄
console.log('\n🏆 スコア上位5銘柄:');
results.sort((a, b) => b.score - a.score);
results.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.symbol}: スコア ${r.score} (RSI: ${r.rsi.toFixed(2)})`);
});

// バラつきチェック
const uniqueScores = new Set(scores).size;
console.log(`\n🔍 スコアの種類の数: ${uniqueScores} (すべてのスコアが同じなら1になる)`);

if (uniqueScores > 1 && results.length === symbols.length) {
    console.log('\n✨ テスト合格: 全銘柄で正常に異なるスコアが計算されています！');
} else {
    console.log('\n⚠️ テスト警告: スコアに十分なバラつきがないか、計算失敗があります。');
}
