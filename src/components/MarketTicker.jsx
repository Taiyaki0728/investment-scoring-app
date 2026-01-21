
import React from 'react';

const MarketTicker = () => {
    // 静的なダミーデータ（将来的にはAPIから取得）
    const markets = [
        { name: '🇺🇸 S&P 500', value: '4,783.45', change: '+1.23%', isUp: true },
        { name: '🇺🇸 NASDAQ', value: '15,055.65', change: '+1.70%', isUp: true },
        { name: '🇺🇸 US 10Y', value: '3.98%', change: '-0.05%', isUp: false },
        { name: '🇯🇵 日経平均', value: '34,450.20', change: '+2.10%', isUp: true },
        { name: '🥇 Gold', value: '$2,045.30', change: '+0.45%', isUp: true },
        { name: '₿ Bitcoin', value: '$46,500.00', change: '-1.20%', isUp: false },
        { name: '💱 USD/JPY', value: '144.50', change: '+0.30%', isUp: true },
    ];

    return (
        <div style={{
            background: 'rgba(17, 24, 39, 0.95)',
            borderBottom: '1px solid var(--glass-border)',
            padding: '8px 0',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            position: 'relative',
            zIndex: 90
        }}>
            <div style={{
                display: 'inline-block',
                animation: 'ticker 30s linear infinite',
                paddingLeft: '100%'
            }}>
                {markets.map((m, i) => (
                    <span key={i} style={{
                        marginRight: '48px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: '600'
                    }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{m.value}</span>
                        <span style={{
                            color: m.isUp ? 'var(--score-excellent)' : 'var(--score-poor)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                        }}>
                            {m.isUp ? '▲' : '▼'} {m.change}
                        </span>
                    </span>
                ))}
            </div>
            <style>{`
                @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
        </div>
    );
};

export default MarketTicker;
