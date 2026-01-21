import React from 'react';

function AssetCard({ asset, onClick }) {
    const {
        symbol,
        name,
        type,
        totalScore,
        priceChange,
        category,
        factors,
        sector,
    } = asset;

    // アイコンタイプを決定
    const getIconType = () => {
        if (type === 'us-stock') return 'us-stock';
        if (type === 'jp-stock') return 'jp-stock';
        if (type === 'gold') return 'gold';
        return 'etf';
    };

    // アイコンの表示テキスト
    const getIconText = () => {
        if (type === 'us-stock') return '🇺🇸';
        if (type === 'jp-stock') return '🇯🇵';
        if (type === 'gold') return '🥇';
        return '📈';
    };

    return (
        <div className="asset-card" onClick={onClick}>
            <div className="asset-card-header">
                <div className={`asset-icon ${getIconType()}`}>
                    {getIconText()}
                </div>
                <div className="asset-info">
                    <div className="asset-symbol" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {symbol}
                        {asset.nisa?.isGrowth && (
                            <span title="成長投資枠対象" style={{ fontSize: '10px', cursor: 'help' }}>🌱</span>
                        )}
                        {asset.nisa?.isTsumitate && (
                            <span title="つみたて枠対象" style={{ fontSize: '10px', cursor: 'help' }}>💰</span>
                        )}
                    </div>
                    <div className="asset-name">{name}</div>
                </div>
                <div className="asset-score">
                    <div className={`asset-score-value ${category?.color || ''}`} style={{
                        color: totalScore >= 80 ? 'var(--score-excellent)' :
                            totalScore >= 65 ? 'var(--score-good)' :
                                totalScore >= 50 ? 'var(--score-neutral)' :
                                    totalScore >= 35 ? 'var(--score-warning)' :
                                        totalScore >= 20 ? 'var(--score-poor)' : 'var(--score-critical)'
                    }}>
                        {totalScore}
                    </div>
                    <div className={`score-badge ${category?.color || 'neutral'}`} style={{ marginTop: '4px' }}>
                        {category?.label || '保有'}
                    </div>
                </div>
            </div>

            <div className="asset-card-body">
                <div className="asset-metric">
                    <div className="asset-metric-label">騰落率</div>
                    <div className={`asset-metric-value ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                        {priceChange >= 0 ? '+' : ''}{priceChange?.toFixed(2)}%
                    </div>
                </div>
                <div className="asset-metric">
                    <div className="asset-metric-label">セクター</div>
                    <div className="asset-metric-value" style={{ fontSize: '12px' }}>
                        {sector}
                    </div>
                </div>
                <div className="asset-metric">
                    <div className="asset-metric-label">ファンダメンタル</div>
                    <div className="asset-metric-value">
                        {factors?.fundamental ?? '-'}
                    </div>
                </div>
                <div className="asset-metric">
                    <div className="asset-metric-label">テクニカル</div>
                    <div className="asset-metric-value">
                        {factors?.technical ?? '-'}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AssetCard;
