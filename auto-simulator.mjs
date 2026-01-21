/**
 * 自動売買シミュレーター
 * 
 * アプリを開かなくても毎日自動で売買シミュレーションを実行し、
 * 結果をファイルに保存する
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// yahoo-finance2 v3用にインスタンス化
const yahooFinance = new YahooFinance();

// 設定
const CONFIG = {
    initialCapital: 1000000,  // 初期費用: 100万円
    maxPositions: 10,         // 最大保有銘柄数
    minScoreToHold: 55,       // 保有最低スコア
    rebalanceDay: 1,          // リバランス日（月初）
    dataDirectory: path.join(__dirname, 'simulation-data'),
    positionsFile: path.join(__dirname, 'simulation-data', 'current-positions.json'),
    historyFile: path.join(__dirname, 'simulation-data', 'simulation-history.json'),
    logFile: path.join(__dirname, 'simulation-data', 'simulation-log.txt'),
};

// 主要銘柄（シミュレーション対象）- S&P500 上位50銘柄
const TRADING_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'JPM', 'JNJ',
    'V', 'UNH', 'HD', 'PG', 'MA', 'XOM', 'LLY', 'ABBV', 'MRK', 'CVX',
    'PEP', 'COST', 'KO', 'AVGO', 'WMT', 'TMO', 'MCD', 'CSCO', 'ABT', 'ACN',
    'DHR', 'NEE', 'LIN', 'ADBE', 'CRM', 'TXN', 'PM', 'NKE', 'RTX', 'AMD',
    'ORCL', 'NFLX', 'INTC', 'HON', 'UPS', 'QCOM', 'LOW', 'INTU', 'BA', 'CAT'
];

// レート制限
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 600;

async function rateLimitedRequest(fn) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();
    return fn();
}

/**
 * ログ出力
 */
function log(message) {
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);

    try {
        fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
    } catch (e) {
        // ログファイル書き込み失敗は無視
    }
}

/**
 * データディレクトリの初期化
 */
function initializeDataDirectory() {
    if (!fs.existsSync(CONFIG.dataDirectory)) {
        fs.mkdirSync(CONFIG.dataDirectory, { recursive: true });
        log('📂 データディレクトリを作成しました');
    }
}

/**
 * 現在のポジションを読み込む
 */
function loadCurrentPositions() {
    try {
        if (fs.existsSync(CONFIG.positionsFile)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.positionsFile, 'utf-8'));
            return data;
        }
    } catch (e) {
        log(`⚠️ ポジションファイル読み込みエラー: ${e.message}`);
    }

    // 初期状態
    return {
        cash: CONFIG.initialCapital,
        holdings: [],
        startDate: new Date().toISOString(),
        lastUpdate: null,
        totalValue: CONFIG.initialCapital,
        totalReturn: 0,
        dailyReturns: []
    };
}

/**
 * ポジションを保存
 */
function saveCurrentPositions(positions) {
    try {
        fs.writeFileSync(CONFIG.positionsFile, JSON.stringify(positions, null, 2), 'utf-8');
    } catch (e) {
        log(`❌ ポジション保存エラー: ${e.message}`);
    }
}

/**
 * シミュレーション履歴に追加
 */
function appendToHistory(record) {
    try {
        let history = [];
        if (fs.existsSync(CONFIG.historyFile)) {
            history = JSON.parse(fs.readFileSync(CONFIG.historyFile, 'utf-8'));
        }
        history.push(record);

        // 最新365日分だけ保持
        if (history.length > 365) {
            history = history.slice(-365);
        }

        fs.writeFileSync(CONFIG.historyFile, JSON.stringify(history, null, 2), 'utf-8');
    } catch (e) {
        log(`❌ 履歴保存エラー: ${e.message}`);
    }
}

/**
 * 銘柄の現在価格を取得
 */
