# 投資スコアリングアルゴリズム設計書

## 📊 概要

本ドキュメントでは、米国株・日本株・金などの資産クラスを対象とした**マルチファクタースコアリングシステム**のアルゴリズム設計を定義します。

### 設計目標
- 各銘柄に0-100の総合スコアを付与
- 保有/売却/購入の判断を自動化
- ポートフォリオの最適配分を算出
- リアルタイムでスコアを更新

---

## 🎯 スコアリングフレームワーク

### 総合スコア計算式

```
総合スコア = (ファンダメンタルスコア × W1) + (テクニカルスコア × W2) + (モメンタムスコア × W3) + (センチメントスコア × W4) + (リスクスコア × W5)
```

#### デフォルト重み付け
| ファクター | 記号 | デフォルト重み | 説明 |
|------------|------|----------------|------|
| ファンダメンタル | W1 | 25% | 企業の本質的価値 |
| テクニカル | W2 | 25% | 価格チャートパターン |
| モメンタム | W3 | 20% | 価格上昇の勢い |
| センチメント | W4 | 15% | 市場・投資家心理 |
| リスク | W5 | 15% | ボラティリティリスク（逆相関） |

> ⚙️ 重み付けはユーザーがカスタマイズ可能

---

## 📈 ファクター詳細設計

### 1️⃣ ファンダメンタルスコア (0-100)

企業の財務健全性と成長性を評価します。

#### 評価指標

| 指標 | 計算方法 | 重み | スコアリング基準 |
|------|----------|------|------------------|
| **PER (株価収益率)** | 株価 / EPS | 15% | 業界平均比で低いほど高スコア |
| **PBR (株価純資産倍率)** | 株価 / BPS | 10% | 1.0未満で高スコア、3.0超で低スコア |
| **ROE (自己資本利益率)** | 純利益 / 自己資本 | 15% | 15%以上で高スコア |
| **ROA (総資産利益率)** | 純利益 / 総資産 | 10% | 5%以上で高スコア |
| **売上成長率** | (今期売上 - 前期売上) / 前期売上 | 15% | 10%以上で高スコア |
| **EPS成長率** | (今期EPS - 前期EPS) / 前期EPS | 15% | 正の成長で高スコア |
| **負債比率** | 負債 / 自己資本 | 10% | 低いほど高スコア |
| **配当利回り** | 年間配当 / 株価 | 10% | 2-4%で最高スコア |

#### スコア正規化関数

```javascript
function normalizeScore(value, min, max, isInverse = false) {
  const normalized = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return isInverse ? 100 - normalized : normalized;
}
```

#### PERスコアリング例

```javascript
function scorePER(per, industryAvgPER) {
  const ratio = per / industryAvgPER;
  
  if (ratio < 0.5) return 100;    // 割安
  if (ratio < 0.75) return 85;
  if (ratio < 1.0) return 70;
  if (ratio < 1.25) return 55;
  if (ratio < 1.5) return 40;
  if (ratio < 2.0) return 25;
  return 10;                       // 割高
}
```

---

### 2️⃣ テクニカルスコア (0-100)

チャートパターンとテクニカル指標を分析します。

#### 評価指標

| 指標 | 説明 | 重み | スコアリング基準 |
|------|------|------|------------------|
| **RSI (相対力指数)** | 買われすぎ/売られすぎ | 20% | 30-70が中立、30以下で買いシグナル |
| **MACD** | トレンド転換 | 20% | ゴールデンクロスで高スコア |
| **移動平均クロス** | 短期/長期MA | 15% | 短期 > 長期で上昇トレンド |
| **ボリンジャーバンド** | 価格の位置 | 15% | 下限付近で高スコア |
| **出来高トレンド** | OBV | 15% | 増加トレンドで高スコア |
| **価格位置 (52週)** | 現在価格の相対位置 | 15% | 中間付近が最適 |

#### RSIスコアリング

```javascript
function scoreRSI(rsi) {
  // 過剰売られ = 買いチャンス
  if (rsi <= 20) return 90;
  if (rsi <= 30) return 80;
  if (rsi <= 40) return 65;
  if (rsi <= 60) return 50;  // 中立
  if (rsi <= 70) return 35;
  if (rsi <= 80) return 20;
  return 10;  // 過剰買われ
}
```

#### MACDスコアリング

```javascript
function scoreMACD(macdLine, signalLine, histogram, prevHistogram) {
  let score = 50; // ベーススコア
  
  // MACDラインがシグナルラインの上
  if (macdLine > signalLine) score += 20;
  else score -= 20;
  
  // ヒストグラムが増加中（勢い増加）
  if (histogram > prevHistogram) score += 15;
  else score -= 10;
  
  // ゴールデンクロス検出
  if (prevSignalLine > prevMacdLine && macdLine > signalLine) {
    score += 25; // ボーナス
  }
  
  return Math.max(0, Math.min(100, score));
}
```

---

### 3️⃣ モメンタムスコア (0-100)

価格上昇の勢いと持続性を評価します。

