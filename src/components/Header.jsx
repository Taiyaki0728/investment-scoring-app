import React, { useState } from 'react';

function Header({ onRefresh, onNavigate, currentPage }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleNavigate = (page) => {
        onNavigate?.(page);
        setMobileMenuOpen(false);
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="logo" onClick={() => handleNavigate('dashboard')} style={{ cursor: 'pointer' }}>
                    <div className="logo-icon">📊</div>
                    <span className="logo-text">InvestScore Pro</span>
                </div>

                {/* Desktop Navigation */}
                <nav className="header-nav desktop-nav">
                    <a
                        href="#dashboard"
                        className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleNavigate('dashboard'); }}
                    >
                        🏠 ダッシュボード
                    </a>
                    <a
                        href="#simulator"
                        className={`nav-link ${currentPage === 'simulator' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleNavigate('simulator'); }}
                    >
                        🤖 シミュレーター
                    </a>
                    <a
                        href="#backtest"
                        className={`nav-link ${currentPage === 'backtest' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleNavigate('backtest'); }}
                    >
                        📈 バックテスト
                    </a>
                </nav>

                <div className="header-actions">
                    <div className="live-indicator">
                        <span className="live-dot"></span>
                        <span className="live-text">リアルタイム更新中</span>
                    </div>
                    <button className="btn btn-primary desktop-only" onClick={onRefresh}>
                        🔄 データ更新
                    </button>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="mobile-menu-toggle"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="メニュー"
                    >
                        <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
                <a
                    href="#dashboard"
                    className={`mobile-nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); handleNavigate('dashboard'); }}
                >
                    🏠 ダッシュボード
                </a>
                <a
                    href="#simulator"
                    className={`mobile-nav-link ${currentPage === 'simulator' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); handleNavigate('simulator'); }}
                >
                    🤖 自動売買シミュレーター
                </a>
                <a
                    href="#backtest"
                    className={`mobile-nav-link ${currentPage === 'backtest' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); handleNavigate('backtest'); }}
                >
                    📈 バックテスト
                </a>
                <button className="btn btn-primary mobile-refresh" onClick={() => { onRefresh(); setMobileMenuOpen(false); }}>
                    🔄 データ更新
                </button>
            </nav>
        </header>
    );
}

export default Header;

