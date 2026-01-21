import React, { useState, useEffect, useCallback } from 'react';
import {
    loadPositions,
    loadHistory,
    runDailySimulation,
    resetSimulation,
    getCurrentPrices,
    calculateStats,
    SIMULATOR_CONFIG,
    getStockCount,
} from '../lib/simulator';

function SimulatorPage() {
    const [positions, setPositions] = useState(null);
    const [history, setHistory] = useState([]);
    const [prices, setPrices] = useState({});
    const [stats, setStats] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // データ読み込み
    const loadData = useCallback(() => {
        const pos = loadPositions();
        const hist = loadHistory();
        const currentPrices = getCurrentPrices();

        setPositions(pos);
        setHistory(hist);
        setPrices(currentPrices);
        setStats(calculateStats(pos, hist));
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // シミュレーション実行
    const handleRunSimulation = async (forceRebalance = false) => {
        setIsRunning(true);

        // 少し遅延を入れてUXを良くする
        await new Promise(resolve => setTimeout(resolve, 500));

        const result = runDailySimulation(forceRebalance);
        setLastResult(result);
        loadData();

        setIsRunning(false);
    };

    // リセット
    const handleReset = () => {
        resetSimulation();
        loadData();
        setShowResetConfirm(false);
        setLastResult(null);
    };

    if (!positions) {
        return (
            <div className="simulator-loading">
                <div className="spinner"></div>
                <p>読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="simulator-page">
            {/* ページヘッダー */}
            <div className="simulator-header">
                <div className="simulator-title">
                    <h1>🤖 自動売買シミュレーター</h1>
                    <p className="simulator-subtitle">
                        S&P 500 全{getStockCount()}銘柄からAIスコアリングで自動運用
                    </p>
                </div>
                <div className="simulator-actions">
                    <button
                        className={`btn btn-primary ${isRunning ? 'btn-loading' : ''}`}
                        onClick={() => handleRunSimulation(false)}
                        disabled={isRunning}
                    >
                        {isRunning ? '実行中...' : '📊 シミュレーション実行'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => handleRunSimulation(true)}
                        disabled={isRunning}
                    >
                        🔄 強制リバランス
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={() => setShowResetConfirm(true)}
                    >
                        🗑️ リセット
                    </button>
                </div>
            </div>

            {/* リセット確認モーダル */}
            {showResetConfirm && (
                <div className="modal-overlay" onClick={() => setShowResetConfirm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>⚠️ シミュレーションをリセット</h3>
                        <p>すべてのデータが削除され、初期状態に戻ります。この操作は取り消せません。</p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>
                                キャンセル
                            </button>
                            <button className="btn btn-danger" onClick={handleReset}>
                                リセット実行
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 実行結果通知 */}
            {lastResult && !lastResult.skipped && (
                <div className={`simulator-notification ${lastResult.isRebalance ? 'rebalance' : 'update'}`}>
                    <span className="notification-icon">
                        {lastResult.isRebalance ? '🔄' : '📈'}
                    </span>
                    <span className="notification-text">
                        {lastResult.isRebalance
                            ? `リバランス完了: ${lastResult.trades.length}件の取引を実行`
                            : 'ポートフォリオを更新しました'}
                    </span>
                    <button
                        className="notification-close"
                        onClick={() => setLastResult(null)}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* メインダッシュボード */}
            <div className="simulator-grid">
                {/* 資産サマリー */}
                <div className="simulator-card summary-card">
                    <div className="summary-main">
                        <div className="summary-label">総資産評価額</div>
                        <div className="summary-value">
                            ¥{positions.totalValue?.toLocaleString() || '1,000,000'}
                        </div>
                        <div className={`summary-change ${positions.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                            {positions.totalReturn >= 0 ? '+' : ''}{positions.totalReturn?.toFixed(2) || '0.00'}%
                            <span className="change-label">累計リターン</span>
                        </div>
                    </div>
                    <div className="summary-details">
                        <div className="summary-item">
                            <span className="item-label">💵 現金</span>
                            <span className="item-value">¥{Math.round(positions.cash).toLocaleString()}</span>
                        </div>
                        <div className="summary-item">
                            <span className="item-label">📦 保有銘柄</span>
                            <span className="item-value">{positions.holdings.length}銘柄</span>
                        </div>
                        <div className="summary-item">
                            <span className="item-label">📅 開始日</span>
                            <span className="item-value">
                                {positions.startDate
                                    ? new Date(positions.startDate).toLocaleDateString('ja-JP')
                                    : '-'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* パフォーマンス統計 */}
                <div className="simulator-card stats-card">
                    <h3 className="card-title">📊 パフォーマンス統計</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <div className="stat-label">累計リターン</div>
                            <div className={`stat-value ${stats?.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                                {stats?.totalReturn >= 0 ? '+' : ''}{stats?.totalReturn?.toFixed(2) || '0.00'}%
                            </div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">勝率</div>
                            <div className="stat-value">{stats?.winRate?.toFixed(1) || '0.0'}%</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">最大ドローダウン</div>
                            <div className="stat-value negative">-{stats?.maxDrawdown?.toFixed(2) || '0.00'}%</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-label">総取引回数</div>
                            <div className="stat-value">{stats?.totalTrades || 0}回</div>
                        </div>
                    </div>
                </div>

                {/* 設定情報 */}
                <div className="simulator-card config-card">
                    <h3 className="card-title">⚙️ シミュレーション設定</h3>
                    <div className="config-list">
                        <div className="config-item">
                            <span>初期資金</span>
                            <span>¥{SIMULATOR_CONFIG.initialCapital.toLocaleString()}</span>
                        </div>
                        <div className="config-item">
                            <span>最大保有銘柄数</span>
                            <span>{SIMULATOR_CONFIG.maxPositions}銘柄</span>
                        </div>
                        <div className="config-item">
                            <span>最低保有スコア</span>
                            <span>{SIMULATOR_CONFIG.minScoreToHold}点以上</span>
                        </div>
                        <div className="config-item">
                            <span>リバランス日</span>
                            <span>毎月{SIMULATOR_CONFIG.rebalanceDay}日</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* タブナビゲーション */}
            <div className="simulator-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 ポートフォリオ
                </button>
                <button
                    className={`tab-btn ${activeTab === 'stocks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stocks')}
                >
                    📈 銘柄スコア
                </button>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    📜 取引履歴
                </button>
            </div>

            {/* タブコンテンツ */}
            <div className="simulator-content">
                {activeTab === 'overview' && (
                    <div className="holdings-section">
                        <h3>🏦 保有銘柄</h3>
                        {positions.holdings.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📭</div>
                                <p>保有銘柄がありません</p>
                                <p className="empty-hint">「シミュレーション実行」をクリックして開始してください</p>
                            </div>
                        ) : (
                            <div className="holdings-grid">
                                {positions.holdings
                                    .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
                                    .map(holding => (
                                        <div key={holding.symbol} className="holding-card">
                                            <div className="holding-header">
                                                <div className="holding-symbol">{holding.symbol}</div>
                                                <div className={`holding-gain ${holding.gainPct >= 0 ? 'positive' : 'negative'}`}>
                                                    {holding.gainPct >= 0 ? '+' : ''}{holding.gainPct?.toFixed(2) || '0.00'}%
                                                </div>
                                            </div>
                                            <div className="holding-name">{holding.name || holding.symbol}</div>
                                            <div className="holding-details">
                                                <div className="holding-row">
                                                    <span>保有株数</span>
                                                    <span>{holding.shares}株</span>
                                                </div>
                                                <div className="holding-row">
                                                    <span>現在価格</span>
                                                    <span>${holding.currentPrice?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="holding-row">
                                                    <span>評価額</span>
                                                    <span>¥{Math.round(holding.currentValue || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="holding-row">
                                                    <span>損益</span>
                                                    <span className={holding.gain >= 0 ? 'positive' : 'negative'}>
                                                        {holding.gain >= 0 ? '+' : ''}¥{Math.round(holding.gain || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'stocks' && (
                    <div className="stocks-section">
                        <h3>📈 銘柄スコアランキング</h3>
                        <div className="stocks-table-container">
                            <table className="stocks-table">
                                <thead>
                                    <tr>
                                        <th>順位</th>
                                        <th>銘柄</th>
                                        <th>セクター</th>
                                        <th>価格</th>
                                        <th>変動率</th>
                                        <th>スコア</th>
                                        <th>状態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(prices)
                                        .sort((a, b) => b.score - a.score)
                                        .map((stock, index) => {
                                            const isHeld = positions.holdings.some(h => h.symbol === stock.symbol);
                                            return (
                                                <tr key={stock.symbol} className={isHeld ? 'held-row' : ''}>
                                                    <td className="rank-cell">
                                                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                                                    </td>
                                                    <td>
                                                        <div className="stock-cell">
                                                            <span className="stock-symbol">{stock.symbol}</span>
                                                            <span className="stock-name">{stock.name}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`sector-badge ${stock.sector.toLowerCase()}`}>
                                                            {stock.sector}
                                                        </span>
                                                    </td>
                                                    <td>${stock.price.toFixed(2)}</td>
                                                    <td className={stock.change >= 0 ? 'positive' : 'negative'}>
                                                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                                                    </td>
                                                    <td>
                                                        <div className={`score-pill ${getScoreClass(stock.score)}`}>
                                                            {stock.score}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {isHeld && <span className="held-badge">保有中</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-section">
                        <h3>📜 取引履歴</h3>
                        {history.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📝</div>
                                <p>取引履歴がありません</p>
                            </div>
                        ) : (
                            <div className="history-list">
                                {[...history].reverse().slice(0, 30).map((record, index) => (
                                    <div key={index} className="history-item">
                                        <div className="history-date">
                                            {new Date(record.date).toLocaleDateString('ja-JP', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </div>
                                        <div className="history-summary">
                                            <span className="history-value">
                                                ¥{record.portfolioValue.toLocaleString()}
                                            </span>
                                            <span className={`history-return ${record.dailyReturn >= 0 ? 'positive' : 'negative'}`}>
                                                {record.dailyReturn >= 0 ? '+' : ''}{record.dailyReturn.toFixed(2)}%
                                            </span>
                                        </div>
                                        {record.trades && record.trades.length > 0 && (
                                            <div className="history-trades">
                                                {record.trades.map((trade, i) => (
                                                    <div key={i} className={`trade-item ${trade.type.toLowerCase()}`}>
                                                        <span className="trade-type">{trade.type === 'BUY' ? '📥' : '📤'}</span>
                                                        <span className="trade-symbol">{trade.symbol}</span>
                                                        <span className="trade-shares">{trade.shares}株</span>
                                                        <span className="trade-value">¥{Math.round(trade.value).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* バージョン情報（デバッグ用） */}
            <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '5px',
                fontSize: '12px',
                zIndex: 9999
            }}>
                v2.2 (Real Stock Data β)
            </div>
        </div>
    );
}

function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 50) return 'neutral';
    if (score >= 35) return 'warning';
    return 'poor';
}

export default SimulatorPage;
