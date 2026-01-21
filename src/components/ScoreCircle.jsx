import React from 'react';

function ScoreCircle({ score, size = 180, label = 'スコア' }) {
    // スコアに基づく色クラスを取得
    const getColorClass = (score) => {
        if (score >= 80) return 'excellent';
        if (score >= 65) return 'good';
        if (score >= 50) return 'neutral';
        if (score >= 35) return 'warning';
        if (score >= 20) return 'poor';
        return 'critical';
    };

    const colorClass = getColorClass(score);

    // SVGのパラメータ
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const offset = circumference - progress;

    // スコアに対応する色
    const colors = {
        excellent: '#10b981',
        good: '#84cc16',
        neutral: '#f59e0b',
        warning: '#f97316',
        poor: '#ef4444',
        critical: '#dc2626',
    };

    return (
        <div className="score-display">
            <div className="score-circle" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {/* 背景の円 */}
                    <circle
                        className="score-circle-bg"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                    />
                    {/* プログレスの円 */}
                    <circle
                        className={`score-circle-progress ${colorClass}`}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{
                            filter: `drop-shadow(0 0 8px ${colors[colorClass]}40)`,
                        }}
                    />
                </svg>
                <div className="score-value">
                    <div
                        className="score-number"
                        style={{ color: colors[colorClass] }}
                    >
                        {score}
                    </div>
                    <div className="score-label">{label}</div>
                </div>
            </div>
        </div>
    );
}

export default ScoreCircle;
