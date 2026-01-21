import React, { useState, useEffect, useMemo } from 'react';
import { generateSampleData, updateAssetsWithRealData, filterAssets, sortAssets, getAssetTypes, getSectors, getMarkets } from './lib/sampleData';
import { calculatePortfolioAllocation, getScoreCategory } from './lib/scoringEngine';
import ScoreCircle from './components/ScoreCircle';
import AssetCard from './components/AssetCard';
import FactorBreakdown from './components/FactorBreakdown';
import PortfolioAllocation from './components/PortfolioAllocation';
import AssetDetail from './components/AssetDetail';
import Header from './components/Header';
import BacktestPage from './components/BacktestPage';
import MarketTicker from './components/MarketTicker';
import SimulatorPage from './components/SimulatorPage';

function App() {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [assets, setAssets] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        market: '',
        sector: '',
        type: '',
        minScore: 0,
    });
    const [sortBy, setSortBy] = useState('totalScore');
    const [sortOrder, setSortOrder] = useState('desc');
    const [riskTolerance, setRiskTolerance] = useState('moderate');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [realDataProgress, setRealDataProgress] = useState(0);

    // 初期データ読み込み & リアルデータ取得開始
    useEffect(() => {
        setIsLoading(true);
        setRealDataProgress(0);

        // 1. まずモックデータを即座に表示
        const mockData = generateSampleData();
        setAssets(mockData);
        setIsLoading(false);

        // 2. バックグラウンドでリアルデータを取得して更新 (非同期)
        // ここではユーザー要望に応え全件取得を試みる（時間はかかる）
        const fetchRealData = async () => {
            try {
                // 表示されている銘柄を優先するロジックを入れたいが、まずは全件
                const updatedAssets = await updateAssetsWithRealData(mockData, (progress) => {
                    setRealDataProgress(progress);
                });
                setAssets(prevAssets => {
                    // ユーザーがフィルタ操作などをしている間にデータが変わるのを防ぐため、
                    // 以前のアセットIDと突合して更新するのが理想だが、今回は一括置換
                    return updatedAssets;
                });
            } catch (error) {
                console.error("Failed to fetch real data:", error);
            }
        };

        // 少し遅延させて開始（初期描画をブロックしないため）
        setTimeout(fetchRealData, 1000);

    }, [refreshKey]);

    // フィルタリングとソート
    const filteredAssets = useMemo(() => {
        const filtered = filterAssets(assets, filters);
        return sortAssets(filtered, sortBy, sortOrder);
    }, [assets, filters, sortBy, sortOrder]);

    // ポートフォリオ配分計算
    const portfolioAllocation = useMemo(() => {
        return calculatePortfolioAllocation(assets, riskTolerance);
    }, [assets, riskTolerance]);

    // トップスコア銘柄
    const topAssets = useMemo(() => {
        return sortAssets(assets, 'totalScore', 'desc').slice(0, 5);
    }, [assets]);

    // スコア分布
    const scoreDistribution = useMemo(() => {
        const dist = { excellent: 0, good: 0, neutral: 0, warning: 0, poor: 0, critical: 0 };
        assets.forEach(a => {
            const category = getScoreCategory(a.totalScore);
            dist[category.color]++;
        });
        return dist;
    }, [assets]);

    // データリフレッシュ
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        setSelectedAsset(null);
    };

    // フィルター変更
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // ソート変更
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    return (
        <div className="app-container">
            <Header onRefresh={handleRefresh} onNavigate={setCurrentPage} currentPage={currentPage} />

            {/* リアルタイムデータ取得進捗バー */}
            {realDataProgress > 0 && realDataProgress < 100 && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 9999 }}>
                    <div style={{ width: `${realDataProgress}%`, height: '4px', background: '#3b82f6', transition: 'width 0.3s' }}></div>
                </div>
            )}

            <MarketTicker />

            {currentPage === 'backtest' ? (
                <BacktestPage />
            ) : currentPage === 'simulator' ? (
                <SimulatorPage />
            ) : (
                <main className="main-content">
                    {/* ダッシュボードセクション */}
                    <section className="grid-dashboard animate-fadeIn">
                        {/* サマリーカード */}
                        <div className="col-span-4">
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        📊 ポートフォリオサマリー
                                        {realDataProgress < 100 && realDataProgress > 0 && (
                                            <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '10px', color: '#3b82f6' }}>
                                                リアルタイムデータ取得中: {realDataProgress}%
                                            </span>
                                        )}
                                    </h2>
                                    <span className="card-subtitle">全{assets.length}銘柄</span>
                                </div>
                                <div className="score-distribution">
                                    <div className="flex gap-4 justify-between mt-4">
                                        {Object.entries(scoreDistribution).map(([key, count]) => (
                                            <div key={key} className="text-center">
                                                <div className={`score-badge ${key}`} style={{ minWidth: '50px' }}>
                                                    {count}
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                                    {key === 'excellent' ? '強力買い' :
                                                        key === 'good' ? '買い' :
                                                            key === 'neutral' ? '保有' :
                                                                key === 'warning' ? '注意' :
                                                                    key === 'poor' ? '売り' : '強力売り'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ポートフォリオ配分 */}
                        <div className="col-span-4">
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">🎯 推奨ポートフォリオ配分</h2>
                                    <select
                                        className="input"
                                        style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                                        value={riskTolerance}
                                        onChange={(e) => setRiskTolerance(e.target.value)}
                                    >
                                        <option value="conservative">保守的</option>
                                        <option value="moderate">中程度</option>
                                        <option value="aggressive">積極的</option>
                                    </select>
                                </div>
                                <PortfolioAllocation allocation={portfolioAllocation} />
                            </div>
                        </div>

                        {/* トップ銘柄 */}
                        <div className="col-span-4">
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">🏆 トップスコア銘柄</h2>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {topAssets.map((asset, index) => (
                                        <div
                                            key={asset.symbol}
                                            className="flex items-center gap-4 p-4"
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => setSelectedAsset(asset)}
                                        >
                                            <span style={{
                                                fontSize: '18px',
                                                fontWeight: 'bold',
                                                color: index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : 'var(--text-tertiary)',
                                                width: '24px'
                                            }}>
                                                {index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div style={{ fontWeight: 600 }}>{asset.symbol}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{asset.name}</div>
                                            </div>
                                            <div className={`score-badge ${asset.category.color}`}>
                                                {asset.totalScore}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* フィルターセクション */}
                    <section className="mt-4 animate-slideUp" style={{ animationDelay: '0.1s' }}>
                        <div className="card">
                            <div className="flex gap-4 items-center flex-wrap">
                                <div className="search-input" style={{ flex: 1, minWidth: '200px' }}>
                                    <span className="search-icon">🔍</span>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="銘柄を検索..."
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange('search', e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <select
                                    className="input"
                                    value={filters.market}
                                    onChange={(e) => handleFilterChange('market', e.target.value)}
                                >
                                    <option value="">全市場</option>
                                    {getMarkets().map(m => (
                                        <option key={m} value={m}>{m === 'US' ? '米国' : '日本'}</option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    value={filters.type}
                                    onChange={(e) => handleFilterChange('type', e.target.value)}
                                >
                                    <option value="">全タイプ</option>
                                    {getAssetTypes().map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    value={filters.sector}
                                    onChange={(e) => handleFilterChange('sector', e.target.value)}
                                >
                                    <option value="">全セクター</option>
                                    {getSectors().map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    value={filters.minScore}
                                    onChange={(e) => handleFilterChange('minScore', Number(e.target.value))}
                                >
                                    <option value={0}>全スコア</option>
                                    <option value={50}>50点以上（保有推奨）</option>
                                    <option value={65}>65点以上（買い推奨）</option>
                                    <option value={80}>80点以上（強力買い）</option>
                                </select>
                                <button className="btn btn-secondary" onClick={handleRefresh}>
                                    🔄 更新
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* 銘柄グリッド */}
                    <section className="mt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
                                📈 銘柄一覧
                                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginLeft: '8px' }}>
                                    ({filteredAssets.length}件)
                                </span>
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    className={`btn ${sortBy === 'totalScore' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => handleSort('totalScore')}
                                >
                                    スコア順 {sortBy === 'totalScore' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </button>
                                <button
                                    className={`btn ${sortBy === 'priceChange' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => handleSort('priceChange')}
                                >
                                    騰落率順 {sortBy === 'priceChange' && (sortOrder === 'desc' ? '↓' : '↑')}
                                </button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="grid-dashboard">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="col-span-3">
                                        <div className="card skeleton" style={{ height: '200px' }}></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid-dashboard">
                                {filteredAssets.map((asset, index) => (
                                    <div
                                        key={asset.symbol}
                                        className="col-span-3 animate-slideUp"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        <AssetCard
                                            asset={asset}
                                            onClick={() => setSelectedAsset(asset)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 銘柄詳細モーダル */}
                    {selectedAsset && (
                        <AssetDetail
                            asset={selectedAsset}
                            onClose={() => setSelectedAsset(null)}
                        />
                    )}
                </main>
            )}
        </div>
    );
}

export default App;
