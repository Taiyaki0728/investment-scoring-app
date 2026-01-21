/**
 * InvestScore Pro - スコアリングエンジン
 * 
 * マルチファクタースコアリングシステムのコアロジック
 */

// スコアカテゴリの定義
export const SCORE_CATEGORIES = {
    EXCELLENT: { min: 80, max: 100, label: '強力買い', color: 'excellent', action: 'BUY_STRONG' },
    GOOD: { min: 65, max: 79, label: '買い', color: 'good', action: 'BUY' },
    NEUTRAL: { min: 50, max: 64, label: '保有', color: 'neutral', action: 'HOLD' },
    WARNING: { min: 35, max: 49, label: '注意', color: 'warning', action: 'WATCH' },
    POOR: { min: 20, max: 34, label: '売り', color: 'poor', action: 'SELL' },
    CRITICAL: { min: 0, max: 19, label: '強力売り', color: 'critical', action: 'SELL_STRONG' },
};

// デフォルト重み付け (リアルデータ取得最適化版)
// Yahoo Finance等の無料APIではファンダメンタル・センチメント情報の取得が難しいため、
// 価格データから確実に算出可能なテクニカル・モメンタム・リスク指標を重視する設定に変更。
export const DEFAULT_WEIGHTS = {
    fundamental: 0.05, // データ不足のため影響度を下げる
    technical: 0.45,   // 価格から正確に計算可能
    momentum: 0.30,    // トレンド追従を重視
    sentiment: 0.05,   // データ不足のため影響度を下げる
    risk: 0.15,        // ボラティリティ等の管理
};

// 資産クラス別重み付け
export const ASSET_CLASS_WEIGHTS = {
    stock: DEFAULT_WEIGHTS,
    gold: {
        fundamental: 0.00,
        technical: 0.50,
        momentum: 0.30,
        sentiment: 0.05,
        risk: 0.15,
    },
    etf: {
        fundamental: 0.05,
        technical: 0.40,
        momentum: 0.40, // ETFはトレンドが出やすいためモメンタム重視
        sentiment: 0.00,
        risk: 0.15,
    },
};

/**
 * 値を0-100の範囲に正規化
 */
export function normalizeScore(value, min, max, isInverse = false) {
    if (max === min) return 50;
    const normalized = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    return isInverse ? 100 - normalized : normalized;
}

/**
 * スコアからカテゴリを取得
 */
export function getScoreCategory(score) {
    for (const [key, category] of Object.entries(SCORE_CATEGORIES)) {
        if (score >= category.min && score <= category.max) {
            return { key, ...category };
        }
    }
    return SCORE_CATEGORIES.NEUTRAL;
}

// ============================
// ファンダメンタル分析
// ============================

/**
 * PERスコアリング
 */
export function scorePER(per, industryAvgPER = 20) {
    if (per <= 0) return 50; // 赤字企業
    const ratio = per / industryAvgPER;

    if (ratio < 0.5) return 100;
    if (ratio < 0.75) return 85;
    if (ratio < 1.0) return 70;
    if (ratio < 1.25) return 55;
    if (ratio < 1.5) return 40;
    if (ratio < 2.0) return 25;
    return 10;
}

/**
 * PBRスコアリング
 */
export function scorePBR(pbr) {
    if (pbr < 0) return 30;
    if (pbr < 0.5) return 90;
    if (pbr < 1.0) return 80;
    if (pbr < 1.5) return 65;
    if (pbr < 2.0) return 50;
    if (pbr < 3.0) return 35;
    return 20;
}

/**
 * ROEスコアリング
 */
export function scoreROE(roe) {
    if (roe < 0) return 10;
    if (roe >= 25) return 100;
    if (roe >= 20) return 90;
    if (roe >= 15) return 75;
    if (roe >= 10) return 60;
    if (roe >= 5) return 45;
    return 30;
}

/**
 * 売上成長率スコアリング
 */