async function getCurrentPrices(symbols) {
    const prices = {};

    for (const symbol of symbols) {
        try {
            const result = await rateLimitedRequest(() =>
                yahooFinance.quote(symbol)
            );

            if (result && result.regularMarketPrice) {
                prices[symbol] = {
                    price: result.regularMarketPrice,
                    change: result.regularMarketChangePercent || 0,
                    name: result.shortName || symbol
                };
            }
        } catch (e) {
            log(`⚠️ ${symbol} 価格取得エラー: ${e.message}`);
        }
    }

    return prices;
}

/**
 * 銘柄のスコアを計算（過去データベース）
 */
async function calculateStockScores(symbols) {
    const scores = {};
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);  // 1年前から

    for (const symbol of symbols) {
        try {
            const result = await rateLimitedRequest(() =>
                yahooFinance.chart(symbol, {
                    period1: startDate.toISOString().split('T')[0],
                    period2: endDate.toISOString().split('T')[0],
                    interval: '1wk',
                })
            );

            if (result.quotes && result.quotes.length > 12) {
                const prices = result.quotes.map(q => q.close).filter(p => p != null);
                scores[symbol] = calculateScoreFromPrices(prices);
            }
        } catch (e) {
            // スキップ
        }
    }

    return scores;
}

/**
 * 価格履歴からスコアを計算
 */
