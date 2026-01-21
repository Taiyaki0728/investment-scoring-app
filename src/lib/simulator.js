/**
 * 自動売買シミュレーター（クライアントサイド版）
 * LocalStorageを使用してサーバーなしで動作
 */

// S&P 500 全銘柄データをインポート
import { STOCK_DATA, getStockCount } from './sp500Data';

// 設定
export const SIMULATOR_CONFIG = {
    initialCapital: 1000000,  // 初期費用: 100万円
    maxPositions: 10,
    minScoreToHold: 55,
    rebalanceDay: 1,
};

// 銘柄数をエクスポート
export { getStockCount };

const STORAGE_KEYS = {
    positions: 'simulator_positions',
    history: 'simulator_history',
    settings: 'simulator_settings',
};

/**
 * シミュレーション価格を生成（ランダムウォーク + トレンド）
 */
function generateSimulatedPrice(basePrice, daysSinceStart, symbol) {
    // シンボルベースのシード（一貫性のため）
    const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

    // 日ごとの変動（±3%程度）
    const dailyChange = 1 + (Math.sin(daysSinceStart * 0.1 + seed) * 0.02 +
        (Math.random() - 0.5) * 0.03);

    // 長期トレンド（±20%程度/年）
    const trend = 1 + (daysSinceStart / 365) * ((seed % 40 - 20) / 100);

    return basePrice * dailyChange * trend;
}

/**
 * 銘柄のスコアを計算
 */
function calculateStockScore(symbol, currentDate) {
    const stock = STOCK_DATA[symbol];
    if (!stock) return 50;

    const startDate = new Date('2024-01-01');
    const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));

    // 過去のパフォーマンスデータを生成
    const prices = [];
    for (let i = 30; i >= 0; i--) {
        prices.push(generateSimulatedPrice(stock.basePrice, daysSinceStart - i, symbol));
    }

    // モメンタムスコア（過去30日の変化率）
    const momentum = (prices[prices.length - 1] - prices[0]) / prices[0];
    const momentumScore = Math.max(0, Math.min(100, (momentum + 0.15) / 0.3 * 100));

    // RSI（簡易版）
    let gains = 0, losses = 0;
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    let rsiScore = 50;
    if (rsi < 30) rsiScore = 75;
    else if (rsi < 50) rsiScore = 60;
    else if (rsi < 70) rsiScore = 50;
    else rsiScore = 35;

    // セクタースコア（セクターごとの追加ボーナス）
    const sectorBonus = {
        'Technology': 5,
        'Healthcare': 3,
        'Financial': 2,
        'Consumer': 0,
        'Energy': -2,
        'Industrial': 1,
        'Utilities': -3,
        'Materials': 0,
    };

    // 総合スコア
    const baseScore = momentumScore * 0.45 + rsiScore * 0.35 + 50 * 0.20;
    return Math.round(Math.max(0, Math.min(100, baseScore + (sectorBonus[stock.sector] || 0))));
}

/**
 * 現在の市場価格を取得（シミュレーション）
 */
export function getCurrentPrices() {
    const now = new Date();
    const startDate = new Date('2024-01-01');
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    const prices = {};
    Object.entries(STOCK_DATA).forEach(([symbol, data]) => {
        const price = generateSimulatedPrice(data.basePrice, daysSinceStart, symbol);
        const prevPrice = generateSimulatedPrice(data.basePrice, daysSinceStart - 1, symbol);
        const change = ((price - prevPrice) / prevPrice) * 100;

        prices[symbol] = {
            symbol,
            name: data.name,
            sector: data.sector,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            score: calculateStockScore(symbol, now),
        };
    });

    return prices;
}

/**
 * ポジションをLocalStorageから読み込む
 */
export function loadPositions() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.positions);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load positions:', e);
    }

    // 初期状態
    return {
        cash: SIMULATOR_CONFIG.initialCapital,
        holdings: [],
        startDate: new Date().toISOString(),
        lastUpdate: null,
        totalValue: SIMULATOR_CONFIG.initialCapital,
        totalReturn: 0,
        dailyReturns: [],
    };
}

/**
 * ポジションをLocalStorageに保存
 */
export function savePositions(positions) {
    try {
        localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(positions));
    } catch (e) {
        console.error('Failed to save positions:', e);
    }
}

/**
 * シミュレーション履歴を読み込む
 */
export function loadHistory() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.history);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load history:', e);
    }
    return [];
}

/**
 * 履歴を保存
 */
