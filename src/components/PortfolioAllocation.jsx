import React from 'react';

function PortfolioAllocation({ allocation }) {
    const { allocations = [], cashReserve = 5 } = allocation || {};

    // 色パレット
    const colors = [
        '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899', '#fbbf24',
        '#10b981', '#f97316', '#ef4444', '#84cc16', '#6366f1',
    ];

    // ドーナツチャートのセグメントを計算
    const calculateSegments = () => {
        const segments = [];
        let currentAngle = 0;

        allocations.forEach((item, index) => {
            const angle = (item.allocation / 100) * 360;
            segments.push({
                ...item,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                color: colors[index % colors.length],
            });
            currentAngle += angle;
        });

        // 現金部分
        if (cashReserve > 0) {
            const angle = (cashReserve / 100) * 360;
            segments.push({
                symbol: 'CASH',
                name: '現金',
                allocation: cashReserve,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                color: '#374151',
            });
        }

        return segments;
    };

    // SVGのarc pathを生成
    const describeArc = (x, y, radius, startAngle, endAngle) => {
        const start = polarToCartesian(x, y, radius, endAngle);
        const end = polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        ].join(' ');
    };

    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians)),
        };
    };

    const segments = calculateSegments();

    if (allocations.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '20px',
                color: 'var(--text-secondary)'
            }}>
                <p>スコアが50点以上の銘柄がありません。</p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                    現金100%保有を推奨します。
                </p>
            </div>
        );
    }

    return (
        <div className="allocation-chart">
            {/* ドーナツチャート */}
            <div className="allocation-donut">
                <svg width="200" height="200" viewBox="0 0 200 200">
                    {segments.map((segment, index) => (
                        <path
                            key={segment.symbol}
                            d={describeArc(100, 100, 70, segment.startAngle, segment.endAngle - 0.5)}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="30"
                            style={{
                                filter: `drop-shadow(0 0 4px ${segment.color}40)`,
                            }}
                        />
                    ))}
                    <text
                        x="100"
                        y="95"
                        textAnchor="middle"
                        fill="var(--text-primary)"
                        fontSize="24"
                        fontWeight="bold"
                    >
                        {allocations.length}
                    </text>
                    <text
                        x="100"
                        y="115"
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize="12"
                    >
                        銘柄
                    </text>
                </svg>
            </div>

            {/* 凡例 */}
            <div className="allocation-legend">
                {segments.slice(0, 6).map((segment) => (
                    <div key={segment.symbol} className="legend-item">
                        <div
                            className="legend-color"
                            style={{ background: segment.color }}
                        />
                        <div className="legend-label">
                            {segment.symbol}
                            {segment.name && (
                                <span style={{
                                    fontSize: '10px',
                                    color: 'var(--text-tertiary)',
                                    display: 'block'
                                }}>
                                    {segment.name.substring(0, 15)}
                                </span>
                            )}
                        </div>
                        <div className="legend-value">
                            {segment.allocation.toFixed(1)}%
                        </div>
                    </div>
                ))}
                {segments.length > 6 && (
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        textAlign: 'center'
                    }}>
                        他 {segments.length - 6} 銘柄
                    </div>
                )}
            </div>
        </div>
    );
}

export default PortfolioAllocation;
