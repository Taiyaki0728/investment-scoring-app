import React, { useMemo } from 'react';
import ScoreCircle from './ScoreCircle';
import FactorBreakdown from './FactorBreakdown';
import { generateAiInsight } from '../lib/scoreNarrator';

function AssetDetail({ asset, onClose }) {
    if (!asset) return null;

    const {
        symbol,
        name,
        type,
        sector,
        market,
        totalScore,
        factors,
        weights,
        category,
        priceChange,
        currentPrice,
        rawData,
        recommendation,
        nisa
    } = asset;

    // AIインサイトの生成
    const aiInsight = useMemo(() => generateAiInsight(asset), [asset]);

    // 推奨アクションのスタイル
    const getActionStyle = () => {
        switch (recommendation) {
            case 'BUY_STRONG':
                return { bg: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', label: '強力買い推奨 🚀' };
            case 'BUY':
                return { bg: 'rgba(132, 204, 22, 0.1)', border: '1px solid rgba(132, 204, 22, 0.3)', color: '#84cc16', label: '買い推奨 ✅' };
            case 'HOLD':
                return { bg: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', label: '保有継続 🔄' };
            case 'WATCH':
                return { bg: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#f97316', label: '要注意 ⚠️' };
            case 'SELL':
                return { bg: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', label: '売却推奨 📉' };
            case 'SELL_STRONG':
                return { bg: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)', color: '#dc2626', label: '即時売却推奨 🚨' };
            default:
                return { bg: 'rgba(107, 114, 128, 0.1)', border: '1px solid rgba(107, 114, 128, 0.3)', color: '#6b7280', label: '評価中' };
        }
    };

    const actionStyle = getActionStyle();

    // 詳細指標
    const getDetailMetrics = () => {
        const metrics = [];

        if (rawData?.fundamental) {
            const f = rawData.fundamental;
            metrics.push(
                { label: 'PER', value: f.per?.toFixed(1) || '-', category: 'fundamental' },
                { label: 'PBR', value: f.pbr?.toFixed(2) || '-', category: 'fundamental' },
                { label: 'ROE', value: `${f.roe?.toFixed(1)}%` || '-', category: 'fundamental' },
                { label: '売上成長率', value: `${f.revenueGrowth?.toFixed(1)}%` || '-', category: 'fundamental' },
            );
        }

        if (rawData?.technical) {
            const t = rawData.technical;
            metrics.push(
                { label: 'RSI', value: t.rsi?.toFixed(1) || '-', category: 'technical' },
                { label: 'MACD', value: t.macdLine?.toFixed(2) || '-', category: 'technical' },
            );
        }

        if (rawData?.momentum) {
            const m = rawData.momentum;
            metrics.push(
                { label: '1ヶ月リターン', value: `${m.oneMonthReturn?.toFixed(1)}%` || '-', category: 'momentum' },
                { label: '3ヶ月リターン', value: `${m.threeMonthReturn?.toFixed(1)}%` || '-', category: 'momentum' },
            );
        }

        if (rawData?.risk) {
            const r = rawData.risk;
            metrics.push(
                { label: 'ボラティリティ', value: `${r.volatility?.toFixed(1)}%` || '-', category: 'risk' },
                { label: 'シャープレシオ', value: r.sharpeRatio?.toFixed(2) || '-', category: 'risk' },
            );
        }

        return metrics;
    };

    const metrics = getDetailMetrics();

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(12px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                className="card custom-scrollbar"
                style={{
                    maxWidth: '900px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    padding: '32px'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '32px',
                    paddingBottom: '24px',
                    borderBottom: '1px solid var(--glass-border)'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                fontWeight: 'bold',
                                color: 'var(--text-primary)'
                            }}>
                                {symbol}
                            </div>
                            <div>
                                <h2 style={{ fontSize: '32px', fontWeight: 'bold', lineHeight: 1.2 }}>{symbol}</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>{name}</p>
                            </div>
                            <span style={{
                                fontSize: '13px',
                                padding: '6px 16px',
                                borderRadius: '999px',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                marginLeft: '12px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                {market === 'US' ? '🇺🇸 米国株' : market === 'JP' ? '🇯🇵 日本株' : type === 'gold' ? '🥇 金' : '📈 ETF'}
                            </span>
                        </div>

                        {/* NISA Badges */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            {nisa?.isGrowth && (
                                <span style={{
                                    fontSize: '11px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 5px rgba(16, 185, 129, 0.3)'
                                }}>
                                    🌱 新NISA 成長投資枠
                                </span>
                            )}
                            {nisa?.isTsumitate && (
                                <span style={{
                                    fontSize: '11px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: 'linear-gradient(90deg, #db2777 0%, #ec4899 100%)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 5px rgba(236, 72, 153, 0.3)'
                                }}>
                                    💰 新NISA つみたて枠
                                </span>
                            )}
                        </div>

                        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '2px' }}>{sector}</p>
                    </div>
                    <button
                        className="btn-icon"
                        onClick={onClose}
                        style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                    >
                        ✕
                    </button>
                </div>

                {/* メイングリッド */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 320px) 1fr',
                    gap: '40px',
                    alignItems: 'start',
                }}>
                    {/* 左側: スコアサマリー */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{
                            background: 'var(--bg-tertiary)',
                            borderRadius: '24px',
                            padding: '32px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            border: '1px solid var(--glass-border)',
                            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.2)'
                        }}>
                            <ScoreCircle score={totalScore} size={180} label="投資スコア" />

                            <div style={{
                                marginTop: '24px',
                                padding: '12px 24px',
                                borderRadius: '999px',
                                background: actionStyle.bg,
                                border: actionStyle.border,
                                color: actionStyle.color,
                                fontWeight: 'bold',
                                fontSize: '16px',
                                letterSpacing: '0.5px'
                            }}>
                                {actionStyle.label}
                            </div>
                        </div>

                        <div style={{
                            background: 'var(--bg-tertiary)',
                            borderRadius: '16px',
                            padding: '24px',
                            border: '1px solid var(--glass-border)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>現在価格</span>
                                <span style={{ fontWeight: 'bold', fontSize: '18px' }}>${currentPrice?.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>前日比</span>
                                <span style={{
                                    fontWeight: 'bold',
                                    fontSize: '18px',
                                    color: priceChange >= 0 ? 'var(--score-excellent)' : 'var(--score-poor)'
                                }}>
                                    {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange)?.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 右側: AI分析と詳細 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                        {/* 🧠 AI Insight Section */}
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.1) 0%, rgba(30, 41, 59, 0) 100%)',
                            borderRadius: '16px',
                            padding: '24px',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            position: 'relative'
                        }}>
                            <h3 style={{
                                fontSize: '18px',
                                marginBottom: '16px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#60a5fa'
                            }}>
                                🧠 AI Analyst Insight
                            </h3>
                            <div style={{
                                lineHeight: '1.8',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {aiInsight}
                            </div>
                        </div>

                        {/* ファクター分析 */}
                        <div>
                            <h3 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📊 ファクタースコア詳細
                            </h3>
                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '16px', padding: '24px', border: '1px solid var(--glass-border)' }}>
                                <FactorBreakdown factors={factors} weights={weights} />
                            </div>
                        </div>

                        {/* 主要指標 */}
                        <div>
                            <h3 style={{ fontSize: '18px', marginBottom: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📉 主要テクニカル・ファンダメンタル指標
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                gap: '16px',
                            }}>
                                {metrics.map((metric, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            padding: '16px',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: '12px',
                                            textAlign: 'center',
                                            border: '1px solid var(--glass-border)',
                                            transition: 'transform 0.2s',
                                            ':hover': { transform: 'translateY(-2px)' }
                                        }}
                                    >
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                            {metric.label}
                                        </div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                            {metric.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* フッターアクション */}
                <div style={{
                    marginTop: '40px',
                    paddingTop: '24px',
                    borderTop: '1px solid var(--glass-border)',
                    display: 'flex',
                    gap: '16px',
                    justifyContent: 'flex-end',
                }}>
                    <button className="btn btn-secondary">
                        📋 ウォッチリスト
                    </button>
                    <a
                        href={`https://finance.yahoo.com/quote/${symbol}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ textDecoration: 'none' }}
                    >
                        🌐 Yahoo Financeで見る
                    </a>
                    <button className="btn btn-primary" style={{ padding: '12px 32px' }}>
                        💼 トレード画面へ
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AssetDetail;