export function saveHistory(history) {
    try {
        // 最新365日分だけ保持
        const trimmed = history.slice(-365);
        localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(trimmed));
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

/**
 * シミュレーションをリセット
 */
export function resetSimulation() {
    localStorage.removeItem(STORAGE_KEYS.positions);
    localStorage.removeItem(STORAGE_KEYS.history);
    return loadPositions();
}

/**
 * 毎日のシミュレーションを実行
 */
export function runDailySimulation(forceRebalance = false) {
    const positions = loadPositions();
    const history = loadHistory();
    const today = new Date();
    const prices = getCurrentPrices();

    // 最後の更新が今日かどうかチェック
    const lastUpdate = positions.lastUpdate ? new Date(positions.lastUpdate) : null;
    const isToday = lastUpdate &&
        lastUpdate.toDateString() === today.toDateString();

    // 今日既に実行済みの場合はスキップ（強制リバランス時を除く）
    if (isToday && !forceRebalance) {
        return { positions, trades: [], skipped: true };
    }

    // 初回（保有銘柄がない場合）または月初はリバランス
    const isFirstRun = positions.holdings.length === 0;
    const isRebalanceDay = isFirstRun || forceRebalance || today.getDate() === SIMULATOR_CONFIG.rebalanceDay;

    // ポートフォリオ評価額を更新
    let portfolioValue = positions.cash;
    const updatedHoldings = positions.holdings.map(holding => {
        const priceInfo = prices[holding.symbol];
        if (priceInfo) {
            const currentValue = holding.shares * priceInfo.price;
            const gain = currentValue - (holding.shares * holding.avgCost);
            const gainPct = (priceInfo.price / holding.avgCost - 1) * 100;

            portfolioValue += currentValue;

            return {
                ...holding,
                currentPrice: priceInfo.price,
                currentValue,
                gain,
                gainPct,
                name: priceInfo.name,
                sector: priceInfo.sector,
            };
        }
        portfolioValue += holding.currentValue || (holding.shares * holding.avgCost);
        return holding;
    });

    const previousValue = positions.totalValue || SIMULATOR_CONFIG.initialCapital;
    const dailyReturn = previousValue > 0 ? (portfolioValue / previousValue - 1) * 100 : 0;
    const totalReturn = (portfolioValue / SIMULATOR_CONFIG.initialCapital - 1) * 100;

    let trades = [];
    let newHoldings = [...updatedHoldings];
    let availableCash = positions.cash;

    // リバランス実行
    if (isRebalanceDay) {
        // スコアでソートした銘柄
        const scoredStocks = Object.values(prices)
            .filter(s => s.score >= SIMULATOR_CONFIG.minScoreToHold)
            .sort((a, b) => b.score - a.score)
            .slice(0, SIMULATOR_CONFIG.maxPositions);

        const targetSymbols = scoredStocks.map(s => s.symbol);

        // 売却対象
        const sellTargets = updatedHoldings.filter(h => !targetSymbols.includes(h.symbol));

        // 売却
        for (const holding of sellTargets) {
            const priceInfo = prices[holding.symbol];
            const sellPrice = priceInfo?.price || holding.currentPrice;
            const sellValue = holding.shares * sellPrice;
            availableCash += sellValue;

            trades.push({
                type: 'SELL',
                symbol: holding.symbol,
                name: priceInfo?.name || holding.symbol,
                shares: holding.shares,
                price: sellPrice,
                value: sellValue,
                reason: 'スコア基準未達',
                timestamp: today.toISOString(),
            });
        }

        // 売却した銘柄を除外
        newHoldings = updatedHoldings.filter(h => targetSymbols.includes(h.symbol));

        // 新規購入
        const existingSymbols = newHoldings.map(h => h.symbol);
        const newBuys = scoredStocks.filter(s => !existingSymbols.includes(s.symbol));

        if (newBuys.length > 0 && availableCash > 0) {
            const cashPerStock = availableCash / newBuys.length;

            for (const stock of newBuys) {
                const shares = Math.floor(cashPerStock / stock.price);
                if (shares > 0) {
                    const buyValue = shares * stock.price;
                    availableCash -= buyValue;

                    newHoldings.push({
                        symbol: stock.symbol,
                        name: stock.name,
                        sector: stock.sector,
                        shares,
                        avgCost: stock.price,
                        currentPrice: stock.price,
                        currentValue: buyValue,
                        gain: 0,
                        gainPct: 0,
                        buyDate: today.toISOString(),
                    });

                    trades.push({
                        type: 'BUY',
                        symbol: stock.symbol,
                        name: stock.name,
                        shares,
                        price: stock.price,
                        value: buyValue,
                        score: stock.score,
                        reason: '高スコア銘柄',
                        timestamp: today.toISOString(),
                    });
                }
            }
        }
    }

    // 評価額を再計算
    portfolioValue = availableCash + newHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);

    // ポジションを更新
    const updatedPositions = {
        ...positions,
        cash: availableCash,
        holdings: newHoldings,
        lastUpdate: today.toISOString(),
        totalValue: portfolioValue,
        totalReturn,
        dailyReturns: [
            ...positions.dailyReturns.slice(-29),
            { date: today.toISOString().split('T')[0], return: dailyReturn, value: portfolioValue },
        ],
    };

    savePositions(updatedPositions);

    // 履歴に追加
    const newRecord = {
        date: today.toISOString(),
        portfolioValue: Math.round(portfolioValue),
        cash: Math.round(availableCash),
        holdingsCount: newHoldings.length,
        dailyReturn,
        totalReturn,
        trades,
    };

    const updatedHistory = [...history, newRecord];
    saveHistory(updatedHistory);

    return {
        positions: updatedPositions,
        trades,
        skipped: false,
        isRebalance: isRebalanceDay,
    };
}

/**
 * 銘柄データを取得
 */
export function getStockData() {
    return STOCK_DATA;
}

/**
 * 統計を計算
 */
export function calculateStats(positions, history) {
    if (!positions || !history.length) {
        return {
            totalReturn: 0,
            dailyReturn: 0,
            winRate: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            totalTrades: 0,
        };
    }

    const returns = positions.dailyReturns.map(d => d.return);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length || 1);
    const stdDev = Math.sqrt(variance);

    // 最大ドローダウン
    let maxDrawdown = 0;
    let peak = SIMULATOR_CONFIG.initialCapital;
    for (const record of history) {
        if (record.portfolioValue > peak) peak = record.portfolioValue;
        const drawdown = (peak - record.portfolioValue) / peak * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // 勝率
    const winDays = returns.filter(r => r > 0).length;
    const winRate = returns.length > 0 ? (winDays / returns.length) * 100 : 0;

    // 総取引回数
    const totalTrades = history.reduce((sum, h) => sum + (h.trades?.length || 0), 0);

    return {
        totalReturn: positions.totalReturn || 0,
        dailyReturn: returns.length > 0 ? returns[returns.length - 1] : 0,
        winRate,
        maxDrawdown,
        sharpeRatio: stdDev > 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0,
        totalTrades,
    };
}