#### 評価指標

| 指標 | 計算方法 | 重み | 説明 |
|------|----------|------|------|
| **1ヶ月リターン** | (現在価格 - 1M前価格) / 1M前価格 | 25% | 短期モメンタム |
| **3ヶ月リターン** | (現在価格 - 3M前価格) / 3M前価格 | 30% | 中期モメンタム |
| **6ヶ月リターン** | (現在価格 - 6M前価格) / 6M前価格 | 25% | 長期モメンタム |
| **相対強度** | ベンチマーク比パフォーマンス | 20% | 市場比較 |

#### モメンタムスコア計算

```javascript
function calculateMomentumScore(returns) {
  const { oneMonth, threeMonth, sixMonth, relativeStrength } = returns;
  
  const scoreOneMonth = normalizeReturn(oneMonth, -10, 20);
  const scoreThreeMonth = normalizeReturn(threeMonth, -20, 40);
  const scoreSixMonth = normalizeReturn(sixMonth, -30, 60);
  const scoreRelative = normalizeReturn(relativeStrength, -15, 15);
  
  return (
    scoreOneMonth * 0.25 +
    scoreThreeMonth * 0.30 +
    scoreSixMonth * 0.25 +
    scoreRelative * 0.20
  );
}

function normalizeReturn(returnPct, minExpected, maxExpected) {
  const score = ((returnPct - minExpected) / (maxExpected - minExpected)) * 100;
  return Math.max(0, Math.min(100, score));
}
```

---

### 4️⃣ センチメントスコア (0-100)

市場心理とニュース分析を統合します。

#### 評価指標

| 指標 | データソース | 重み | 説明 |
|------|-------------|------|------|
| **ニュースセンチメント** | ニュースAPI | 30% | 記事の感情分析 |
| **アナリスト評価** | 証券会社レーティング | 25% | Buy/Hold/Sell |
| **EPS予想修正** | アナリスト予想 | 25% | 上方修正で高スコア |
| **ソーシャルメディア** | Twitter/Reddit | 20% | 言及量と感情 |

#### センチメントスコア計算

```javascript
function calculateSentimentScore(data) {
  const { newsScore, analystRating, epsRevision, socialScore } = data;
  
  // アナリスト評価の変換 (1=Strong Sell, 5=Strong Buy)
  const analystScore = ((analystRating - 1) / 4) * 100;
  
  // EPS修正の変換
  const epsScore = normalizeReturn(epsRevision, -20, 20);
  
  return (
    newsScore * 0.30 +
    analystScore * 0.25 +
    epsScore * 0.25 +
    socialScore * 0.20
  );
}
```

---

### 5️⃣ リスクスコア (0-100)

リスクが低いほど高スコア（逆相関）。

#### 評価指標

| 指標 | 計算方法 | 重み | 説明 |
|------|----------|------|------|
| **ボラティリティ** | 年率標準偏差 | 30% | 低いほど高スコア |
| **ベータ** | 市場感応度 | 25% | 1.0に近いほど高スコア |
| **最大ドローダウン** | 高値からの最大下落率 | 25% | 小さいほど高スコア |
| **シャープレシオ** | リターン / リスク | 20% | 高いほど高スコア |

#### リスクスコア計算

```javascript
function calculateRiskScore(data) {
  const { volatility, beta, maxDrawdown, sharpeRatio } = data;
  
  // ボラティリティスコア（20%以下が理想）
  const volScore = Math.max(0, 100 - (volatility / 50) * 100);
  
  // ベータスコア（1.0に近いほど良い）
  const betaScore = 100 - Math.abs(beta - 1.0) * 50;
  
  // ドローダウンスコア（小さいほど良い）
  const ddScore = Math.max(0, 100 - Math.abs(maxDrawdown) * 2);
  
  // シャープレシオスコア（2.0以上が優秀）
  const sharpeScore = Math.min(100, (sharpeRatio + 1) * 33.33);
  
  return (
    volScore * 0.30 +
    betaScore * 0.25 +
    ddScore * 0.25 +
    sharpeScore * 0.20
  );
}
```

---

## 🏷️ 資産クラス別調整

異なる資産クラスには異なる評価基準を適用します。

### 株式 (米国株・日本株)

デフォルトの全ファクターを使用。

| ファクター | 重み |
|------------|------|
| ファンダメンタル | 25% |
| テクニカル | 25% |
| モメンタム | 20% |
| センチメント | 15% |
| リスク | 15% |

### 金・コモディティ

ファンダメンタル分析が適用不可のため、調整。

| ファクター | 重み | 調整理由 |
|------------|------|----------|
| ファンダメンタル | 0% | 財務指標なし |
| テクニカル | 35% | 価格パターン重視 |
| モメンタム | 30% | トレンド追従 |
| センチメント | 15% | インフレ期待等 |
| リスク | 20% | ボラティリティ管理 |

### ETF・インデックス

