
// Yahoo Financeの詳細データ取得テスト
// Fundamental (PER, ROE) と Sentiment (Analyst Ratings) が取れるか確認

import https from 'https';

const symbol = 'AAPL'; // Appleでテスト
// 取得したいモジュール: 財務データ, 主要統計, アナリスト推奨
const modules = 'financialData,defaultKeyStatistics,recommendationTrend,earnings';
const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;

console.log(`Testing URL: ${url}`);

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            if (res.statusCode !== 200) {
                console.error(`HTTP Status: ${res.statusCode}`);
                console.log('Response:', data);
                return;
            }

            const json = JSON.parse(data);
            const result = json.quoteSummary?.result?.[0];

            if (!result) {
                console.error('No result found');
                return;
            }

            console.log('--- Fundamental Data Found ---');
            const fin = result.financialData || {};
            const stats = result.defaultKeyStatistics || {};

            console.log(`Current Price: ${fin.currentPrice?.raw}`);
            console.log(`Target Mean Price: ${fin.targetMeanPrice?.raw}`);
            console.log(`PER (Forward): ${stats.forwardPE?.raw}`);
            console.log(`PBR: ${stats.priceToBook?.raw}`);
            console.log(`ROE: ${fin.returnOnEquity?.raw}`);
            console.log(`Revenue Growth: ${fin.revenueGrowth?.raw}`);
            console.log(`Profit Margins: ${fin.profitMargins?.raw}`);

            console.log('\n--- Sentiment (Analyst) Data Found ---');
            const trends = result.recommendationTrend?.trend?.[0]; // 最新のトレンド
            if (trends) {
                console.log(`Period: ${trends.period}`);
                console.log(`Strong Buy: ${trends.strongBuy}`);
                console.log(`Buy: ${trends.buy}`);
                console.log(`Hold: ${trends.hold}`);
                console.log(`Sell: ${trends.sell}`);
                console.log(`Strong Sell: ${trends.strongSell}`);
            } else {
                console.log('No recommendation trend found');
            }

            console.log('\n✅ Data extraction successful! We can implement this.');

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });

}).on('error', (e) => {
    console.error('Network Error:', e.message);
});
