
/**
 * 銘柄のスコアと詳細データに基づいて、AI風の解説テキストを生成します。
 */
export function generateAiInsight(asset) {
    const { totalScore, factors, rawData, symbol, name, nisa } = asset;
    const insights = [];
    const risks = [];

    // NISA適性評価
    let nisaAdvice = "";
    if (totalScore >= 60 && nisa?.isGrowth) {
        if (factors?.risk?.volatility < 25) {
            nisaAdvice = `\n\n🇯🇵 **新NISA戦略**: この銘柄はスコアが高くボラティリティも安定しているため、**成長投資枠**を活用して非課税で長期保有するのに理想的です。`;
        } else {
            nisaAdvice = `\n\n🇯🇵 **新NISA戦略**: 上昇期待値は高いですが変動も大きいため、**成長投資枠**の一部としてポートフォリオのアクセントにすることを検討してください。`;
        }

        if (nisa.isTsumitate) {
            nisaAdvice += `\nまた、**つみたて投資枠**の対象（または類似商品）でもあるため、毎月の積立設定も有効です。`;
        }
    }

    // スコア全体の評価
    let overallSentiment = "";
    if (totalScore >= 80) {
        overallSentiment = `🚀 **${symbol} (${name})** は極めて強力な買いシグナルを示しています。複数のポジティブな要因が重なっています。`;
    } else if (totalScore >= 65) {
        overallSentiment = `✅ **${symbol} (${name})** は堅調なスコアを維持しており、魅力的な投資対象です。`;
    } else if (totalScore >= 50) {
        overallSentiment = `🔄 **${symbol} (${name})** は中立的な評価です。明確な方向性が出るまで様子見が賢明かもしれません。`;
    } else {
        overallSentiment = `⚠️ **${symbol} (${name})** は現在、複数のネガティブな要因によりスコアが低迷しています。`;
    }

    // ファクター別の分析
    // モメンタム
    let momentumScore = 50;
    if (Array.isArray(factors)) {
        momentumScore = factors.find(f => f.key === 'momentum')?.score || 50;
    } else if (factors && typeof factors === 'object') {
        // オブジェクト形式の場合のフォールバック
        momentumScore = factors.momentum || 50;
    }
    if (momentumScore >= 80) {
        insights.push("📈 **強い上昇トレンド**: 過去の株価推移が非常に強く、市場の注目を集めています。順張りのチャンスです。");
    } else if (momentumScore <= 30) {
        risks.push("📉 **トレンドの欠如**: 直近のパフォーマンスが市場平均を下回っており、上値が重い展開です。");
    }

    // テクニカル (RSIなど)
    const technicalData = rawData?.technical || {};
    if (technicalData.rsi < 30) {
        insights.push("💎 **売られすぎ水準**: RSIが30を下回り、短期的な反発の可能性が高まっています（逆張りチャンス）。");
    } else if (technicalData.rsi > 70) {
        risks.push("🔥 **過熱感**: RSIが70を超えており、短期的な調整（下落）が入るリスクがあります。");
    }

    // ボラティリティ (リスク)
    const riskData = rawData?.risk || {};
    if (riskData.volatility < 15) {
        insights.push("🛡️ **安定した値動き**: ボラティリティが低く、安心して保有できる銘柄です。");
    } else if (riskData.volatility > 40) {
        risks.push("⚡ **高い変動率**: 値動きが激しいため、リスク管理（ポジションサイズの調整）が重要です。");
    }

    // 結論の生成
    const strengths = insights.length > 0 ? `\n\n**強気材料:**\n${insights.map(i => `- ${i}`).join('\n')}` : "";
    const weaknesses = risks.length > 0 ? `\n\n**懸念材料:**\n${risks.map(i => `- ${i}`).join('\n')}` : "";

    return `${overallSentiment}${strengths}${weaknesses}${nisaAdvice}\n\n**AIの結論:**\n${totalScore >= 60 ? '上昇ポテンシャルがリスクを上回っています。' : 'リスク要因が解消されるまで待機を推奨します。'}`;
}
