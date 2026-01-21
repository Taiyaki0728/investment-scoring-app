import React, { useState, useMemo } from 'react';
import { runBacktest, calculateAnnualReturns } from '../lib/backtestEngine';
import { runRealDataBacktest, calculateRealAnnualReturns } from '../lib/realDataBacktest';

function BacktestPage() {
    const [backtestResults, setBacktestResults] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [hasRun, setHasRun] = useState(false);
    const [dataMode, setDataMode] = useState('api'); // 'api', 'hardcoded', 'simulation'
    const [progress, setProgress] = useState('');
    const [error, setError] = useState(null);

    // バックテスト実行
    const handleRunBacktest = async () => {
        setIsRunning(true);
        setBacktestResults(null);
        setError(null);
        setProgress('バックテストを開始しています...');

        try {
            let results;

            if (dataMode === 'api') {
                // Yahoo Finance API経由でバックテスト
                setProgress('Yahoo Finance APIから50銘柄のデータを取得中（約2-3分かかります）...');

                const response = await fetch('http://localhost:3001/api/backtest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        minScoreToHold: 50,
                        maxPositions: 20,
                        initialCapital: 10000000,
                    }),
                });

                if (!response.ok) {
                    throw new Error('APIサーバーに接続できません。npm run server を実行してください。');
                }

                results = await response.json();

                if (results.error) {
                    throw new Error(results.error);
                }

            } else if (dataMode === 'hardcoded') {
                // ハードコードされた実データバックテスト
                setProgress('ハードコードされた6銘柄でバックテスト中...');
                await new Promise(resolve => setTimeout(resolve, 500));

                const rawResults = runRealDataBacktest();
                results = {
                    strategy: { metrics: rawResults.strategy.metrics },
                    benchmark: { metrics: rawResults.benchmark.metrics },
                    comparison: rawResults.comparison,
                    monthlyData: rawResults.strategy.monthlyData.map((s, i) => ({
                        date: s.date,
                        strategyValue: s.value,
                        benchmarkValue: rawResults.benchmark.monthlyData[i].value,
                        strategyReturn: s.return,
                        benchmarkReturn: rawResults.benchmark.monthlyData[i].return,
                        positions: s.positions,
                        avgScore: s.avgScore,
                    })),
                    isOutOfSample: rawResults.isOutOfSample,
                    trainPeriod: rawResults.trainPeriod,
                    testPeriod: rawResults.testPeriod,
                    totalSymbols: 6,
                };
            } else {
                // シミュレーションデータバックテスト
                setProgress('シミュレーションデータでバックテスト中...');
                await new Promise(resolve => setTimeout(resolve, 500));
                results = runBacktest();
            }

            setBacktestResults(results);
            setHasRun(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsRunning(false);
            setProgress('');
        }
    };

    // 年間リターン計算
    const annualReturns = useMemo(() => {
        if (!backtestResults || !backtestResults.monthlyData) return null;

        // 年間リターンを計算
        const years = {};
        backtestResults.monthlyData.forEach((d, i) => {
            const year = d.date.slice(0, 4);
            if (!years[year]) years[year] = { first: i, last: i };
            else years[year].last = i;
        });

        const result = {};
        Object.entries(years).forEach(([year, { first, last }]) => {
            const data = backtestResults.monthlyData;
            const startS = first > 0 ? data[first - 1].strategyValue : 10000000;
            const endS = data[last].strategyValue;
            const startB = first > 0 ? data[first - 1].benchmarkValue : 10000000;
            const endB = data[last].benchmarkValue;

            const strategyReturn = ((endS - startS) / startS * 100);
            const benchmarkReturn = ((endB - startB) / startB * 100);

            result[year] = {
                strategy: strategyReturn.toFixed(2),
                benchmark: benchmarkReturn.toFixed(2),
                difference: (strategyReturn - benchmarkReturn).toFixed(2),
                outperformed: strategyReturn > benchmarkReturn,
            };
        });

        return result;
    }, [backtestResults]);

    // チャートデータ
    const chartData = useMemo(() => {
        if (!backtestResults) return [];
        return backtestResults.monthlyData;
    }, [backtestResults]);

    // SVGラインチャートのパス生成
    const generateChartPath = (data, key, width, height, padding) => {
        if (!data || data.length === 0) return '';

        const values = data.map(d => d[key]);
        const min = Math.min(...values) * 0.95;
        const max = Math.max(...values) * 1.05;

        const xScale = (width - padding * 2) / (data.length - 1);
        const yScale = (height - padding * 2) / (max - min);

        const points = data.map((d, i) => {
            const x = padding + i * xScale;
            const y = height - padding - (d[key] - min) * yScale;
            return `${x},${y}`;
        });

        return `M ${points.join(' L ')}`;
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* ヘッダー */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px'
            }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
                        📊 バックテスト結果
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {dataMode === 'api'
                            ? `スコアリングアルゴリズム vs S&P 500 (Yahoo Finance API: ${backtestResults?.totalSymbols || 50}銘柄)`
                            : dataMode === 'hardcoded'
                                ? 'スコアリングアルゴリズム vs S&P 500 (実データ: 6銘柄 / アウトオブサンプル)'
                                : 'スコアリングアルゴリズム vs S&P 500 (シミュレーション: 2015年 - 2024年)'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        className={`btn ${isRunning ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={handleRunBacktest}
                        disabled={isRunning}
                        style={{ minWidth: '180px' }}
                    >
                        {isRunning ? '⏳ 実行中...' : hasRun ? '🔄 再実行' : '🚀 バックテスト実行'}
                    </button>
                </div>
            </div>

            {/* モード選択 */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '600' }}>データモード:</span>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            checked={dataMode === 'api'}
                            onChange={() => { setDataMode('api'); setHasRun(false); setBacktestResults(null); setError(null); }}
                        />
                        <span>🌐 Yahoo Finance API（50銘柄）</span>
                        <span style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                        }}>推奨</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            checked={dataMode === 'hardcoded'}
                            onChange={() => { setDataMode('hardcoded'); setHasRun(false); setBacktestResults(null); setError(null); }}
                        />
                        <span>📈 ハードコード（6銘柄）</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="radio"
                            checked={dataMode === 'simulation'}
                            onChange={() => { setDataMode('simulation'); setHasRun(false); setBacktestResults(null); setError(null); }}
                        />
                        <span>🎲 シミュレーション</span>
                    </label>
                </div>

                {dataMode === 'api' && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '8px',
                        borderLeft: '3px solid #10b981'
                    }}>
                        <strong style={{ color: '#10b981' }}>🌐 Yahoo Finance APIモード</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                            <li><strong>対象銘柄:</strong> S&P 500構成銘柄から50銘柄（テック、金融、ヘルスケア等）</li>
                            <li><strong>テスト期間:</strong> 2020年1月 - 2024年12月（アウトオブサンプル）</li>
                            <li><strong>選定ロジック:</strong> 毎月スコアを計算し、上位20銘柄をポートフォリオに</li>
                            <li><strong>注意:</strong> APIサーバー（port 3001）が起動している必要があります</li>
                        </ul>
                    </div>
                )}

                {dataMode === 'hardcoded' && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '8px',
                        borderLeft: '3px solid #3b82f6'
                    }}>
                        <strong style={{ color: '#3b82f6' }}>📈 ハードコードモード</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                            <li><strong>対象銘柄:</strong> AAPL, MSFT, NVDA, JPM, JNJ, GLD（6銘柄のみ）</li>
                            <li><strong>テスト期間:</strong> 2020年1月 - 2024年12月</li>
                            <li><strong>注意:</strong> 銘柄数が少ないため、スコアリングの効果が限定的</li>
                        </ul>
                    </div>
                )}
            </div>

            {/* エラー表示 */}
            {error && (
                <div style={{
                    marginBottom: '24px',
                    padding: '16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    color: '#ef4444'
                }}>
                    <strong>⚠️ エラー:</strong> {error}
                </div>
            )}

            {!hasRun && !isRunning && !error && (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                        {dataMode === 'api' ? '🌐' : dataMode === 'hardcoded' ? '📈' : '🎲'}
                    </div>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
                        {dataMode === 'api' ? 'Yahoo Finance APIバックテスト'
                            : dataMode === 'hardcoded' ? 'ハードコードデータバックテスト'
                                : 'シミュレーションバックテスト'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        {dataMode === 'api'
                            ? <>S&P 500構成銘柄50銘柄でスコアリングアルゴリズムを検証します。<br />約2-3分かかります。</>
                            : dataMode === 'hardcoded'
                                ? <>ハードコードされた6銘柄でアルゴリズムを検証します。</>
                                : <>シミュレーションデータで過去10年間のパフォーマンスを比較します。</>
                        }
                    </p>
                    <button className="btn btn-primary" onClick={handleRunBacktest}>
                        🚀 バックテストを開始
                    </button>
                </div>
            )}

            {isRunning && (
                <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }} className="animate-pulse">⏳</div>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>バックテスト実行中...</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {progress || 'データを処理しています...'}
                    </p>
                    <div style={{
                        width: '300px',
                        height: '4px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '2px',
                        margin: '24px auto',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: 'var(--gradient-primary)',
                            animation: 'shimmer 1.5s infinite',
                        }}></div>
                    </div>
                    {dataMode === 'api' && (
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '16px' }}>
                            Yahoo Finance APIから50銘柄のデータを取得中。しばらくお待ちください...
                        </p>
                    )}
                </div>
            )}

            {backtestResults && !isRunning && (
                <>
                    {/* アウトオブサンプル警告 */}
                    {backtestResults.isOutOfSample && (
                        <div style={{
                            marginBottom: '24px',
                            padding: '16px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '24px' }}>✅</span>
                            <div>
                                <strong style={{ color: '#10b981' }}>アウトオブサンプル検証</strong>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                                    テスト期間（{backtestResults.testPeriod?.start} - {backtestResults.testPeriod?.end}）は
                                    トレーニング期間と完全に分離されています。過学習のリスクを最小化しています。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* サマリーカード */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '24px',
                        marginBottom: '32px'
                    }}>
                        {/* 戦略結果 */}
                        <div className="card" style={{
                            background: backtestResults.comparison.outperformed
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.2) 100%)'
                                : 'var(--bg-card)',
                            borderColor: backtestResults.comparison.outperformed
                                ? 'rgba(16, 185, 129, 0.3)'
                                : 'var(--glass-border)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '24px',
                                }}>
                                    🤖
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: '600' }}>スコアリング戦略</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                        マルチファクターモデル {dataMode !== 'simulation' && '(実データ)'}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>総リターン</div>
                                    <div style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: parseFloat(backtestResults.strategy.metrics.totalReturn) >= 0
                                            ? 'var(--score-excellent)'
                                            : 'var(--score-poor)'
                                    }}>
                                        {parseFloat(backtestResults.strategy.metrics.totalReturn) >= 0 ? '+' : ''}
                                        {backtestResults.strategy.metrics.totalReturn}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>年率リターン (CAGR)</div>
                                    <div style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: 'var(--text-primary)'
                                    }}>
                                        {backtestResults.strategy.metrics.cagr}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>シャープレシオ</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                                        {backtestResults.strategy.metrics.sharpeRatio}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>最大ドローダウン</div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: 'var(--score-poor)'
                                    }}>
                                        {backtestResults.strategy.metrics.maxDrawdown}%
                                    </div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>最終資産額</div>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                        ¥{backtestResults.strategy.metrics.finalValue?.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ベンチマーク結果 */}
                        <div className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '24px',
                                }}>
                                    📊
                                </div>
                                <div>
                                    <h3 style={{ fontWeight: '600' }}>S&P 500</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                        ベンチマーク (SPY)
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>総リターン</div>
                                    <div style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: parseFloat(backtestResults.benchmark.metrics.totalReturn) >= 0
                                            ? 'var(--score-good)'
                                            : 'var(--score-poor)'
                                    }}>
                                        {parseFloat(backtestResults.benchmark.metrics.totalReturn) >= 0 ? '+' : ''}
                                        {backtestResults.benchmark.metrics.totalReturn}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>年率リターン (CAGR)</div>
                                    <div style={{
                                        fontSize: '24px',
                                        fontWeight: 'bold',
                                        color: 'var(--text-primary)'
                                    }}>
                                        {backtestResults.benchmark.metrics.cagr}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>シャープレシオ</div>
                                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                                        {backtestResults.benchmark.metrics.sharpeRatio}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>最大ドローダウン</div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: 'var(--score-poor)'
                                    }}>
                                        {backtestResults.benchmark.metrics.maxDrawdown}%
                                    </div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>最終資産額</div>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                        ¥{backtestResults.benchmark.metrics.finalValue?.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 比較結果 */}
                        <div className="card" style={{
                            background: backtestResults.comparison.outperformed
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)'
                                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.3) 100%)',
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                                    {backtestResults.comparison.outperformed ? '🏆' : '📉'}
                                </div>
                                <h3 style={{
                                    fontSize: '20px',
                                    fontWeight: 'bold',
                                    color: backtestResults.comparison.outperformed
                                        ? 'var(--score-excellent)'
                                        : 'var(--score-poor)'
                                }}>
                                    {backtestResults.comparison.outperformed
                                        ? 'アルゴリズムが勝利！'
                                        : 'S&P 500が優勢'}
                                </h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '8px',
                                }}>
                                    <span>リターン差</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: parseFloat(backtestResults.comparison.returnDifference) >= 0
                                            ? 'var(--score-excellent)'
                                            : 'var(--score-poor)'
                                    }}>
                                        {parseFloat(backtestResults.comparison.returnDifference) >= 0 ? '+' : ''}
                                        {backtestResults.comparison.returnDifference}%
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '8px',
                                }}>
                                    <span>CAGR差</span>
                                    <span style={{
                                        fontWeight: 'bold',
                                        color: parseFloat(backtestResults.comparison.cagrDifference) >= 0
                                            ? 'var(--score-excellent)'
                                            : 'var(--score-poor)'
                                    }}>
                                        {parseFloat(backtestResults.comparison.cagrDifference) >= 0 ? '+' : ''}
                                        {backtestResults.comparison.cagrDifference}%/年
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '12px',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '8px',
                                }}>
                                    <span>月間勝率</span>
                                    <span style={{ fontWeight: 'bold' }}>
                                        {backtestResults.comparison.winRate}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 新NISAシミュレーション */}
                    {(() => {
                        const initialCapital = 10000000;
                        const finalValue = backtestResults.strategy.metrics.finalValue;
                        const profit = finalValue - initialCapital;
                        const isProfitable = profit > 0;
                        const taxRate = 0.20315;

                        // 通常口座（特定口座）での手取り
                        const taxAmount = isProfitable ? profit * taxRate : 0;
                        const netProfitNormal = isProfitable ? profit - taxAmount : profit;

                        // NISA口座での手取り（非課税）
                        const netProfitNisa = profit; // まるまる利益

                        // NISAメリット（節税額）
                        const taxSavings = netProfitNisa - netProfitNormal;

                        return (
                            <div className="card" style={{ marginBottom: '32px', background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ fontSize: '32px' }}>🌱</div>
                                    <div>
                                        <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>新NISA活用シミュレーション</h3>
                                        <p style={{ color: 'var(--text-secondary)' }}>成長投資枠（最大240万円/年、生涯1200万円）をフル活用した場合の試算</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '32px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-card)', borderRadius: '16px' }}>
                                        <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>特定口座 (税引後)</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>
                                            +{Math.round(netProfitNormal).toLocaleString()}円
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>
                                            税金: -{Math.round(taxAmount).toLocaleString()}円
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', border: '2px solid #10b981' }}>
                                        <div style={{ fontSize: '14px', color: '#10b981', fontWeight: 'bold' }}>新NISA口座 (非課税)</div>
                                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: '#10b981' }}>
                                            +{Math.round(netProfitNisa).toLocaleString()}円
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                                            税金: 0円
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>💡 NISAならこれだけお得！</span>
                                        <span style={{ fontSize: '36px', fontWeight: '900', background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginTop: '8px' }}>
                                            {Math.round(taxSavings).toLocaleString()}円
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                                            ※利益確定時の手取り差額です。<br />投資額が年間240万円等NISA枠内と仮定。
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 資産推移チャート */}
                    <div className="card" style={{ marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
                            📈 資産推移 ({dataMode !== 'simulation' ? '2020年 - 2024年' : '2015年 - 2024年'})
                        </h3>
                        <div style={{ position: 'relative', height: '400px' }}>
                            <svg width="100%" height="100%" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
                                {/* グリッド線 */}
                                {[0, 1, 2, 3, 4].map(i => (
                                    <line
                                        key={i}
                                        x1="60"
                                        y1={80 + i * 60}
                                        x2="980"
                                        y2={80 + i * 60}
                                        stroke="var(--glass-border)"
                                        strokeDasharray="4,4"
                                    />
                                ))}

                                {/* Y軸ラベル */}
                                {chartData.length > 0 && (() => {
                                    const maxValue = Math.max(
                                        ...chartData.map(d => Math.max(d.strategyValue, d.benchmarkValue))
                                    );
                                    const minValue = Math.min(
                                        ...chartData.map(d => Math.min(d.strategyValue, d.benchmarkValue))
                                    );
                                    return [0, 1, 2, 3, 4].map(i => {
                                        const value = maxValue - (i / 4) * (maxValue - minValue * 0.9);
                                        return (
                                            <text
                                                key={i}
                                                x="55"
                                                y={85 + i * 60}
                                                fill="var(--text-tertiary)"
                                                fontSize="10"
                                                textAnchor="end"
                                            >
                                                ¥{(value / 1000000).toFixed(0)}M
                                            </text>
                                        );
                                    });
                                })()}

                                {/* X軸ラベル */}
                                {(dataMode !== 'simulation' ? [2020, 2021, 2022, 2023, 2024] : [2015, 2017, 2019, 2021, 2023]).map((year, i) => (
                                    <text
                                        key={year}
                                        x={60 + i * 230}
                                        y="385"
                                        fill="var(--text-tertiary)"
                                        fontSize="12"
                                        textAnchor="middle"
                                    >
                                        {year}
                                    </text>
                                ))}

                                {/* ベンチマークライン */}
                                <path
                                    d={generateChartPath(chartData, 'benchmarkValue', 1000, 400, 60)}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="2"
                                    opacity="0.7"
                                />

                                {/* 戦略ライン */}
                                <path
                                    d={generateChartPath(chartData, 'strategyValue', 1000, 400, 60)}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="3"
                                    style={{ filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))' }}
                                />
                            </svg>

                            {/* 凡例 */}
                            <div style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                display: 'flex',
                                gap: '24px',
                                background: 'var(--bg-tertiary)',
                                padding: '8px 16px',
                                borderRadius: '8px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '16px', height: '3px', background: '#10b981', borderRadius: '2px' }}></div>
                                    <span style={{ fontSize: '12px' }}>スコアリング戦略</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '16px', height: '3px', background: '#f59e0b', borderRadius: '2px' }}></div>
                                    <span style={{ fontSize: '12px' }}>S&P 500</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 年間リターン比較テーブル */}
                    {annualReturns && Object.keys(annualReturns).length > 0 && (
                        <div className="card">
                            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>
                                📅 年間リターン比較 {dataMode !== 'simulation' && '(アウトオブサンプル期間)'}
                            </h3>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>年</th>
                                            <th>スコアリング戦略</th>
                                            <th>S&P 500</th>
                                            <th>差分</th>
                                            <th>結果</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(annualReturns).map(([year, data]) => (
                                            <tr key={year}>
                                                <td style={{ fontWeight: '600' }}>{year}</td>
                                                <td style={{
                                                    color: parseFloat(data.strategy) >= 0
                                                        ? 'var(--score-excellent)'
                                                        : 'var(--score-poor)'
                                                }}>
                                                    {parseFloat(data.strategy) >= 0 ? '+' : ''}{data.strategy}%
                                                </td>
                                                <td style={{
                                                    color: parseFloat(data.benchmark) >= 0
                                                        ? 'var(--score-good)'
                                                        : 'var(--score-poor)'
                                                }}>
                                                    {parseFloat(data.benchmark) >= 0 ? '+' : ''}{data.benchmark}%
                                                </td>
                                                <td style={{
                                                    fontWeight: '600',
                                                    color: parseFloat(data.difference) >= 0
                                                        ? 'var(--score-excellent)'
                                                        : 'var(--score-poor)'
                                                }}>
                                                    {parseFloat(data.difference) >= 0 ? '+' : ''}{data.difference}%
                                                </td>
                                                <td>
                                                    <span style={{
                                                        padding: '4px 12px',
                                                        borderRadius: '20px',
                                                        fontSize: '12px',
                                                        background: data.outperformed
                                                            ? 'rgba(16, 185, 129, 0.2)'
                                                            : 'rgba(239, 68, 68, 0.2)',
                                                        color: data.outperformed
                                                            ? 'var(--score-excellent)'
                                                            : 'var(--score-poor)',
                                                    }}>
                                                        {data.outperformed ? '勝利 🏆' : '敗北'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 結論セクション */}
                    <div className="card" style={{
                        marginTop: '32px',
                        background: dataMode !== 'simulation'
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.2) 100%)'
                            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.2) 100%)',
                    }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
                            📋 バックテスト結論 {dataMode !== 'simulation' && '(実データ)'}
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '24px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.8',
                        }}>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>主な発見</h4>
                                <ul style={{ paddingLeft: '20px' }}>
                                    <li>{dataMode !== 'simulation' ? '5' : '10'}年間の総リターン差: <strong style={{ color: backtestResults.comparison.outperformed ? 'var(--score-excellent)' : 'var(--score-poor)' }}>
                                        {backtestResults.comparison.returnDifference}%
                                    </strong></li>
                                    <li>月間勝率: <strong>{backtestResults.comparison.winRate}%</strong></li>
                                    <li>シャープレシオ差: <strong>{backtestResults.comparison.sharpeDifference || 'N/A'}</strong></li>
                                    {dataMode !== 'simulation' && <li>テスト期間: <strong>{backtestResults.comparison.testPeriodMonths}ヶ月</strong></li>}
                                </ul>
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                                    {dataMode !== 'simulation' ? '検証の信頼性' : '注意事項'}
                                </h4>
                                <ul style={{ paddingLeft: '20px' }}>
                                    {dataMode !== 'simulation' ? (
                                        <>
                                            <li>✅ 実際のYahoo Financeデータを使用</li>
                                            <li>✅ アウトオブサンプル検証を実施</li>
                                            <li>✅ センチメントスコアは固定値（予測の漏れを防止）</li>
                                            <li>⚠️ 銘柄ユニバースは{dataMode === 'api' ? '50銘柄' : '6銘柄のみ'}</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>このシミュレーションはモンテカルロ法に基づく推定値です</li>
                                            <li>実際の取引ではスリッページやより高い取引コストが発生します</li>
                                            <li>過去のパフォーマンスは将来の結果を保証しません</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )
            }
        </div >
    );
}

export default BacktestPage;
