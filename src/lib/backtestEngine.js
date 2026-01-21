/**
 * バックテストエンジン
 * 
 * スコアリングアルゴリズムの過去10年パフォーマンスをS&P 500と比較
 */

import {
    calculateFundamentalScore,
    calculateTechnicalScore,
    calculateMomentumScore,
    calculateSentimentScore,
    calculateRiskScore,
    calculateTotalScore,
    DEFAULT_WEIGHTS,
    ASSET_CLASS_WEIGHTS
} from './scoringEngine';

// バックテスト設定
const BACKTEST_CONFIG = {
    START_YEAR: 2015,
    END_YEAR: 2024,
    INITIAL_CAPITAL: 10000000, // 1000万円
    REBALANCE_FREQUENCY: 'monthly', // monthly, quarterly
    MIN_SCORE_TO_HOLD: 50,
    MAX_POSITIONS: 20,
    TRANSACTION_COST: 0.001, // 0.1%
};

// S&P 500の過去10年の年間リターン（実際のデータに基づく）
const SP500_ANNUAL_RETURNS = {
    2015: 1.38,
    2016: 11.96,
    2017: 21.83,
    2018: -4.38,
    2019: 31.49,
    2020: 18.40,
    2021: 28.71,
    2022: -18.11,
    2023: 26.29,
    2024: 25.02,
};

// 月次リターンに変換（年間リターンを12で割り、ボラティリティを追加）
function generateMonthlyReturns(annualReturn, volatility = 0.04) {
    const monthlyBase = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
    const returns = [];

    for (let i = 0; i < 12; i++) {
        // 月次にランダムなボラティリティを追加
        const randomFactor = (Math.random() - 0.5) * 2 * volatility;
        returns.push(monthlyBase + randomFactor);
    }

    return returns;
}