export function scoreRevenueGrowth(growth) {
    if (growth >= 30) return 100;
    if (growth >= 20) return 85;
    if (growth >= 10) return 70;
    if (growth >= 5) return 55;
    if (growth >= 0) return 40;
    if (growth >= -10) return 25;
    return 10;
}

/**
 * 負債比率スコアリング（低いほど良い）
 */
export function scoreDebtRatio(ratio) {
    if (ratio < 0.3) return 100;
    if (ratio < 0.5) return 85;
    if (ratio < 0.7) return 70;
    if (ratio < 1.0) return 55;
    if (ratio < 1.5) return 40;
    if (ratio < 2.0) return 25;
    return 10;
}

/**
 * 配当利回りスコアリング
 */
export function scoreDividendYield(yield_) {
    if (yield_ >= 6) return 60; // 高すぎる配当は警戒
    if (yield_ >= 4) return 90;
    if (yield_ >= 3) return 100;
    if (yield_ >= 2) return 85;
    if (yield_ >= 1) return 70;
    if (yield_ > 0) return 50;
    return 40;
}

/**
 * ファンダメンタルスコアを計算
 */
export function calculateFundamentalScore(data) {
    const {
        per = 20,
        pbr = 1.5,
        roe = 10,
        revenueGrowth = 5,
        debtRatio = 0.5,
        dividendYield = 2,
        industryAvgPER = 20,
    } = data;

    const perScore = scorePER(per, industryAvgPER) * 0.15;
    const pbrScore = scorePBR(pbr) * 0.10;
    const roeScore = scoreROE(roe) * 0.20;
    const growthScore = scoreRevenueGrowth(revenueGrowth) * 0.25;
    const debtScore = scoreDebtRatio(debtRatio) * 0.15;
    const divScore = scoreDividendYield(dividendYield) * 0.15;

    return Math.round(perScore + pbrScore + roeScore + growthScore + debtScore + divScore);
}

// ============================
// テクニカル分析
// ============================

/**
 * RSIスコアリング
 */
export function scoreRSI(rsi) {
    if (rsi <= 20) return 90; // 極度の売られすぎ = 買いチャンス
    if (rsi <= 30) return 80;
    if (rsi <= 40) return 65;
    if (rsi <= 60) return 50; // 中立
    if (rsi <= 70) return 35;
    if (rsi <= 80) return 20;
    return 10; // 極度の買われすぎ
}

/**
 * MACDスコアリング
 */
