import React from 'react';

function FactorBreakdown({ factors, weights }) {
    const factorConfig = [
        { key: 'fundamental', label: 'ファンダメンタル', color: '#3b82f6' },
        { key: 'technical', label: 'テクニカル', color: '#8b5cf6' },
        { key: 'momentum', label: 'モメンタム', color: '#06b6d4' },
        { key: 'sentiment', label: 'センチメント', color: '#ec4899' },
        { key: 'risk', label: 'リスク', color: '#fbbf24' },
    ];

    return (
        <div className="factor-breakdown">
            {factorConfig.map(({ key, label, color }) => {
                const value = factors?.[key] ?? 0;
                const weight = weights?.[key] ?? 0.2;

                return (
                    <div key={key} className="factor-item">
                        <div className="factor-label">
                            {label}
                            <span style={{
                                fontSize: '10px',
                                color: 'var(--text-tertiary)',
                                marginLeft: '4px'
                            }}>
                                ({Math.round(weight * 100)}%)
                            </span>
                        </div>
                        <div className="factor-bar-container">
                            <div
                                className={`factor-bar ${key}`}
                                style={{
                                    width: `${value}%`,
                                    background: color,
                                    boxShadow: `0 0 10px ${color}40`,
                                }}
                            />
                        </div>
                        <div className="factor-value" style={{ color }}>
                            {value}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default FactorBreakdown;