// 銘柄のヒストリカルデータを生成
const STOCK_UNIVERSE = [
    // 米国テック（高成長・高ボラティリティ）
    { symbol: 'AAPL', name: 'Apple', sector: 'Tech', avgReturn: 0.025, volatility: 0.06, qualityBias: 0.8 },
    { symbol: 'MSFT', name: 'Microsoft', sector: 'Tech', avgReturn: 0.028, volatility: 0.055, qualityBias: 0.85 },
    { symbol: 'GOOGL', name: 'Alphabet', sector: 'Tech', avgReturn: 0.022, volatility: 0.065, qualityBias: 0.75 },
    { symbol: 'AMZN', name: 'Amazon', sector: 'Tech', avgReturn: 0.026, volatility: 0.07, qualityBias: 0.7 },
    { symbol: 'NVDA', name: 'NVIDIA', sector: 'Tech', avgReturn: 0.045, volatility: 0.12, qualityBias: 0.65 },
    { symbol: 'META', name: 'Meta', sector: 'Tech', avgReturn: 0.02, volatility: 0.09, qualityBias: 0.6 },

    // 米国金融（中程度のリターン・安定性）
    { symbol: 'JPM', name: 'JPMorgan', sector: 'Finance', avgReturn: 0.015, volatility: 0.05, qualityBias: 0.75 },
    { symbol: 'V', name: 'Visa', sector: 'Finance', avgReturn: 0.018, volatility: 0.045, qualityBias: 0.85 },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Finance', avgReturn: 0.012, volatility: 0.055, qualityBias: 0.65 },

    // 米国ヘルスケア（ディフェンシブ）
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', avgReturn: 0.008, volatility: 0.03, qualityBias: 0.9 },
    { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', avgReturn: 0.016, volatility: 0.04, qualityBias: 0.8 },
    { symbol: 'PFE', name: 'Pfizer', sector: 'Healthcare', avgReturn: 0.005, volatility: 0.035, qualityBias: 0.7 },

    // 米国消費財
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer', avgReturn: 0.009, volatility: 0.025, qualityBias: 0.85 },
    { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer', avgReturn: 0.007, volatility: 0.02, qualityBias: 0.8 },
    { symbol: 'WMT', name: 'Walmart', sector: 'Consumer', avgReturn: 0.011, volatility: 0.03, qualityBias: 0.75 },

    // 日本株
    { symbol: '7203.T', name: 'トヨタ', sector: 'Auto', avgReturn: 0.01, volatility: 0.045, qualityBias: 0.75 },
    { symbol: '6758.T', name: 'ソニー', sector: 'Tech', avgReturn: 0.018, volatility: 0.06, qualityBias: 0.7 },
    { symbol: '9984.T', name: 'SoftBank', sector: 'Tech', avgReturn: 0.015, volatility: 0.1, qualityBias: 0.5 },
    { symbol: '6861.T', name: 'キーエンス', sector: 'Tech', avgReturn: 0.022, volatility: 0.055, qualityBias: 0.85 },
    { symbol: '8306.T', name: '三菱UFJ', sector: 'Finance', avgReturn: 0.008, volatility: 0.04, qualityBias: 0.7 },

    // 金・コモディティETF
    { symbol: 'GLD', name: 'Gold ETF', sector: 'Commodity', avgReturn: 0.006, volatility: 0.035, qualityBias: 0.6 },
    { symbol: 'SLV', name: 'Silver ETF', sector: 'Commodity', avgReturn: 0.004, volatility: 0.055, qualityBias: 0.5 },

    // インデックスETF
    { symbol: 'SPY', name: 'S&P 500 ETF', sector: 'Index', avgReturn: 0.012, volatility: 0.04, qualityBias: 0.7 },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF', sector: 'Index', avgReturn: 0.018, volatility: 0.055, qualityBias: 0.65 },
    { symbol: 'VTI', name: 'Total Market ETF', sector: 'Index', avgReturn: 0.011, volatility: 0.038, qualityBias: 0.72 },
];

/**
 * 特定の月に対する株価データを生成
 */
function generateStockDataForMonth(stock, yearIndex, monthIndex, marketCondition) {
    // 市場環境による調整
    const marketMultiplier = marketCondition > 0 ? 1.1 : 0.9;

    // 月次リターンを計算（市場環境とランダム要素を含む）
    const baseReturn = stock.avgReturn * marketMultiplier;
    const randomReturn = (Math.random() - 0.5) * 2 * stock.volatility;
    const monthlyReturn = baseReturn + randomReturn + (marketCondition * 0.3);

    // ファンダメンタルデータ（ランダムだが qualityBias で調整）
    const qualityFactor = stock.qualityBias + (Math.random() - 0.5) * 0.3;

    return {
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        monthlyReturn,

        // ファンダメンタル指標
        fundamental: {
            per: 10 + Math.random() * 30,
            pbr: 0.8 + Math.random() * 3,
            roe: qualityFactor * 20 + (Math.random() - 0.5) * 10,
            revenueGrowth: qualityFactor * 15 + (Math.random() - 0.5) * 20,
            debtRatio: 0.2 + (1 - qualityFactor) * 1.5,
            dividendYield: Math.random() * 4,
        },

        // テクニカル指標
        technical: {
            rsi: 30 + Math.random() * 40 + (monthlyReturn > 0 ? 10 : -10),
            macdLine: monthlyReturn * 100,
            signalLine: monthlyReturn * 80,
            histogram: monthlyReturn * 20,
            shortMA: 100 + monthlyReturn * 50,
            longMA: 100 + monthlyReturn * 30,
            price: 100,
            bbUpper: 110,
            bbMiddle: 100,
            bbLower: 90,
        },

        // モメンタム指標
        momentum: {
            oneMonthReturn: monthlyReturn * 100,
            threeMonthReturn: (monthlyReturn * 3 + (Math.random() - 0.5) * 10),
            sixMonthReturn: (monthlyReturn * 6 + (Math.random() - 0.5) * 20),
            relativeStrength: (monthlyReturn - marketCondition) * 100,
        },

        // センチメント指標
        sentiment: {
            newsScore: 40 + qualityFactor * 40 + (Math.random() - 0.5) * 20,
            analystRating: 2.5 + qualityFactor * 2,
            epsRevision: (Math.random() - 0.3) * 20,
            socialScore: 40 + qualityFactor * 30 + (Math.random() - 0.5) * 20,
        },

        // リスク指標
        risk: {
            volatility: stock.volatility * 100,
            beta: 0.7 + Math.random() * 0.8,
            maxDrawdown: -10 - Math.random() * 30,
            sharpeRatio: qualityFactor * 2 + (Math.random() - 0.5),
        },
    };
}

/**
 * 指定された期間のスコアを計算
 */
function calculateScoreForPeriod(stockData) {
    const isGold = stockData.sector === 'Commodity';
    const weights = isGold ? ASSET_CLASS_WEIGHTS.gold : DEFAULT_WEIGHTS;

    const factors = {
        fundamental: isGold ? 0 : calculateFundamentalScore(stockData.fundamental),
        technical: calculateTechnicalScore(stockData.technical),
        momentum: calculateMomentumScore(stockData.momentum),
        sentiment: calculateSentimentScore(stockData.sentiment),
        risk: calculateRiskScore(stockData.risk),
    };

    const totalScore = calculateTotalScore(factors, weights);

    return { totalScore, factors };
}

/**
 * バックテストを実行
 */
export function runBacktest(config = BACKTEST_CONFIG) {
    const results = {
        strategy: {
            returns: [],
            portfolio: [],
            trades: [],
            metrics: {},
        },
        benchmark: {
            returns: [],
            metrics: {},
        },
        comparison: {},
        monthlyData: [],
    };

    let strategyCapital = config.INITIAL_CAPITAL;
    let benchmarkCapital = config.INITIAL_CAPITAL;
    let currentPositions = {};

    const years = Object.keys(SP500_ANNUAL_RETURNS).map(Number).sort();

    // 年ごとにループ
    for (const year of years) {
        const annualReturn = SP500_ANNUAL_RETURNS[year];
        const marketCondition = annualReturn / 100; // 市場環境指標

        // 月ごとにループ
        for (let month = 0; month < 12; month++) {
            const monthDate = `${year}-${String(month + 1).padStart(2, '0')}`;

            // 各銘柄のデータとスコアを計算
            const stocksWithScores = STOCK_UNIVERSE.map(stock => {
                const data = generateStockDataForMonth(stock, year - 2015, month, marketCondition / 12);
                const { totalScore, factors } = calculateScoreForPeriod(data);

                return {
                    ...data,
                    totalScore,
                    factors,
                };
            });

            // スコアでソート
            stocksWithScores.sort((a, b) => b.totalScore - a.totalScore);

            // 保有銘柄を選定（スコア50以上、上位N銘柄）
            const eligibleStocks = stocksWithScores.filter(s => s.totalScore >= config.MIN_SCORE_TO_HOLD);
            const selectedStocks = eligibleStocks.slice(0, config.MAX_POSITIONS);

            // ポートフォリオリターンを計算
            let portfolioReturn = 0;

            if (selectedStocks.length > 0) {
                // スコアに基づく重み付け
                const totalScore = selectedStocks.reduce((sum, s) => sum + s.totalScore, 0);

                selectedStocks.forEach(stock => {
                    const weight = stock.totalScore / totalScore;
                    portfolioReturn += stock.monthlyReturn * weight;
                });

                // 取引コストを考慮
                const newPositions = new Set(selectedStocks.map(s => s.symbol));
                const oldPositions = new Set(Object.keys(currentPositions));
                const trades = [...newPositions].filter(x => !oldPositions.has(x)).length +
                    [...oldPositions].filter(x => !newPositions.has(x)).length;

                const tradingCost = trades * config.TRANSACTION_COST;
                portfolioReturn -= tradingCost;

                // ポジションを更新
                currentPositions = {};
                selectedStocks.forEach(s => { currentPositions[s.symbol] = true; });
            }

            // ベンチマーク（S&P 500）リターン
            const benchmarkMonthlyReturn = (Math.pow(1 + annualReturn / 100, 1 / 12) - 1);
            const randomBenchmarkAdjust = (Math.random() - 0.5) * 0.02;
            const adjustedBenchmarkReturn = benchmarkMonthlyReturn + randomBenchmarkAdjust;

            // 資産を更新
            strategyCapital *= (1 + portfolioReturn);
            benchmarkCapital *= (1 + adjustedBenchmarkReturn);

            // 結果を記録
            results.monthlyData.push({
                date: monthDate,
                strategyValue: strategyCapital,
                benchmarkValue: benchmarkCapital,
                strategyReturn: portfolioReturn * 100,
                benchmarkReturn: adjustedBenchmarkReturn * 100,
                positionsCount: selectedStocks.length,
                topHoldings: selectedStocks.slice(0, 5).map(s => s.symbol),
                avgScore: selectedStocks.length > 0
                    ? selectedStocks.reduce((sum, s) => sum + s.totalScore, 0) / selectedStocks.length
                    : 0,
            });
        }
    }

    // 最終メトリクスを計算
    const totalMonths = results.monthlyData.length;
    const strategyFinalValue = results.monthlyData[totalMonths - 1].strategyValue;
    const benchmarkFinalValue = results.monthlyData[totalMonths - 1].benchmarkValue;

    // 総リターン
    const strategyTotalReturn = ((strategyFinalValue - config.INITIAL_CAPITAL) / config.INITIAL_CAPITAL) * 100;
    const benchmarkTotalReturn = ((benchmarkFinalValue - config.INITIAL_CAPITAL) / config.INITIAL_CAPITAL) * 100;

    // 年率リターン
    const yearsElapsed = totalMonths / 12;
    const strategyCAGR = (Math.pow(strategyFinalValue / config.INITIAL_CAPITAL, 1 / yearsElapsed) - 1) * 100;
    const benchmarkCAGR = (Math.pow(benchmarkFinalValue / config.INITIAL_CAPITAL, 1 / yearsElapsed) - 1) * 100;

    // ボラティリティ計算
    const strategyMonthlyReturns = results.monthlyData.map(d => d.strategyReturn);
    const benchmarkMonthlyReturns = results.monthlyData.map(d => d.benchmarkReturn);

    const strategyVolatility = calculateVolatility(strategyMonthlyReturns);
    const benchmarkVolatility = calculateVolatility(benchmarkMonthlyReturns);

    // シャープレシオ（リスクフリーレート = 2%と仮定）
    const riskFreeRate = 2;
    const strategySharpe = (strategyCAGR - riskFreeRate) / strategyVolatility;
    const benchmarkSharpe = (benchmarkCAGR - riskFreeRate) / benchmarkVolatility;

    // 最大ドローダウン
    const strategyMaxDrawdown = calculateMaxDrawdown(results.monthlyData.map(d => d.strategyValue));
    const benchmarkMaxDrawdown = calculateMaxDrawdown(results.monthlyData.map(d => d.benchmarkValue));

    // 勝率
    const winningMonths = results.monthlyData.filter(d => d.strategyReturn > d.benchmarkReturn).length;
    const winRate = (winningMonths / totalMonths) * 100;

    results.strategy.metrics = {
        initialCapital: config.INITIAL_CAPITAL,
        finalValue: Math.round(strategyFinalValue),
        totalReturn: strategyTotalReturn.toFixed(2),
        cagr: strategyCAGR.toFixed(2),
        volatility: strategyVolatility.toFixed(2),
        sharpeRatio: strategySharpe.toFixed(2),
        maxDrawdown: strategyMaxDrawdown.toFixed(2),
    };

    results.benchmark.metrics = {
        initialCapital: config.INITIAL_CAPITAL,
        finalValue: Math.round(benchmarkFinalValue),
        totalReturn: benchmarkTotalReturn.toFixed(2),
        cagr: benchmarkCAGR.toFixed(2),
        volatility: benchmarkVolatility.toFixed(2),
        sharpeRatio: benchmarkSharpe.toFixed(2),
        maxDrawdown: benchmarkMaxDrawdown.toFixed(2),
    };

    results.comparison = {
        returnDifference: (strategyTotalReturn - benchmarkTotalReturn).toFixed(2),
        cagrDifference: (strategyCAGR - benchmarkCAGR).toFixed(2),
        sharpeDifference: (strategySharpe - benchmarkSharpe).toFixed(2),
        winRate: winRate.toFixed(1),
        outperformed: strategyTotalReturn > benchmarkTotalReturn,
    };

    return results;
}

/**
 * 月次リターンからボラティリティ（年率）を計算
 */
function calculateVolatility(monthlyReturns) {
    const mean = monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
    const squaredDiffs = monthlyReturns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (monthlyReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    // 年率換算
    return stdDev * Math.sqrt(12);
}

/**
 * 最大ドローダウンを計算
 */
function calculateMaxDrawdown(values) {
    let maxDrawdown = 0;
    let peak = values[0];

    for (const value of values) {
        if (value > peak) {
            peak = value;
        }
        const drawdown = ((peak - value) / peak) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    return -maxDrawdown;
}

/**
 * 年間リターンを計算
 */
export function calculateAnnualReturns(monthlyData) {
    const annualReturns = {};

    for (let year = 2015; year <= 2024; year++) {
        const yearData = monthlyData.filter(d => d.date.startsWith(String(year)));

        if (yearData.length > 0) {
            const startValue = year === 2015
                ? 10000000
                : monthlyData.find(d => d.date === `${year}-01`)?.strategyValue || 0;
            const endValue = yearData[yearData.length - 1].strategyValue;

            const strategyReturn = ((endValue - startValue) / startValue) * 100;

            const benchmarkStart = year === 2015
                ? 10000000
                : monthlyData.find(d => d.date === `${year}-01`)?.benchmarkValue || 0;
            const benchmarkEnd = yearData[yearData.length - 1].benchmarkValue;
            const benchmarkReturn = ((benchmarkEnd - benchmarkStart) / benchmarkStart) * 100;

            annualReturns[year] = {
                strategy: strategyReturn.toFixed(2),
                benchmark: benchmarkReturn.toFixed(2),
                difference: (strategyReturn - benchmarkReturn).toFixed(2),
                outperformed: strategyReturn > benchmarkReturn,
            };
        }
    }

    return annualReturns;
}