function calculateScoreFromPrices(prices) {
    if (prices.length < 12) return 50;

    // モメンタム（過去12週のリターン）
    const momentum12w = (prices[prices.length - 1] - prices[prices.length - 13]) / prices[prices.length - 13];
    const momentum4w = prices.length >= 5
        ? (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5]
        : 0;

    // モメンタムスコア
    const momentumScore = Math.max(0, Math.min(100, (momentum12w + 0.3) / 0.8 * 100));

    // RSI計算
    const recentPrices = prices.slice(-14);
    let gains = 0, losses = 0;
    for (let i = 1; i < recentPrices.length; i++) {
        const change = recentPrices[i] - recentPrices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    let rsiScore = 50;
    if (rsi < 30) rsiScore = 80;
    else if (rsi < 50) rsiScore = 60;
    else if (rsi < 70) rsiScore = 50;
    else rsiScore = 30;

    // ボラティリティ
    const returns = [];
    for (let i = 1; i < Math.min(prices.length, 13); i++) {
        returns.push((prices[prices.length - i] - prices[prices.length - i - 1]) / prices[prices.length - i - 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(52);
    const riskScore = Math.max(0, Math.min(100, 100 - volatility * 100));

    // トレンドスコア
    let trendScore = 50;
    if (momentum4w > 0 && momentum12w > 0) trendScore = 75;
    else if (momentum4w > 0) trendScore = 60;
    else if (momentum4w < 0 && momentum12w < 0) trendScore = 25;

    // 総合スコア
    return Math.round(
        momentumScore * 0.35 +
        rsiScore * 0.20 +
        trendScore * 0.25 +
        riskScore * 0.20
    );
}

/**
 * 売買シミュレーションの実行
 */
async function runDailySimulation() {
    log('========================================');
    log('📊 売買シミュレーション開始');
    log('========================================');

    initializeDataDirectory();

    const positions = loadCurrentPositions();
    const today = new Date();

    // 初回（保有銘柄がない場合）または月初はリバランスを実行
    const isFirstRun = positions.holdings.length === 0;
    const isRebalanceDay = isFirstRun || today.getDate() === CONFIG.rebalanceDay;

    log(`💰 現在の資産: ¥${positions.totalValue.toLocaleString()}`);
    log(`📈 累計リターン: ${positions.totalReturn.toFixed(2)}%`);
    log(`📦 保有銘柄数: ${positions.holdings.length}`);

    if (isFirstRun) {
        log('🎉 初回実行です。今日からシミュレーションを開始します！');
    }

    // 1. 現在価格を取得
    const holdingSymbols = positions.holdings.map(h => h.symbol);
    const allSymbols = [...new Set([...holdingSymbols, ...TRADING_SYMBOLS])];

    log('\n🔄 価格データ取得中...');
    const currentPrices = await getCurrentPrices(allSymbols);

    // 2. ポートフォリオ評価額を更新
    let portfolioValue = positions.cash;
    const updatedHoldings = [];

    for (const holding of positions.holdings) {
        const priceInfo = currentPrices[holding.symbol];
        if (priceInfo) {
            const currentValue = holding.shares * priceInfo.price;
            const gain = currentValue - (holding.shares * holding.avgCost);
            const gainPct = (priceInfo.price / holding.avgCost - 1) * 100;

            updatedHoldings.push({
                ...holding,
                currentPrice: priceInfo.price,
                currentValue,
                gain,
                gainPct
            });

            portfolioValue += currentValue;
        } else {
            // 価格取得できない場合は前回の値を使用
            portfolioValue += holding.currentValue || (holding.shares * holding.avgCost);
            updatedHoldings.push(holding);
        }
    }

    const previousValue = positions.totalValue;
    const dailyReturn = previousValue > 0 ? (portfolioValue / previousValue - 1) * 100 : 0;
    const totalReturn = (portfolioValue / CONFIG.initialCapital - 1) * 100;

    log(`\n📊 本日の評価額: ¥${Math.round(portfolioValue).toLocaleString()}`);
    log(`📈 本日のリターン: ${dailyReturn >= 0 ? '+' : ''}${dailyReturn.toFixed(2)}%`);
    log(`📈 累計リターン: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);

    // 3. リバランス日の場合は売買を実行
    let trades = [];

    if (isRebalanceDay) {
        log('\n🔄 リバランス日です。ポートフォリオを調整します...');

        // スコアを計算
        const scores = await calculateStockScores(TRADING_SYMBOLS);

        // スコア順にソート
        const scoredStocks = Object.entries(scores)
            .map(([symbol, score]) => ({
                symbol,
                score,
                price: currentPrices[symbol]?.price || 0
            }))
            .filter(s => s.price > 0 && s.score >= CONFIG.minScoreToHold)
            .sort((a, b) => b.score - a.score)
            .slice(0, CONFIG.maxPositions);

        log(`\n🏆 上位銘柄（スコア${CONFIG.minScoreToHold}以上）:`);
        scoredStocks.forEach((s, i) => {
            log(`   ${i + 1}. ${s.symbol}: スコア ${s.score}`);
        });

        // 売却対象を決定
        const targetSymbols = scoredStocks.map(s => s.symbol);
        const sellTargets = updatedHoldings.filter(h => !targetSymbols.includes(h.symbol));

        // 売却してキャッシュに
        let availableCash = positions.cash;
        for (const holding of sellTargets) {
            const sellPrice = currentPrices[holding.symbol]?.price || holding.currentPrice;
            const sellValue = holding.shares * sellPrice;
            availableCash += sellValue;

            trades.push({
                type: 'SELL',
                symbol: holding.symbol,
                shares: holding.shares,
                price: sellPrice,
                value: sellValue,
                reason: 'スコア基準未達'
            });

            log(`   📤 売却: ${holding.symbol} ${holding.shares}株 @ ¥${sellPrice.toFixed(0)} = ¥${sellValue.toLocaleString()}`);
        }

        // 新規購入
        const existingSymbols = updatedHoldings.filter(h => targetSymbols.includes(h.symbol)).map(h => h.symbol);
        const newBuys = scoredStocks.filter(s => !existingSymbols.includes(s.symbol));

        if (newBuys.length > 0) {
            const cashPerStock = availableCash / (newBuys.length + existingSymbols.length);

            for (const stock of newBuys) {
                const shares = Math.floor(cashPerStock / stock.price);
                if (shares > 0) {
                    const buyValue = shares * stock.price;
                    availableCash -= buyValue;

                    updatedHoldings.push({
                        symbol: stock.symbol,
                        shares,
                        avgCost: stock.price,
                        currentPrice: stock.price,
                        currentValue: buyValue,
                        gain: 0,
                        gainPct: 0,
                        buyDate: today.toISOString()
                    });

                    trades.push({
                        type: 'BUY',
                        symbol: stock.symbol,
                        shares,
                        price: stock.price,
                        value: buyValue,
                        score: stock.score,
                        reason: '高スコア銘柄'
                    });

                    log(`   📥 購入: ${stock.symbol} ${shares}株 @ ¥${stock.price.toFixed(0)} = ¥${buyValue.toLocaleString()}`);
                }
            }
        }

        // 売却した銘柄を除外
        const finalHoldings = updatedHoldings.filter(h => !sellTargets.find(s => s.symbol === h.symbol));
        positions.holdings = finalHoldings;
        positions.cash = availableCash;
    } else {
        positions.holdings = updatedHoldings;
    }

    // 4. ポジションを更新して保存
    positions.totalValue = portfolioValue;
    positions.totalReturn = totalReturn;
    positions.lastUpdate = today.toISOString();
    positions.dailyReturns.push({
        date: today.toISOString().split('T')[0],
        return: dailyReturn,
        value: portfolioValue
    });

    // 最新30日分だけ保持
    if (positions.dailyReturns.length > 30) {
        positions.dailyReturns = positions.dailyReturns.slice(-30);
    }

    saveCurrentPositions(positions);

    // 5. 履歴に追加
    appendToHistory({
        date: today.toISOString(),
        portfolioValue: Math.round(portfolioValue),
        cash: Math.round(positions.cash),
        holdingsCount: positions.holdings.length,
        dailyReturn,
        totalReturn,
        trades,
        topHoldings: positions.holdings
            .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
            .slice(0, 5)
            .map(h => ({
                symbol: h.symbol,
                value: Math.round(h.currentValue || 0),
                gainPct: h.gainPct?.toFixed(2) || '0'
            }))
    });

    // 6. 結果サマリー
    log('\n========================================');
    log('📊 シミュレーション完了');
    log('========================================');
    log(`💰 評価額: ¥${Math.round(portfolioValue).toLocaleString()}`);
    log(`💵 現金: ¥${Math.round(positions.cash).toLocaleString()}`);
    log(`📈 累計リターン: ${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`);
    log(`📦 保有銘柄数: ${positions.holdings.length}`);

    if (trades.length > 0) {
        log(`🔄 本日の取引: ${trades.length}件`);
    }

    log('');

    return {
        success: true,
        portfolioValue,
        totalReturn,
        trades: trades.length
    };
}

/**
 * スケジューラーの設定
 */
function startScheduler() {
    // 毎日朝9時（日本時間）に実行
    // cron形式: 分 時 日 月 曜日
    cron.schedule('0 9 * * *', async () => {
        log('⏰ スケジュール実行開始');
        try {
            await runDailySimulation();
        } catch (e) {
            log(`❌ シミュレーションエラー: ${e.message}`);
        }
    }, {
        timezone: "Asia/Tokyo"
    });

    log('🚀 自動売買シミュレーターが起動しました');
    log('⏰ 毎日 9:00 (JST) にシミュレーションを実行します');
    log(`💰 初期費用: ¥${CONFIG.initialCapital.toLocaleString()}`);
    log(`📊 対象銘柄数: ${TRADING_SYMBOLS.length}`);
    log('');
}

/**
 * 初回実行（テスト用）
 */
async function runOnce() {
    log('🚀 手動実行');
    try {
        await runDailySimulation();
    } catch (e) {
        log(`❌ エラー: ${e.message}`);
        console.error(e);
    }
}

// エクスポート
export { runDailySimulation, startScheduler, runOnce, CONFIG };

// メイン実行（直接実行時）
const args = process.argv.slice(2);
if (args.includes('--run-once')) {
    // 即座に1回実行
    runOnce();
} else if (args.includes('--start')) {
    // スケジューラー開始
    startScheduler();

    // プロセスを維持
    log('Ctrl+C で終了');
} else {
    console.log(`
🤖 自動売買シミュレーター

使用方法:
  node auto-simulator.mjs --run-once   # 今すぐ1回実行
  node auto-simulator.mjs --start      # スケジューラーを開始（毎日9時実行）

設定:
  初期費用: ¥${CONFIG.initialCapital.toLocaleString()}
  最大保有銘柄: ${CONFIG.maxPositions}
  対象銘柄: ${TRADING_SYMBOLS.length}銘柄
    `);
}