| ファクター | 重み | 調整理由 |
|------------|------|----------|
| ファンダメンタル | 15% | 構成銘柄の平均 |
| テクニカル | 25% | |
| モメンタム | 25% | |
| センチメント | 15% | |
| リスク | 20% | 分散投資済み |

---

## 📊 スコア解釈と行動推奨

### スコアレンジ

| スコア範囲 | ラベル | 行動推奨 | 色 |
|------------|--------|----------|-----|
| 80-100 | 🟢 **強力買い** | 積極的に購入 | 緑 |
| 65-79 | 🟡 **買い** | 購入検討 | 黄緑 |
| 50-64 | 🟠 **保有** | 維持 | オレンジ |
| 35-49 | 🟠 **注意** | 売却検討 | オレンジ |
| 20-34 | 🔴 **売り** | 売却推奨 | 赤 |
| 0-19 | 🔴 **強力売り** | 即時売却 | 濃い赤 |

### スコア変動アラート

```javascript
const ALERT_THRESHOLDS = {
  CRITICAL_DROP: -15,      // 15ポイント以上の急落
  SIGNIFICANT_DROP: -10,   // 10ポイント以上の下落
  SIGNIFICANT_RISE: 10,    // 10ポイント以上の上昇
  THRESHOLD_CROSS: true,   // 閾値（50点）を跨いだ場合
};
```

---

## 📈 ポートフォリオ配分アルゴリズム

### 配分計算式

スコアに基づく重み付け配分を行います。

```javascript
function calculateAllocation(assets, riskTolerance = 'moderate') {
  // 1. スコアでフィルタリング（保有対象は50点以上）
  const holdableAssets = assets.filter(a => a.totalScore >= 50);
  
  // 2. スコアを重みに変換
  const weights = holdableAssets.map(asset => {
    const baseWeight = asset.totalScore / 100;
    
    // リスク許容度による調整
    const riskMultiplier = getRiskMultiplier(asset.riskScore, riskTolerance);
    
    return {
      ...asset,
      rawWeight: baseWeight * riskMultiplier
    };
  });
  
  // 3. 正規化（合計100%に）
  const totalWeight = weights.reduce((sum, w) => sum + w.rawWeight, 0);
  
  return weights.map(w => ({
    ...w,
    allocation: (w.rawWeight / totalWeight) * 100
  }));
}

function getRiskMultiplier(riskScore, tolerance) {
  const multipliers = {
    conservative: riskScore >= 70 ? 1.3 : riskScore >= 50 ? 1.0 : 0.7,
    moderate: 1.0,
    aggressive: riskScore >= 70 ? 0.8 : riskScore >= 50 ? 1.0 : 1.3
  };
  return multipliers[tolerance];
}
```

### 配分制約条件

```javascript
const ALLOCATION_CONSTRAINTS = {
  MAX_SINGLE_ASSET: 25,      // 1銘柄最大25%
  MIN_SINGLE_ASSET: 2,       // 1銘柄最小2%
  MAX_SECTOR_CONCENTRATION: 40,  // セクター集中最大40%
  MIN_ASSET_COUNT: 5,        // 最小5銘柄
  CASH_RESERVE: 5,           // 現金比率5%維持
};
```

### リバランストリガー

```javascript
function shouldRebalance(portfolio) {
  const triggers = {
    // 配分が10%以上ズレた
    allocationDrift: portfolio.assets.some(a => 
      Math.abs(a.currentAllocation - a.targetAllocation) > 10
    ),
    // スコアが閾値を下回った
    scoreDrop: portfolio.assets.some(a => a.totalScore < 50),
    // 定期リバランス（月1回）
    periodic: daysSinceLastRebalance(portfolio) >= 30,
  };
  
  return Object.values(triggers).some(t => t);
}
```

---

## 🔄 データ更新頻度

| データ種別 | 更新頻度 | 理由 |
|------------|----------|------|
| 価格データ | リアルタイム/15分遅延 | テクニカル/モメンタム計算 |
| ファンダメンタル | 四半期/決算発表時 | 財務データ |
| ニュースセンチメント | 1時間ごと | 速報対応 |
| アナリスト評価 | 日次 | レーティング変更 |
| ソーシャルセンチメント | 6時間ごと | トレンド把握 |

---

## 🛠️ 実装アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Next.js)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ ダッシュボード │ │ 銘柄詳細    │ │ ポートフォリオ配分     │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Node.js/Express)                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ スコア計算API │ │ 配分計算API │ │ アラートAPI            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Sources                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ Yahoo Finance │ │ Alpha Vantage │ │ News API             │ │
│  │ (価格データ)  │ │ (財務データ)  │ │ (センチメント)        │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 次のステップ

1. [ ] スコアリングエンジンの実装
2. [ ] データ取得APIの構築
3. [ ] フロントエンドUIの開発
4. [ ] バックテストの実施
5. [ ] リアルタイム更新機能の追加

---

## ⚠️ 免責事項

本システムは投資助言を提供するものではありません。投資判断は自己責任で行ってください。過去のパフォーマンスは将来の結果を保証するものではありません。
