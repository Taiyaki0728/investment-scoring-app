/**
 * Yahoo Finance API バックエンドサーバー
 * 
 * S&P 500構成銘柄の過去データを取得し、スコアリングバックテストを実行
 * 自動売買シミュレーター統合版
 */

import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startScheduler, runOnce, CONFIG as SimulatorConfig } from './auto-simulator.mjs';

// ESM用のdirname取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// yahoo-finance2 v3用にインスタンス化
const yahooFinance = new YahooFinance();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// S&P 500 主要構成銘柄（約500銘柄）
const SP500_SYMBOLS = [
    'A', 'AAL', 'AAP', 'AAPL', 'ABBV', 'ABT', 'ACN', 'ADBE',
    'ADI', 'ADM', 'ADP', 'ADSK', 'AEE', 'AEP', 'AES', 'AFL', 'AIG',
    'AIZ', 'AJG', 'AKAM', 'ALB', 'ALGN', 'ALK', 'ALL', 'ALLE', 'AMAT',
    'AMCR', 'AMD', 'AME', 'AMGN', 'AMP', 'AMT', 'AMZN', 'ANET', 'ANSS',
    'AON', 'AOS', 'APA', 'APD', 'APH', 'APTV', 'ARE', 'ATO', 'AVB',
    'AVGO', 'AVY', 'AWK', 'AXP', 'AZO', 'BA', 'BAC', 'BAX', 'BBY', 'BDX',
    'BEN', 'BIIB', 'BIO', 'BK', 'BKNG', 'BKR', 'BLK', 'BMY',
    'BR', 'BRO', 'BSX', 'BWA', 'BXP', 'C', 'CAG', 'CAH', 'CARR', 'CAT',
    'CB', 'CBOE', 'CBRE', 'CCI', 'CCL', 'CDNS', 'CDW', 'CE', 'CF',
    'CFG', 'CHD', 'CHRW', 'CHTR', 'CI', 'CINF', 'CL', 'CLX', 'CMA', 'CMCSA',
    'CME', 'CMG', 'CMI', 'CMS', 'CNC', 'CNP', 'COF', 'COG', 'COO', 'COP',
    'COST', 'CPB', 'CPRT', 'CRM', 'CSCO', 'CSX', 'CTAS', 'CTRA', 'CTSH',
    'CTVA', 'CVS', 'CVX', 'CZR', 'D', 'DAL', 'DD', 'DE', 'DFS',
    'DG', 'DGX', 'DHI', 'DHR', 'DIS', 'DLR', 'DLTR',
    'DOV', 'DOW', 'DPZ', 'DRE', 'DRI', 'DTE', 'DUK', 'DVA', 'DVN', 'DXC',
    'DXCM', 'EA', 'EBAY', 'ECL', 'ED', 'EFX', 'EIX', 'EL', 'EMN', 'EMR',
    'EOG', 'EPAM', 'EQIX', 'EQR', 'ES', 'ESS', 'ETN', 'ETR', 'EVRG', 'EW',
    'EXC', 'EXPD', 'EXPE', 'EXR', 'F', 'FANG', 'FAST', 'FCX', 'FDX',
    'FE', 'FFIV', 'FIS', 'FITB', 'FLT', 'FMC', 'FOX',
    'FOXA', 'FRT', 'FTNT', 'FTV', 'GD', 'GE', 'GEHC', 'GILD', 'GIS',
    'GL', 'GLW', 'GM', 'GNRC', 'GOOG', 'GOOGL', 'GPC', 'GPN', 'GPS', 'GRMN', 'GS',
    'GWW', 'HAL', 'HAS', 'HBAN', 'HCA', 'HD', 'HES', 'HIG',
    'HII', 'HLT', 'HOLX', 'HON', 'HPE', 'HPQ', 'HRL', 'HSIC', 'HST',
    'HSY', 'HUM', 'HWM', 'IBM', 'ICE', 'IDXX', 'IEX', 'IFF', 'ILMN', 'INCY',
    'INTC', 'INTU', 'IP', 'IPG', 'IQV', 'IR', 'IRM', 'ISRG',
    'IT', 'ITW', 'IVZ', 'J', 'JBHT', 'JCI', 'JKHY', 'JNJ', 'JNPR', 'JPM',
    'K', 'KEY', 'KEYS', 'KDP', 'KHC', 'KIM', 'KLAC', 'KMB', 'KMI', 'KMX', 'KO',
    'KR', 'KSS', 'L', 'LDOS', 'LEN', 'LH', 'LHX',
    'LIN', 'LKQ', 'LLY', 'LMT', 'LNC', 'LNT', 'LOW', 'LRCX', 'LUV', 'LVS',
    'LW', 'LYB', 'LYV', 'MA', 'MAA', 'MAR', 'MAS', 'MCD', 'MCHP', 'MCK',
    'MCO', 'MDT', 'MET', 'MGM', 'MHK', 'MKC', 'MKTX', 'MLM', 'MMC', 'MMM',
    'MNST', 'MO', 'MOS', 'MPC', 'MRK', 'MRO', 'MS', 'MSCI', 'MSFT', 'MSI',
    'MTB', 'MTD', 'MU', 'NDSN', 'NDAQ', 'NEE', 'NEM',
    'NFLX', 'NI', 'NKE', 'NOC', 'NOW', 'NRG', 'NSC',
    'NTAP', 'NTRS', 'NUE', 'NVDA', 'NVR', 'NWL', 'NWS', 'NWSA', 'O', 'ODFL',
    'OKE', 'OMC', 'ORCL', 'ORLY', 'OTIS', 'OXY', 'PAYC', 'PAYX', 'PCAR',
    'PEAK', 'PEG', 'PEP', 'PFE', 'PFG', 'PG', 'PGR', 'PH', 'PHM', 'PKG',
    'PLD', 'PM', 'PNC', 'PNR', 'PNW', 'POOL', 'PPG', 'PPL', 'PRU',
    'PSA', 'PSX', 'PTC', 'PWR', 'PXD', 'PYPL', 'QCOM', 'QRVO', 'RCL',
    'REG', 'REGN', 'RF', 'RHI', 'RJF', 'RL', 'RMD', 'ROK', 'ROL', 'ROP',
    'ROST', 'RSG', 'RTX', 'SBAC', 'SBUX', 'SCHW', 'SEE', 'SHW', 'SJM',
    'SLB', 'SNA', 'SNPS', 'SO', 'SPG', 'SPGI', 'SPY', 'SRE', 'STE',
    'STT', 'STX', 'STZ', 'SWK', 'SWKS', 'SYF', 'SYK', 'SYY', 'T', 'TAP',
    'TDG', 'TDY', 'TEL', 'TER', 'TFC', 'TFX', 'TGT', 'TJX', 'TMO', 'TMUS',
    'TPR', 'TRGP', 'TROW', 'TRV', 'TSCO', 'TSLA', 'TSN', 'TT', 'TTWO', 'TXN',
    'TXT', 'TYL', 'UAL', 'UDR', 'UHS', 'ULTA', 'UNH', 'UNP', 'UPS', 'URI', 'USB', 'V', 'VFC', 'VICI', 'VLO', 'VMC',
    'VRSK', 'VRSN', 'VRTX', 'VTR', 'VZ', 'WAB', 'WAT', 'WBA', 'WBD', 'WDC', 'WEC',
    'WELL', 'WFC', 'WHR', 'WM', 'WMB', 'WMT', 'WRB', 'WRK', 'WST',
    'WTW', 'WY', 'WYNN', 'XEL', 'XOM', 'XRAY', 'XYL', 'YUM',
    'ZBH', 'ZBRA', 'ZION', 'ZTS'
];