export function scoreMACD(macdLine, signalLine, histogram, prevHistogram = null) {
    let score = 50;

    // MACDラインがシグナルラインの上
    if (macdLine > signalLine) {
        score += 20;
    } else {
        score -= 20;
    }

    // ヒストグラムが増加中
    if (prevHistogram !== null) {
        if (histogram > prevHistogram) {
            score += 15;
        } else {
            score -= 10;
        }
    }

    // ゴールデンクロス検出（簡易版）
    if (macdLine > 0 && signalLine < 0) {
        score += 15;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * 移動平均クロススコアリング
 */
export function scoreMovingAverageCross(shortMA, longMA, price) {
    let score = 50;

    // 短期MAが長期MAより上 = 上昇トレンド
    if (shortMA > longMA) {
        score += 25;
    } else {
        score -= 25;
    }

    // 価格が両MAより上
    if (price > shortMA && price > longMA) {
        score += 15;
    } else if (price < shortMA && price < longMA) {
        score -= 15;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * ボリンジャーバンドスコアリング
 */
export function scoreBollingerBand(price, upper, middle, lower) {
    const range = upper - lower;
    if (range === 0) return 50;

    const position = (price - lower) / range;

    if (position <= 0.1) return 90; // 下限付近 = 買いチャンス
    if (position <= 0.3) return 75;
    if (position <= 0.5) return 55;
    if (position <= 0.7) return 45;
    if (position <= 0.9) return 30;
    return 15; // 上限付近 = 売りシグナル
}

/**
 * テクニカルスコアを計算
 */
export function calculateTechnicalScore(data) {
    const {
        rsi = 50,
        macdLine = 0,
        signalLine = 0,
        histogram = 0,
        shortMA = 0,
        longMA = 0,
        price = 0,
        bbUpper = 0,
        bbMiddle = 0,
        bbLower = 0,
    } = data;

    const rsiScore = scoreRSI(rsi) * 0.25;
    const macdScore = scoreMACD(macdLine, signalLine, histogram) * 0.25;
    const maScore = scoreMovingAverageCross(shortMA, longMA, price) * 0.25;
    const bbScore = scoreBollingerBand(price, bbUpper, bbMiddle, bbLower) * 0.25;

    return Math.round(rsiScore + macdScore + maScore + bbScore);
}

// ============================
// モメンタム分析
// ============================

/**
 * リターンを正規化しスコア化
 */
function normalizeReturn(returnPct, minExpected, maxExpected) {
    const score = ((returnPct - minExpected) / (maxExpected - minExpected)) * 100;
    return Math.max(0, Math.min(100, score));
}

/**
 * モメンタムスコアを計算
 */
export function calculateMomentumScore(data) {
    const {
        oneMonthReturn = 0,
        threeMonthReturn = 0,
        sixMonthReturn = 0,
        relativeStrength = 0,
    } = data;

    const score1M = normalizeReturn(oneMonthReturn, -10, 20) * 0.25;
    const score3M = normalizeReturn(threeMonthReturn, -20, 40) * 0.30;
    const score6M = normalizeReturn(sixMonthReturn, -30, 60) * 0.25;
    const scoreRS = normalizeReturn(relativeStrength, -15, 15) * 0.20;

    return Math.round(score1M + score3M + score6M + scoreRS);
}

// ============================
// センチメント分析
// ============================

/**
 * センチメントスコアを計算
 */
export function calculateSentimentScore(data) {
    const {
        newsScore = 50,        // 0-100 (ニュースの感情分析)
        analystRating = 3,     // 1-5 (1=Strong Sell, 5=Strong Buy)
        epsRevision = 0,       // パーセンテージ
        socialScore = 50,      // 0-100 (ソーシャルメディア感情)
    } = data;

    // アナリスト評価を0-100に変換
    const analystScore = ((analystRating - 1) / 4) * 100;

    // EPS修正を0-100に変換
    const epsScore = normalizeReturn(epsRevision, -20, 20);

    return Math.round(
        newsScore * 0.30 +
        analystScore * 0.25 +
        epsScore * 0.25 +
        socialScore * 0.20
    );
}

// ============================
// リスク分析
// ============================

/**
 * リスクスコアを計算（リスクが低いほど高スコア）
 */
export function calculateRiskScore(data) {
    const {
        volatility = 20,      // 年率ボラティリティ（%）
        beta = 1.0,           // 市場ベータ
        maxDrawdown = -20,    // 最大ドローダウン（%、負の値）
        sharpeRatio = 1.0,    // シャープレシオ
    } = data;

    // ボラティリティスコア（20%以下が理想）
    const volScore = Math.max(0, 100 - (volatility / 50) * 100);

    // ベータスコア（1.0に近いほど良い）
    const betaScore = Math.max(0, 100 - Math.abs(beta - 1.0) * 50);

    // ドローダウンスコア（小さいほど良い）
    const ddScore = Math.max(0, 100 - Math.abs(maxDrawdown) * 2);

    // シャープレシオスコア（2.0以上が優秀）
    const sharpeScore = Math.min(100, (sharpeRatio + 1) * 33.33);

    return Math.round(
        volScore * 0.30 +
        betaScore * 0.25 +
        ddScore * 0.25 +
        sharpeScore * 0.20
    );
}

// ============================
// 総合スコア計算
// ============================

/**
 * 全てのファクターから総合スコアを計算
 */
export function calculateTotalScore(factors, weights = DEFAULT_WEIGHTS) {
    const {
        fundamental = 50,
        technical = 50,
        momentum = 50,
        sentiment = 50,
        risk = 50,
    } = factors;

    const totalScore =
        fundamental * weights.fundamental +
        technical * weights.technical +
        momentum * weights.momentum +
        sentiment * weights.sentiment +
        risk * weights.risk;

    return Math.round(totalScore);
}

/**
 * 資産の完全なスコアリングを実行
 */
export function scoreAsset(assetData, assetType = 'stock') {
    const weights = ASSET_CLASS_WEIGHTS[assetType] || DEFAULT_WEIGHTS;

    const factors = {
        fundamental: assetType === 'gold' ? 0 : calculateFundamentalScore(assetData.fundamental || {}),
        technical: calculateTechnicalScore(assetData.technical || {}),
        momentum: calculateMomentumScore(assetData.momentum || {}),
        sentiment: calculateSentimentScore(assetData.sentiment || {}),
        risk: calculateRiskScore(assetData.risk || {}),
    };

    const totalScore = calculateTotalScore(factors, weights);
    const category = getScoreCategory(totalScore);

    return {
        totalScore,
        factors,
        category,
        weights,
        recommendation: category.action,
        timestamp: new Date().toISOString(),
    };
}

// ============================
// ポートフォリオ配分
// ============================

const ALLOCATION_CONSTRAINTS = {
    MAX_SINGLE_ASSET: 25,
    MIN_SINGLE_ASSET: 2,
    MAX_SECTOR_CONCENTRATION: 40,
    MIN_ASSET_COUNT: 5,
    CASH_RESERVE: 5,
};

/**
 * リスク許容度に基づく乗数を取得
 */
function getRiskMultiplier(riskScore, tolerance) {
    const multipliers = {
        conservative: riskScore >= 70 ? 1.3 : riskScore >= 50 ? 1.0 : 0.7,
        moderate: 1.0,
        aggressive: riskScore >= 70 ? 0.8 : riskScore >= 50 ? 1.0 : 1.3,
    };
    return multipliers[tolerance] || 1.0;
}

/**
 * スコアに基づいてポートフォリオ配分を計算
 */
export function calculatePortfolioAllocation(assets, riskTolerance = 'moderate') {
    // スコア50以上の資産のみを保有対象とする
    const holdableAssets = assets.filter(a => a.totalScore >= 50);

    if (holdableAssets.length === 0) {
        return {
            allocations: [],
            cashReserve: 100,
            message: 'スコアが50以上の資産がありません。現金保有を推奨します。',
        };
    }

    // スコアを重みに変換
    const weights = holdableAssets.map(asset => {
        const baseWeight = asset.totalScore / 100;
        const riskMultiplier = getRiskMultiplier(
            asset.factors?.risk || 50,
            riskTolerance
        );

        return {
            ...asset,
            rawWeight: baseWeight * riskMultiplier,
        };
    });

    // 現金を除いた配分可能な比率
    const allocatablePercent = 100 - ALLOCATION_CONSTRAINTS.CASH_RESERVE;

    // 正規化
    const totalWeight = weights.reduce((sum, w) => sum + w.rawWeight, 0);

    let allocations = weights.map(w => {
        let allocation = (w.rawWeight / totalWeight) * allocatablePercent;

        // 制約条件の適用
        allocation = Math.min(allocation, ALLOCATION_CONSTRAINTS.MAX_SINGLE_ASSET);
        allocation = Math.max(allocation, ALLOCATION_CONSTRAINTS.MIN_SINGLE_ASSET);

        return {
            symbol: w.symbol,
            name: w.name,
            allocation: Math.round(allocation * 10) / 10,
            totalScore: w.totalScore,
            category: w.category,
        };
    });

    // 再正規化（合計が配分可能比率になるように）
    const currentTotal = allocations.reduce((sum, a) => sum + a.allocation, 0);
    const adjustmentFactor = allocatablePercent / currentTotal;

    allocations = allocations.map(a => ({
        ...a,
        allocation: Math.round(a.allocation * adjustmentFactor * 10) / 10,
    }));

    return {
        allocations,
        cashReserve: ALLOCATION_CONSTRAINTS.CASH_RESERVE,
        totalAssets: allocations.length,
        riskTolerance,
    };
}