// レート制限用
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 500ms間隔

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
 * 銘柄の過去データを取得
 */
app.get('/api/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { period1, period2 } = req.query;

        const result = await rateLimitedRequest(() =>
            yahooFinance.chart(symbol, {
                period1: period1 || '2015-01-01',
                period2: period2 || '2024-12-31',
                interval: '1mo',
            })
        );

        res.json({
            symbol,
            data: result.quotes.map(q => ({
                date: q.date,
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume,
            })),
        });
    } catch (error) {
        console.error(`Error fetching ${req.params.symbol}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 複数銘柄の過去データを取得（バッチ）
 */
app.post('/api/historical/batch', async (req, res) => {
    try {
        const { symbols, period1, period2 } = req.body;
        const targetSymbols = symbols || SP500_SYMBOLS.slice(0, 50); // デフォルト50銘柄

        const results = {};
        const errors = [];

        for (const symbol of targetSymbols) {
            try {
                const result = await rateLimitedRequest(() =>
                    yahooFinance.chart(symbol, {
                        period1: period1 || '2015-01-01',
                        period2: period2 || '2024-12-31',
                        interval: '1mo',
                    })
                );

                results[symbol] = result.quotes.map(q => ({
                    date: q.date,
                    close: q.close,
                    volume: q.volume,
                }));

                console.log(`Fetched ${symbol}: ${results[symbol].length} data points`);
            } catch (error) {
                console.error(`Error fetching ${symbol}:`, error.message);
                errors.push({ symbol, error: error.message });
            }
        }

        res.json({
            data: results,
            errors,
            totalSymbols: Object.keys(results).length,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * バックテストを実行
 */
app.post('/api/backtest', async (req, res) => {
    try {
        let {
            symbols = SP500_SYMBOLS.slice(0, 100),  // 100銘柄に戻す（500は不安定）
            period1 = '2015-01-01',
            period2 = '2024-12-31',
            trainEndDate = '2019-12-31',
            minScoreToHold = 50,
            maxPositions = 20,
            initialCapital = 10000000,
        } = req.body;

        // SPYをベンチマークとして必ず含める
        if (!symbols.includes('SPY')) {
            symbols = ['SPY', ...symbols];
            console.log('Added SPY to symbols list for benchmark calculation');
        }

        console.log(`Starting backtest with ${symbols.length} symbols...`);

        // 1. 全銘柄のヒストリカルデータを取得
        const historicalData = {};

        for (const symbol of symbols) {
            try {
                const result = await rateLimitedRequest(() =>
                    yahooFinance.chart(symbol, {
                        period1,
                        period2,
                        interval: '1mo',
                    })
                );

                if (result.quotes && result.quotes.length > 0) {
                    historicalData[symbol] = result.quotes.map(q => ({
                        date: new Date(q.date).toISOString().slice(0, 7), // YYYY-MM
                        close: q.close,
                        volume: q.volume,
                    }));
                    console.log(`Fetched ${symbol}`);
                }
            } catch (error) {
                console.error(`Skipping ${symbol}: ${error.message}`);
            }
        }

        // 2. バックテスト実行
        const backtestResults = runBacktestWithData(historicalData, {
            trainEndDate,
            minScoreToHold,
            maxPositions,
            initialCapital,
        });

        res.json(backtestResults);
    } catch (error) {
        console.error('Backtest error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * スコア計算（テクニカル + モメンタム + リスク）
 */
function calculateScore(priceHistory, currentIndex) {
    if (currentIndex < 12) return 50; // データ不足

    const prices = priceHistory.slice(0, currentIndex + 1).map(p => p.close);

    // モメンタムスコア（過去12ヶ月のリターン）
    const momentum12m = (prices[prices.length - 1] - prices[prices.length - 13]) / prices[prices.length - 13];
    const momentum6m = prices.length >= 7
        ? (prices[prices.length - 1] - prices[prices.length - 7]) / prices[prices.length - 7]
        : 0;
    const momentum3m = prices.length >= 4
        ? (prices[prices.length - 1] - prices[prices.length - 4]) / prices[prices.length - 4]
        : 0;

    // モメンタムスコア正規化（-50%〜+100%を0〜100に）
    const momentumScore = Math.max(0, Math.min(100, (momentum12m + 0.5) / 1.5 * 100));

    // RSI計算（簡易版）
    const recentPrices = prices.slice(-14);
    let gains = 0, losses = 0;
    for (let i = 1; i < recentPrices.length; i++) {
        const change = recentPrices[i] - recentPrices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    // RSIスコア（30-70が最適）
    let rsiScore = 50;
    if (rsi < 30) rsiScore = 80; // 売られすぎ = 買いチャンス
    else if (rsi < 50) rsiScore = 60;
    else if (rsi < 70) rsiScore = 50;
    else rsiScore = 30; // 買われすぎ

    // ボラティリティ計算
    const returns = [];
    for (let i = 1; i < Math.min(prices.length, 13); i++) {
        returns.push((prices[prices.length - i] - prices[prices.length - i - 1]) / prices[prices.length - i - 1]);
    }
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(12); // 年率

    // リスクスコア（低ボラティリティが高スコア）
    const riskScore = Math.max(0, Math.min(100, 100 - volatility * 200));

    // トレンドスコア（3ヶ月 > 6ヶ月 > 12ヶ月ならトレンド強い）
    let trendScore = 50;
    if (momentum3m > momentum6m && momentum6m > 0) trendScore = 80;
    else if (momentum3m > 0) trendScore = 60;
    else if (momentum3m < momentum6m && momentum6m < 0) trendScore = 20;

    // 総合スコア
    const totalScore =
        momentumScore * 0.35 +
        rsiScore * 0.20 +
        trendScore * 0.25 +
        riskScore * 0.20;

    return Math.round(totalScore);
}

/**
 * バックテスト実行
 */
function runBacktestWithData(historicalData, config) {
    const { trainEndDate, minScoreToHold, maxPositions, initialCapital } = config;

    // 全銘柄の日付を取得
    const allDates = new Set();
    Object.values(historicalData).forEach(data => {
        data.forEach(d => allDates.add(d.date));
    });
    const sortedDates = Array.from(allDates).sort();

    // テスト開始日を決定
    const testStartIndex = sortedDates.findIndex(d => d > trainEndDate.slice(0, 7));
    if (testStartIndex === -1) {
        return { error: 'No test data available' };
    }

    const testDates = sortedDates.slice(testStartIndex);

    // SPYの価格データ（ベンチマーク）
    const spyData = historicalData['SPY'] || [];
    console.log(`SPY data points: ${spyData.length}`);
    if (spyData.length > 0) {
        console.log(`SPY date range: ${spyData[0]?.date} to ${spyData[spyData.length - 1]?.date}`);
        console.log(`First test date: ${testDates[0]}, SPY dates sample:`, spyData.slice(0, 3).map(d => d.date));
    } else {
        console.log('WARNING: No SPY data found in historicalData!');
        console.log('Available symbols:', Object.keys(historicalData));
    }

    // バックテスト実行
    let strategyCapital = initialCapital;
    let benchmarkCapital = initialCapital;
    const monthlyResults = [];
    let currentPositions = [];
    let lastRebalanceMonth = -1;

    // 現実的なコスト設定
    const TRANSACTION_COST = 0.005;  // 0.5% 取引コスト
    const SLIPPAGE_COST = 0.002;     // 0.2% スリッページ
    const TOTAL_TRADE_COST = TRANSACTION_COST + SLIPPAGE_COST;  // 0.7%
    const REBALANCE_FREQUENCY = 3;   // 四半期ごと（3ヶ月）

    for (let i = 0; i < testDates.length; i++) {
        const currentDate = testDates[i];
        const currentMonth = parseInt(currentDate.slice(5, 7));

        // 各銘柄のスコアを計算
        const scoredStocks = [];

        for (const [symbol, data] of Object.entries(historicalData)) {
            if (symbol === 'SPY') continue; // ベンチマークは除外

            const dataIndex = data.findIndex(d => d.date === currentDate);
            if (dataIndex === -1 || dataIndex < 12) continue; // データ不足

            const score = calculateScore(data, dataIndex);
            const currentPrice = data[dataIndex].close;
            const prevPrice = dataIndex > 0 ? data[dataIndex - 1].close : currentPrice;
            const monthlyReturn = (currentPrice - prevPrice) / prevPrice;

            scoredStocks.push({
                symbol,
                score,
                monthlyReturn,
                price: currentPrice,
            });
        }

        // スコアでソート
        scoredStocks.sort((a, b) => b.score - a.score);

        // 四半期ごとにリバランス（1月、4月、7月、10月）
        const shouldRebalance = (i === 0) ||
            (currentMonth !== lastRebalanceMonth &&
                (currentMonth === 1 || currentMonth === 4 || currentMonth === 7 || currentMonth === 10));

        let selectedStocks;
        if (shouldRebalance) {
            // 上位銘柄を選定
            selectedStocks = scoredStocks
                .filter(s => s.score >= minScoreToHold)
                .slice(0, maxPositions);
            lastRebalanceMonth = currentMonth;
        } else {
            // リバランスしない月は、現在のポジションを維持
            selectedStocks = scoredStocks.filter(s => currentPositions.includes(s.symbol));
        }

        // ポートフォリオリターン計算
        let portfolioReturn = 0;
        if (selectedStocks.length > 0) {
            const totalScore = selectedStocks.reduce((sum, s) => sum + s.score, 0);
            selectedStocks.forEach(stock => {
                const weight = stock.score / totalScore;
                portfolioReturn += stock.monthlyReturn * weight;
            });

            // 取引コスト（リバランス時のみ、新規ポジションに対して）
            if (shouldRebalance) {
                const newPositions = selectedStocks.filter(s => !currentPositions.includes(s.symbol));
                const exitedPositions = currentPositions.filter(s => !selectedStocks.map(x => x.symbol).includes(s));

                // 新規購入と売却の両方にコストがかかる
                const turnover = (newPositions.length + exitedPositions.length) / Math.max(selectedStocks.length, 1);
                portfolioReturn -= turnover * TOTAL_TRADE_COST;

                // リバランス時のログ（最初の3回のみ）
                const rebalanceCount = monthlyResults.filter(m => m.totalPositions > 0).length;
                if (rebalanceCount < 12) {  // 最初の3年分（= 12四半期）
                    console.log(`\n📊 Rebalance at ${currentDate}:`);
                    console.log(`   Top 5 selected stocks by score:`);
                    selectedStocks.slice(0, 5).forEach((s, idx) => {
                        console.log(`   ${idx + 1}. ${s.symbol}: Score=${s.score}, Monthly Return=${(s.monthlyReturn * 100).toFixed(2)}%`);
                    });
                }
            }

            currentPositions = selectedStocks.map(s => s.symbol);
        }

        // ベンチマークリターン
        const spyIndex = spyData.findIndex(d => d.date === currentDate);

        // 最初の数月だけデバッグ出力
        if (i < 3) {
            console.log(`Month ${i}: currentDate=${currentDate}, spyIndex=${spyIndex}`);
            if (spyIndex >= 0) {
                console.log(`  SPY close=${spyData[spyIndex].close}, prev close=${spyIndex > 0 ? spyData[spyIndex - 1].close : 'N/A'}`);
            }
        }

        const spyReturn = spyIndex > 0
            ? (spyData[spyIndex].close - spyData[spyIndex - 1].close) / spyData[spyIndex - 1].close
            : 0;

        // 資産更新
        strategyCapital *= (1 + portfolioReturn);
        benchmarkCapital *= (1 + spyReturn);

        monthlyResults.push({
            date: currentDate,
            strategyValue: strategyCapital,
            benchmarkValue: benchmarkCapital,
            strategyReturn: portfolioReturn * 100,
            benchmarkReturn: spyReturn * 100,
            positions: selectedStocks.slice(0, 5).map(s => s.symbol),
            avgScore: selectedStocks.length > 0
                ? selectedStocks.reduce((sum, s) => sum + s.score, 0) / selectedStocks.length
                : 0,
            totalPositions: selectedStocks.length,
        });
    }

    // メトリクス計算
    const finalStrategy = monthlyResults[monthlyResults.length - 1].strategyValue;
    const finalBenchmark = monthlyResults[monthlyResults.length - 1].benchmarkValue;
    const years = testDates.length / 12;

    const strategyReturns = monthlyResults.map(m => m.strategyReturn / 100);
    const benchmarkReturns = monthlyResults.map(m => m.benchmarkReturn / 100);

    const strategyVolatility = calculateVolatility(strategyReturns);
    const benchmarkVolatility = calculateVolatility(benchmarkReturns);

    const results = {
        isOutOfSample: true,
        trainPeriod: { start: '2015-01', end: trainEndDate.slice(0, 7) },
        testPeriod: { start: testDates[0], end: testDates[testDates.length - 1] },
        totalSymbols: Object.keys(historicalData).length,

        strategy: {
            metrics: {
                initialCapital,
                finalValue: Math.round(finalStrategy),
                totalReturn: ((finalStrategy - initialCapital) / initialCapital * 100).toFixed(2),
                cagr: ((Math.pow(finalStrategy / initialCapital, 1 / years) - 1) * 100).toFixed(2),
                volatility: (strategyVolatility * 100).toFixed(2),
                sharpeRatio: ((strategyReturns.reduce((a, b) => a + b, 0) / strategyReturns.length * 12 - 0.02) / strategyVolatility).toFixed(2),
                maxDrawdown: calculateMaxDrawdown(monthlyResults.map(m => m.strategyValue)).toFixed(2),
            },
        },

        benchmark: {
            metrics: {
                initialCapital,
                finalValue: Math.round(finalBenchmark),
                totalReturn: ((finalBenchmark - initialCapital) / initialCapital * 100).toFixed(2),
                cagr: ((Math.pow(finalBenchmark / initialCapital, 1 / years) - 1) * 100).toFixed(2),
                volatility: (benchmarkVolatility * 100).toFixed(2),
                sharpeRatio: ((benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length * 12 - 0.02) / benchmarkVolatility).toFixed(2),
                maxDrawdown: calculateMaxDrawdown(monthlyResults.map(m => m.benchmarkValue)).toFixed(2),
            },
        },

        comparison: {
            returnDifference: ((finalStrategy - initialCapital) / initialCapital * 100 -
                (finalBenchmark - initialCapital) / initialCapital * 100).toFixed(2),
            cagrDifference: ((Math.pow(finalStrategy / initialCapital, 1 / years) - 1) * 100 -
                (Math.pow(finalBenchmark / initialCapital, 1 / years) - 1) * 100).toFixed(2),
            winRate: (monthlyResults.filter(m => m.strategyReturn > m.benchmarkReturn).length / monthlyResults.length * 100).toFixed(1),
            outperformed: finalStrategy > finalBenchmark,
            testPeriodMonths: testDates.length,
        },

        monthlyData: monthlyResults,
    };

    return results;
}

function calculateVolatility(returns) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(12);
}

function calculateMaxDrawdown(values) {
    let maxDrawdown = 0;
    let peak = values[0];

    for (const value of values) {
        if (value > peak) peak = value;
        const drawdown = ((peak - value) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return -maxDrawdown;
}

/**
 * 利用可能な銘柄リストを取得
 */
app.get('/api/symbols', (req, res) => {
    res.json({ symbols: SP500_SYMBOLS });
});

/**
 * ヘルスチェック
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================================
// 自動売買シミュレーター API
// ========================================

/**
 * 現在のポジションを取得
 */
app.get('/api/simulator/positions', (req, res) => {
    try {
        const positionsFile = path.join(__dirname, 'simulation-data', 'current-positions.json');
        if (fs.existsSync(positionsFile)) {
            const data = JSON.parse(fs.readFileSync(positionsFile, 'utf-8'));
            res.json(data);
        } else {
            res.json({
                cash: SimulatorConfig.initialCapital,
                holdings: [],
                totalValue: SimulatorConfig.initialCapital,
                totalReturn: 0,
                message: 'シミュレーション未開始'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * シミュレーション履歴を取得
 */
app.get('/api/simulator/history', (req, res) => {
    try {
        const historyFile = path.join(__dirname, 'simulation-data', 'simulation-history.json');
        if (fs.existsSync(historyFile)) {
            const data = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
            res.json({ history: data });
        } else {
            res.json({ history: [] });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * シミュレーションを手動実行
 */
app.post('/api/simulator/run', async (req, res) => {
    try {
        console.log('📊 手動シミュレーション実行開始...');
        await runOnce();

        // 結果を返す
        const positionsFile = path.join(__dirname, 'simulation-data', 'current-positions.json');
        if (fs.existsSync(positionsFile)) {
            const data = JSON.parse(fs.readFileSync(positionsFile, 'utf-8'));
            res.json({
                success: true,
                message: 'シミュレーションが完了しました',
                result: data
            });
        } else {
            res.json({ success: true, message: 'シミュレーションが完了しました' });
        }
    } catch (error) {
        console.error('シミュレーションエラー:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * シミュレーション設定を取得
 */
app.get('/api/simulator/config', (req, res) => {
    res.json({
        initialCapital: SimulatorConfig.initialCapital,
        maxPositions: SimulatorConfig.maxPositions,
        minScoreToHold: SimulatorConfig.minScoreToHold,
        rebalanceDay: SimulatorConfig.rebalanceDay,
        scheduleTime: '毎日 9:00 (JST)'
    });
});

app.listen(PORT, () => {
    console.log(`
🚀 Yahoo Finance API Server running on http://localhost:${PORT}

Available endpoints:
  GET  /api/health              - Health check
  GET  /api/symbols             - Get available symbols
  GET  /api/historical/:symbol  - Get historical data for a symbol
  POST /api/historical/batch    - Get historical data for multiple symbols
  POST /api/backtest            - Run backtest with scoring algorithm

📊 Auto Trading Simulator endpoints:
  GET  /api/simulator/positions - Get current positions
  GET  /api/simulator/history   - Get simulation history
  POST /api/simulator/run       - Run simulation manually
  GET  /api/simulator/config    - Get simulator configuration
  `);

    // 自動売買シミュレーターのスケジューラーを開始
    console.log('\n📊 自動売買シミュレーターを起動中...');
    startScheduler();
});
