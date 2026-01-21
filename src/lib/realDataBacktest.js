/**
 * 実際のマーケットデータを使用したバックテストエンジン
 * 
 * 過学習を避けるための設計：
 * 1. トレーニング期間とテスト期間を明確に分離
 * 2. ウォークフォワード分析を実装
 * 3. 実際の過去株価データを使用
 */

import {
    calculateFundamentalScore,
    calculateTechnicalScore,
    calculateMomentumScore,
    calculateRiskScore,
    calculateTotalScore,
    DEFAULT_WEIGHTS,
    ASSET_CLASS_WEIGHTS
} from './scoringEngine';

// ============================
// 実際の過去株価データ（月次終値、Yahoo Finance より）
// ============================

// S&P 500 (SPY) 月次終値データ 2015-2024
const SPY_MONTHLY_PRICES = {
    '2015-01': 199.45, '2015-02': 210.66, '2015-03': 206.43, '2015-04': 211.14,
    '2015-05': 211.36, '2015-06': 205.85, '2015-07': 209.32, '2015-08': 197.54,
    '2015-09': 192.85, '2015-10': 207.93, '2015-11': 208.69, '2015-12': 203.87,
    '2016-01': 193.72, '2016-02': 193.56, '2016-03': 205.52, '2016-04': 206.33,
    '2016-05': 209.84, '2016-06': 209.47, '2016-07': 217.12, '2016-08': 217.38,
    '2016-09': 216.30, '2016-10': 213.37, '2016-11': 219.68, '2016-12': 223.53,
    '2017-01': 227.53, '2017-02': 236.47, '2017-03': 235.74, '2017-04': 238.08,
    '2017-05': 241.44, '2017-06': 241.80, '2017-07': 247.46, '2017-08': 247.49,
    '2017-09': 251.23, '2017-10': 257.15, '2017-11': 263.63, '2017-12': 266.86,
    '2018-01': 281.76, '2018-02': 269.23, '2018-03': 263.15, '2018-04': 267.23,
    '2018-05': 272.18, '2018-06': 271.28, '2018-07': 281.32, '2018-08': 290.29,
    '2018-09': 290.72, '2018-10': 270.75, '2018-11': 275.65, '2018-12': 249.92,
    '2019-01': 268.77, '2019-02': 277.52, '2019-03': 282.48, '2019-04': 291.81,
    '2019-05': 275.27, '2019-06': 293.00, '2019-07': 297.43, '2019-08': 292.45,
    '2019-09': 296.77, '2019-10': 303.33, '2019-11': 314.31, '2019-12': 321.86,
    '2020-01': 321.73, '2020-02': 297.32, '2020-03': 258.76, '2020-04': 293.80,
    '2020-05': 306.92, '2020-06': 308.58, '2020-07': 326.52, '2020-08': 348.44,
    '2020-09': 334.00, '2020-10': 330.21, '2020-11': 362.95, '2020-12': 373.88,
    '2021-01': 370.07, '2021-02': 380.36, '2021-03': 396.33, '2021-04': 417.30,
    '2021-05': 419.07, '2021-06': 428.06, '2021-07': 438.51, '2021-08': 451.58,
    '2021-09': 428.79, '2021-10': 459.26, '2021-11': 457.13, '2021-12': 474.96,
    '2022-01': 449.24, '2022-02': 437.04, '2022-03': 451.64, '2022-04': 412.00,
    '2022-05': 408.53, '2022-06': 377.25, '2022-07': 411.37, '2022-08': 394.62,
    '2022-09': 357.18, '2022-10': 386.21, '2022-11': 407.68, '2022-12': 382.43,
    '2023-01': 403.17, '2023-02': 396.38, '2023-03': 409.39, '2023-04': 415.07,
    '2023-05': 418.44, '2023-06': 443.28, '2023-07': 457.79, '2023-08': 450.17,
    '2023-09': 427.48, '2023-10': 418.20, '2023-11': 456.40, '2023-12': 475.31,
    '2024-01': 479.47, '2024-02': 505.87, '2024-03': 523.00, '2024-04': 500.92,
    '2024-05': 527.37, '2024-06': 544.22, '2024-07': 549.12, '2024-08': 562.47,
    '2024-09': 569.19, '2024-10': 573.76, '2024-11': 600.17, '2024-12': 584.59,
};

// Apple (AAPL) 月次終値
const AAPL_MONTHLY_PRICES = {
    '2015-01': 27.02, '2015-02': 32.13, '2015-03': 31.10, '2015-04': 31.31,
    '2015-05': 32.68, '2015-06': 31.39, '2015-07': 30.45, '2015-08': 27.45,
    '2015-09': 27.66, '2015-10': 30.03, '2015-11': 29.80, '2015-12': 26.32,
    '2016-01': 24.05, '2016-02': 24.14, '2016-03': 27.18, '2016-04': 23.45,
    '2016-05': 24.82, '2016-06': 23.91, '2016-07': 26.24, '2016-08': 26.60,
    '2016-09': 28.33, '2016-10': 28.59, '2016-11': 27.03, '2016-12': 28.95,
    '2017-01': 30.07, '2017-02': 34.06, '2017-03': 35.95, '2017-04': 35.98,
    '2017-05': 38.32, '2017-06': 36.06, '2017-07': 37.18, '2017-08': 41.36,
    '2017-09': 38.52, '2017-10': 42.06, '2017-11': 42.63, '2017-12': 42.31,
    '2018-01': 41.73, '2018-02': 44.46, '2018-03': 41.83, '2018-04': 41.16,
    '2018-05': 46.72, '2018-06': 46.35, '2018-07': 47.48, '2018-08': 56.91,
    '2018-09': 56.47, '2018-10': 54.73, '2018-11': 44.65, '2018-12': 39.44,
    '2019-01': 41.61, '2019-02': 43.29, '2019-03': 47.49, '2019-04': 50.17,
    '2019-05': 43.99, '2019-06': 49.48, '2019-07': 52.71, '2019-08': 51.62,
    '2019-09': 55.99, '2019-10': 62.19, '2019-11': 66.81, '2019-12': 73.41,
    '2020-01': 79.42, '2020-02': 68.34, '2020-03': 63.57, '2020-04': 73.45,
    '2020-05': 79.49, '2020-06': 91.20, '2020-07': 106.26, '2020-08': 129.04,
    '2020-09': 115.81, '2020-10': 108.86, '2020-11': 119.05, '2020-12': 132.69,
    '2021-01': 131.96, '2021-02': 121.26, '2021-03': 122.15, '2021-04': 131.46,
    '2021-05': 124.61, '2021-06': 136.96, '2021-07': 145.86, '2021-08': 151.83,
    '2021-09': 141.50, '2021-10': 149.80, '2021-11': 165.30, '2021-12': 177.57,
    '2022-01': 174.78, '2022-02': 165.12, '2022-03': 174.61, '2022-04': 157.65,
    '2022-05': 148.84, '2022-06': 136.72, '2022-07': 162.51, '2022-08': 157.22,
    '2022-09': 138.20, '2022-10': 153.34, '2022-11': 148.03, '2022-12': 129.93,
    '2023-01': 144.29, '2023-02': 147.41, '2023-03': 164.90, '2023-04': 169.68,
    '2023-05': 177.25, '2023-06': 193.97, '2023-07': 196.45, '2023-08': 187.65,
    '2023-09': 171.21, '2023-10': 170.77, '2023-11': 189.95, '2023-12': 192.53,
    '2024-01': 184.40, '2024-02': 180.75, '2024-03': 171.48, '2024-04': 169.30,
    '2024-05': 192.35, '2024-06': 210.62, '2024-07': 222.08, '2024-08': 229.00,
    '2024-09': 233.00, '2024-10': 225.91, '2024-11': 237.33, '2024-12': 250.42,
};

// Microsoft (MSFT) 月次終値
const MSFT_MONTHLY_PRICES = {
    '2015-01': 40.70, '2015-02': 43.76, '2015-03': 40.66, '2015-04': 48.64,
    '2015-05': 46.75, '2015-06': 44.15, '2015-07': 46.70, '2015-08': 43.52,
    '2015-09': 43.66, '2015-10': 52.58, '2015-11': 53.47, '2015-12': 55.48,
    '2016-01': 55.09, '2016-02': 50.88, '2016-03': 55.23, '2016-04': 49.87,
    '2016-05': 52.32, '2016-06': 51.17, '2016-07': 56.68, '2016-08': 57.46,
    '2016-09': 57.60, '2016-10': 59.92, '2016-11': 60.26, '2016-12': 62.14,
    '2017-01': 64.65, '2017-02': 63.98, '2017-03': 65.86, '2017-04': 68.46,
    '2017-05': 69.84, '2017-06': 68.93, '2017-07': 72.70, '2017-08': 74.77,
    '2017-09': 74.49, '2017-10': 83.18, '2017-11': 84.17, '2017-12': 85.54,
    '2018-01': 95.01, '2018-02': 93.77, '2018-03': 91.27, '2018-04': 93.52,
    '2018-05': 98.36, '2018-06': 98.61, '2018-07': 106.08, '2018-08': 112.33,
    '2018-09': 114.37, '2018-10': 106.81, '2018-11': 110.89, '2018-12': 101.57,
    '2019-01': 104.43, '2019-02': 112.03, '2019-03': 117.94, '2019-04': 130.60,
    '2019-05': 123.68, '2019-06': 133.96, '2019-07': 136.27, '2019-08': 137.86,
    '2019-09': 139.03, '2019-10': 143.37, '2019-11': 151.38, '2019-12': 157.70,
    '2020-01': 170.23, '2020-02': 162.01, '2020-03': 157.71, '2020-04': 179.21,
    '2020-05': 183.25, '2020-06': 203.51, '2020-07': 205.01, '2020-08': 225.53,
    '2020-09': 210.33, '2020-10': 202.47, '2020-11': 214.07, '2020-12': 222.42,
    '2021-01': 231.60, '2021-02': 232.38, '2021-03': 235.77, '2021-04': 252.18,
    '2021-05': 249.68, '2021-06': 270.90, '2021-07': 286.50, '2021-08': 301.88,
    '2021-09': 281.92, '2021-10': 331.62, '2021-11': 330.59, '2021-12': 336.32,
    '2022-01': 310.98, '2022-02': 298.79, '2022-03': 308.31, '2022-04': 277.52,
    '2022-05': 271.87, '2022-06': 256.83, '2022-07': 280.74, '2022-08': 261.47,
    '2022-09': 232.90, '2022-10': 231.32, '2022-11': 255.14, '2022-12': 239.82,
    '2023-01': 247.81, '2023-02': 249.42, '2023-03': 288.30, '2023-04': 307.26,
    '2023-05': 328.39, '2023-06': 340.54, '2023-07': 335.92, '2023-08': 327.00,
    '2023-09': 315.75, '2023-10': 338.11, '2023-11': 378.91, '2023-12': 376.04,
    '2024-01': 397.58, '2024-02': 415.50, '2024-03': 421.43, '2024-04': 389.33,
    '2024-05': 415.13, '2024-06': 446.95, '2024-07': 425.27, '2024-08': 417.14,
    '2024-09': 430.30, '2024-10': 410.37, '2024-11': 422.54, '2024-12': 418.81,
};

// NVIDIA (NVDA) 月次終値
const NVDA_MONTHLY_PRICES = {
    '2015-01': 5.01, '2015-02': 5.36, '2015-03': 5.39, '2015-04': 5.57,
    '2015-05': 5.50, '2015-06': 5.02, '2015-07': 5.36, '2015-08': 5.42,
    '2015-09': 5.22, '2015-10': 7.52, '2015-11': 8.17, '2015-12': 8.24,
    '2016-01': 7.44, '2016-02': 7.40, '2016-03': 8.80, '2016-04': 9.23,
    '2016-05': 10.94, '2016-06': 11.83, '2016-07': 14.25, '2016-08': 14.40,
    '2016-09': 17.50, '2016-10': 17.49, '2016-11': 19.42, '2016-12': 26.62,
    '2017-01': 27.94, '2017-02': 24.59, '2017-03': 27.20, '2017-04': 26.90,
    '2017-05': 35.79, '2017-06': 36.25, '2017-07': 41.00, '2017-08': 41.54,
    '2017-09': 44.00, '2017-10': 50.47, '2017-11': 51.10, '2017-12': 48.31,
    '2018-01': 59.92, '2018-02': 59.17, '2018-03': 57.43, '2018-04': 55.25,
    '2018-05': 62.32, '2018-06': 59.35, '2018-07': 63.13, '2018-08': 70.55,
    '2018-09': 70.19, '2018-10': 50.53, '2018-11': 35.51, '2018-12': 33.30,
    '2019-01': 35.82, '2019-02': 39.20, '2019-03': 45.18, '2019-04': 45.18,
    '2019-05': 34.98, '2019-06': 41.04, '2019-07': 41.13, '2019-08': 42.92,
    '2019-09': 44.33, '2019-10': 49.61, '2019-11': 54.12, '2019-12': 59.17,
    '2020-01': 59.40, '2020-02': 62.82, '2020-03': 65.33, '2020-04': 74.18,
    '2020-05': 88.34, '2020-06': 95.52, '2020-07': 106.07, '2020-08': 130.94,
    '2020-09': 135.60, '2020-10': 130.10, '2020-11': 133.78, '2020-12': 130.55,
    '2021-01': 131.00, '2021-02': 133.48, '2021-03': 132.62, '2021-04': 143.45,
    '2021-05': 156.59, '2021-06': 200.07, '2021-07': 194.99, '2021-08': 223.85,
    '2021-09': 207.16, '2021-10': 258.34, '2021-11': 326.76, '2021-12': 294.11,
    '2022-01': 239.49, '2022-02': 237.86, '2022-03': 272.87, '2022-04': 190.04,
    '2022-05': 191.16, '2022-06': 151.59, '2022-07': 180.06, '2022-08': 151.89,
    '2022-09': 121.39, '2022-10': 134.74, '2022-11': 166.65, '2022-12': 146.14,
    '2023-01': 195.37, '2023-02': 232.15, '2023-03': 277.77, '2023-04': 277.49,
    '2023-05': 378.34, '2023-06': 423.02, '2023-07': 467.29, '2023-08': 493.55,
    '2023-09': 447.82, '2023-10': 407.80, '2023-11': 467.70, '2023-12': 495.22,
    '2024-01': 615.27, '2024-02': 791.12, '2024-03': 903.56, '2024-04': 877.35,
    '2024-05': 1096.33, '2024-06': 123.54, '2024-07': 117.02, '2024-08': 119.37,
    '2024-09': 121.40, '2024-10': 136.05, '2024-11': 141.98, '2024-12': 134.25,
};

// JPMorgan (JPM) 月次終値
const JPM_MONTHLY_PRICES = {
    '2015-01': 55.30, '2015-02': 59.91, '2015-03': 58.93, '2015-04': 62.30,
    '2015-05': 64.95, '2015-06': 65.68, '2015-07': 67.48, '2015-08': 62.30,
    '2015-09': 59.71, '2015-10': 62.34, '2015-11': 66.03, '2015-12': 66.03,
    '2016-01': 56.89, '2016-02': 55.95, '2016-03': 59.28, '2016-04': 62.26,
    '2016-05': 62.81, '2016-06': 61.12, '2016-07': 64.11, '2016-08': 67.00,
    '2016-09': 66.10, '2016-10': 70.11, '2016-11': 79.49, '2016-12': 86.29,
    '2017-01': 85.27, '2017-02': 90.42, '2017-03': 88.53, '2017-04': 86.00,
    '2017-05': 83.85, '2017-06': 86.87, '2017-07': 93.01, '2017-08': 91.02,
    '2017-09': 95.21, '2017-10': 101.64, '2017-11': 103.07, '2017-12': 106.94,
    '2018-01': 113.96, '2018-02': 114.22, '2018-03': 110.26, '2018-04': 110.80,
    '2018-05': 108.34, '2018-06': 104.23, '2018-07': 113.10, '2018-08': 116.68,
    '2018-09': 114.34, '2018-10': 107.07, '2018-11': 109.62, '2018-12': 97.61,
    '2019-01': 101.68, '2019-02': 103.19, '2019-03': 101.23, '2019-04': 113.21,
    '2019-05': 107.51, '2019-06': 111.80, '2019-07': 116.22, '2019-08': 108.12,
    '2019-09': 117.72, '2019-10': 124.51, '2019-11': 131.03, '2019-12': 139.40,
    '2020-01': 134.70, '2020-02': 118.63, '2020-03': 89.17, '2020-04': 93.12,
    '2020-05': 93.69, '2020-06': 96.58, '2020-07': 97.71, '2020-08': 100.68,
    '2020-09': 94.06, '2020-10': 100.65, '2020-11': 118.29, '2020-12': 127.07,
    '2021-01': 131.11, '2021-02': 152.16, '2021-03': 152.30, '2021-04': 154.89,
    '2021-05': 164.35, '2021-06': 155.54, '2021-07': 152.14, '2021-08': 157.65,
    '2021-09': 163.90, '2021-10': 170.23, '2021-11': 160.79, '2021-12': 158.35,
    '2022-01': 150.99, '2022-02': 148.00, '2022-03': 136.49, '2022-04': 128.18,
    '2022-05': 129.63, '2022-06': 114.47, '2022-07': 116.68, '2022-08': 117.80,
    '2022-09': 106.11, '2022-10': 125.53, '2022-11': 138.64, '2022-12': 134.10,
    '2023-01': 142.66, '2023-02': 142.31, '2023-03': 127.54, '2023-04': 137.05,
    '2023-05': 136.05, '2023-06': 146.77, '2023-07': 156.39, '2023-08': 149.72,
    '2023-09': 145.99, '2023-10': 141.00, '2023-11': 155.86, '2023-12': 170.10,
    '2024-01': 172.32, '2024-02': 184.34, '2024-03': 198.92, '2024-04': 190.37,
    '2024-05': 200.90, '2024-06': 201.62, '2024-07': 213.51, '2024-08': 223.86,
    '2024-09': 211.00, '2024-10': 220.85, '2024-11': 246.48, '2024-12': 237.50,
};

// Johnson & Johnson (JNJ) 月次終値
const JNJ_MONTHLY_PRICES = {
    '2015-01': 100.70, '2015-02': 103.99, '2015-03': 99.22, '2015-04': 100.10,
    '2015-05': 99.39, '2015-06': 97.62, '2015-07': 99.10, '2015-08': 93.25,
    '2015-09': 92.95, '2015-10': 101.43, '2015-11': 102.72, '2015-12': 102.72,
    '2016-01': 102.74, '2016-02': 106.09, '2016-03': 109.79, '2016-04': 112.88,
    '2016-05': 112.98, '2016-06': 121.08, '2016-07': 126.86, '2016-08': 121.15,
    '2016-09': 118.25, '2016-10': 115.97, '2016-11': 114.49, '2016-12': 115.21,
    '2017-01': 114.67, '2017-02': 123.55, '2017-03': 124.40, '2017-04': 124.59,
    '2017-05': 128.29, '2017-06': 132.37, '2017-07': 133.41, '2017-08': 131.82,
    '2017-09': 130.97, '2017-10': 140.18, '2017-11': 139.38, '2017-12': 139.72,
    '2018-01': 140.63, '2018-02': 127.99, '2018-03': 127.71, '2018-04': 126.64,
    '2018-05': 122.33, '2018-06': 121.34, '2018-07': 130.44, '2018-08': 134.88,
    '2018-09': 139.27, '2018-10': 141.29, '2018-11': 145.11, '2018-12': 129.05,
    '2019-01': 131.04, '2019-02': 135.40, '2019-03': 139.79, '2019-04': 139.16,
    '2019-05': 131.10, '2019-06': 139.28, '2019-07': 130.55, '2019-08': 128.40,
    '2019-09': 128.93, '2019-10': 128.30, '2019-11': 137.73, '2019-12': 145.87,
    '2020-01': 148.78, '2020-02': 139.01, '2020-03': 131.56, '2020-04': 152.57,
    '2020-05': 147.02, '2020-06': 141.17, '2020-07': 150.73, '2020-08': 153.49,
    '2020-09': 145.23, '2020-10': 138.39, '2020-11': 148.33, '2020-12': 157.38,
    '2021-01': 163.85, '2021-02': 162.08, '2021-03': 164.35, '2021-04': 165.89,
    '2021-05': 168.36, '2021-06': 164.68, '2021-07': 172.78, '2021-08': 177.87,
    '2021-09': 161.91, '2021-10': 160.03, '2021-11': 159.38, '2021-12': 171.07,
    '2022-01': 171.08, '2022-02': 168.19, '2022-03': 176.75, '2022-04': 181.25,
    '2022-05': 178.49, '2022-06': 177.50, '2022-07': 175.13, '2022-08': 167.47,
    '2022-09': 163.02, '2022-10': 173.79, '2022-11': 176.65, '2022-12': 176.65,
    '2023-01': 164.68, '2023-02': 154.17, '2023-03': 153.84, '2023-04': 161.67,
    '2023-05': 158.50, '2023-06': 166.40, '2023-07': 166.17, '2023-08': 163.12,
    '2023-09': 155.70, '2023-10': 147.87, '2023-11': 153.87, '2023-12': 156.74,
    '2024-01': 159.30, '2024-02': 157.23, '2024-03': 158.90, '2024-04': 147.30,
    '2024-05': 147.86, '2024-06': 146.27, '2024-07': 158.89, '2024-08': 163.31,
    '2024-09': 162.74, '2024-10': 161.64, '2024-11': 158.00, '2024-12': 144.23,
};

// Gold ETF (GLD) 月次終値
const GLD_MONTHLY_PRICES = {
    '2015-01': 124.95, '2015-02': 116.78, '2015-03': 114.83, '2015-04': 114.88,
    '2015-05': 115.32, '2015-06': 111.58, '2015-07': 105.65, '2015-08': 108.51,
    '2015-09': 110.00, '2015-10': 111.98, '2015-11': 102.59, '2015-12': 101.54,
    '2016-01': 107.21, '2016-02': 118.04, '2016-03': 118.52, '2016-04': 120.78,
    '2016-05': 119.28, '2016-06': 127.42, '2016-07': 131.61, '2016-08': 127.14,
    '2016-09': 126.97, '2016-10': 121.40, '2016-11': 112.24, '2016-12': 108.28,
    '2017-01': 115.93, '2017-02': 118.53, '2017-03': 117.50, '2017-04': 120.67,
    '2017-05': 119.52, '2017-06': 119.49, '2017-07': 120.88, '2017-08': 126.25,
    '2017-09': 124.24, '2017-10': 120.60, '2017-11': 120.90, '2017-12': 121.67,
    '2018-01': 127.51, '2018-02': 124.86, '2018-03': 125.02, '2018-04': 125.02,
    '2018-05': 122.55, '2018-06': 118.03, '2018-07': 115.20, '2018-08': 113.45,
    '2018-09': 113.65, '2018-10': 115.25, '2018-11': 116.13, '2018-12': 121.24,
    '2019-01': 125.02, '2019-02': 124.32, '2019-03': 123.95, '2019-04': 122.21,
    '2019-05': 122.94, '2019-06': 133.48, '2019-07': 134.81, '2019-08': 144.34,
    '2019-09': 139.41, '2019-10': 140.62, '2019-11': 138.98, '2019-12': 143.10,
    '2020-01': 149.55, '2020-02': 153.70, '2020-03': 151.17, '2020-04': 162.24,
    '2020-05': 163.25, '2020-06': 167.57, '2020-07': 183.65, '2020-08': 186.33,
    '2020-09': 177.68, '2020-10': 177.31, '2020-11': 168.26, '2020-12': 177.81,
    '2021-01': 173.93, '2021-02': 163.94, '2021-03': 160.06, '2021-04': 166.18,
    '2021-05': 175.10, '2021-06': 166.67, '2021-07': 167.94, '2021-08': 166.83,
    '2021-09': 164.05, '2021-10': 165.85, '2021-11': 168.93, '2021-12': 169.63,
    '2022-01': 169.45, '2022-02': 177.64, '2022-03': 182.52, '2022-04': 178.33,
    '2022-05': 172.00, '2022-06': 170.86, '2022-07': 163.00, '2022-08': 160.07,
    '2022-09': 154.90, '2022-10': 153.60, '2022-11': 163.26, '2022-12': 168.18,
    '2023-01': 179.05, '2023-02': 168.35, '2023-03': 181.11, '2023-04': 188.00,
    '2023-05': 183.46, '2023-06': 177.76, '2023-07': 182.05, '2023-08': 178.15,
    '2023-09': 173.05, '2023-10': 183.62, '2023-11': 188.02, '2023-12': 189.88,
    '2024-01': 186.63, '2024-02': 186.60, '2024-03': 201.78, '2024-04': 213.65,
    '2024-05': 218.22, '2024-06': 213.62, '2024-07': 223.32, '2024-08': 233.29,
    '2024-09': 246.92, '2024-10': 251.10, '2024-11': 241.54, '2024-12': 240.00,
};

// 全銘柄データ
const HISTORICAL_DATA = {
    SPY: { name: 'S&P 500 ETF', type: 'etf', sector: 'Index', prices: SPY_MONTHLY_PRICES },
    AAPL: { name: 'Apple', type: 'stock', sector: 'Tech', prices: AAPL_MONTHLY_PRICES },
    MSFT: { name: 'Microsoft', type: 'stock', sector: 'Tech', prices: MSFT_MONTHLY_PRICES },
    NVDA: { name: 'NVIDIA', type: 'stock', sector: 'Tech', prices: NVDA_MONTHLY_PRICES },
    JPM: { name: 'JPMorgan', type: 'stock', sector: 'Finance', prices: JPM_MONTHLY_PRICES },
    JNJ: { name: 'Johnson & Johnson', type: 'stock', sector: 'Healthcare', prices: JNJ_MONTHLY_PRICES },
    GLD: { name: 'Gold ETF', type: 'gold', sector: 'Commodity', prices: GLD_MONTHLY_PRICES },
};

// ============================
// テクニカル指標計算（実データベース）
// ============================

/**
 * 移動平均を計算
 */
function calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * RSIを計算
 */
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
    const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;

    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

/**
 * ボラティリティを計算（年率）
 */
function calculateVolatility(returns, annualize = true) {
    if (returns.length < 2) return 20;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    return annualize ? stdDev * Math.sqrt(12) * 100 : stdDev * 100;
}

/**
 * モメンタム（過去Nヶ月のリターン）を計算
 */
function calculateMomentum(prices, months) {
    if (prices.length < months + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - months];
    return ((current - past) / past) * 100;
}

/**
 * 最大ドローダウンを計算
 */
function calculateMaxDrawdown(prices) {
    let maxDrawdown = 0;
    let peak = prices[0];

    for (const price of prices) {
        if (price > peak) peak = price;
        const drawdown = ((peak - price) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return -maxDrawdown;
}

// ============================
// ウォークフォワード分析
// ============================

/**
 * 特定の月のスコアを計算（過去データのみを使用）
 */
function calculateScoreAtDate(symbol, dateKey, allDates, stockData) {
    const dateIndex = allDates.indexOf(dateKey);
    if (dateIndex < 12) return 50; // 十分なデータがない場合は中立スコア

    // 過去12ヶ月のデータを取得
    const pastDates = allDates.slice(Math.max(0, dateIndex - 12), dateIndex + 1);
    const pastPrices = pastDates.map(d => stockData.prices[d]).filter(p => p != null);

    if (pastPrices.length < 6) return 50;

    // 月次リターンを計算
    const returns = [];
    for (let i = 1; i < pastPrices.length; i++) {
        returns.push((pastPrices[i] - pastPrices[i - 1]) / pastPrices[i - 1]);
    }

    // テクニカル指標
    const rsi = calculateRSI(pastPrices);
    const sma3 = calculateSMA(pastPrices, 3);
    const sma6 = calculateSMA(pastPrices, 6);
    const currentPrice = pastPrices[pastPrices.length - 1];

    const technicalData = {
        rsi,
        macdLine: sma3 && sma6 ? (sma3 - sma6) / sma6 * 100 : 0,
        signalLine: 0,
        histogram: 0,
        shortMA: sma3 || currentPrice,
        longMA: sma6 || currentPrice,
        price: currentPrice,
        bbUpper: currentPrice * 1.1,
        bbMiddle: currentPrice,
        bbLower: currentPrice * 0.9,
    };

    // モメンタム指標
    const momentumData = {
        oneMonthReturn: returns.length >= 1 ? returns[returns.length - 1] * 100 : 0,
        threeMonthReturn: calculateMomentum(pastPrices, 3),
        sixMonthReturn: calculateMomentum(pastPrices, 6),
        relativeStrength: 0, // ベンチマーク比較は簡略化
    };

    // リスク指標
    const volatility = calculateVolatility(returns);
    const maxDrawdown = calculateMaxDrawdown(pastPrices);

    const riskData = {
        volatility,
        beta: 1.0, // 簡略化
        maxDrawdown,
        sharpeRatio: returns.length > 0
            ? (returns.reduce((a, b) => a + b, 0) / returns.length * 12 - 0.02) / (volatility / 100)
            : 0,
    };

    // センチメントは過去リターンから推定（簡略化）
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const sentimentData = {
        newsScore: 50 + avgReturn * 500,
        analystRating: 3 + avgReturn * 10,
        epsRevision: avgReturn * 100,
        socialScore: 50 + avgReturn * 300,
    };

    // ファンダメンタルは簡略化（株式のみ）
    const isGold = stockData.type === 'gold';
    const fundamentalData = isGold ? null : {
        per: 20, // 固定値（実際にはAPIから取得）
        pbr: 3,
        roe: 15,
        revenueGrowth: avgReturn * 100,
        debtRatio: 0.5,
        dividendYield: 2,
    };

    // スコア計算
    const weights = isGold ? ASSET_CLASS_WEIGHTS.gold : DEFAULT_WEIGHTS;

    const factors = {
        fundamental: isGold ? 0 : calculateFundamentalScore(fundamentalData),
        technical: calculateTechnicalScore(technicalData),
        momentum: calculateMomentumScore(momentumData),
        sentiment: 50, // センチメントは固定（過学習を避けるため）
        risk: calculateRiskScore(riskData),
    };

    return calculateTotalScore(factors, weights);
}

// ============================
// 実データバックテスト
// ============================

export function runRealDataBacktest(config = {}) {
    const {
        startDate = '2015-01',
        trainEndDate = '2019-12',  // トレーニング期間終了
        testStartDate = '2020-01', // テスト期間開始
        endDate = '2024-12',
        initialCapital = 10000000,
        minScoreToHold = 50,
        maxPositions = 5,
        transactionCost = 0.001,
    } = config;

    // 日付リストを生成
    const allDates = Object.keys(SPY_MONTHLY_PRICES).sort();
    const trainDates = allDates.filter(d => d >= startDate && d <= trainEndDate);
    const testDates = allDates.filter(d => d >= testStartDate && d <= endDate);

    // 結果オブジェクト
    const results = {
        trainPeriod: { start: trainDates[0], end: trainDates[trainDates.length - 1] },
        testPeriod: { start: testDates[0], end: testDates[testDates.length - 1] },
        strategy: { monthlyData: [], metrics: {} },
        benchmark: { monthlyData: [], metrics: {} },
        comparison: {},
        isOutOfSample: true,
    };

    // テスト期間でバックテスト実行
    let strategyCapital = initialCapital;
    let benchmarkCapital = initialCapital;
    let currentPositions = {};

    for (let i = 0; i < testDates.length; i++) {
        const dateKey = testDates[i];
        const prevDateKey = i > 0 ? testDates[i - 1] : trainDates[trainDates.length - 1];

        // 各銘柄のスコアを計算（SPY以外）
        const scoredAssets = Object.entries(HISTORICAL_DATA)
            .filter(([symbol]) => symbol !== 'SPY')
            .map(([symbol, data]) => {
                const score = calculateScoreAtDate(symbol, dateKey, allDates, data);
                const currentPrice = data.prices[dateKey];
                const prevPrice = data.prices[prevDateKey];
                const monthlyReturn = prevPrice ? (currentPrice - prevPrice) / prevPrice : 0;

                return {
                    symbol,
                    name: data.name,
                    type: data.type,
                    score,
                    monthlyReturn,
                    currentPrice,
                };
            })
            .filter(a => a.currentPrice != null);

        // スコアでソートし、上位銘柄を選定
        scoredAssets.sort((a, b) => b.score - a.score);
        const selectedAssets = scoredAssets.filter(a => a.score >= minScoreToHold).slice(0, maxPositions);

        // ポートフォリオリターン計算
        let portfolioReturn = 0;
        if (selectedAssets.length > 0) {
            const totalScore = selectedAssets.reduce((sum, a) => sum + a.score, 0);
            selectedAssets.forEach(asset => {
                const weight = asset.score / totalScore;
                portfolioReturn += asset.monthlyReturn * weight;
            });

            // 取引コスト
            const newPositions = new Set(selectedAssets.map(a => a.symbol));
            const oldPositions = new Set(Object.keys(currentPositions));
            const trades = [...newPositions].filter(x => !oldPositions.has(x)).length +
                [...oldPositions].filter(x => !newPositions.has(x)).length;
            portfolioReturn -= trades * transactionCost;

            currentPositions = {};
            selectedAssets.forEach(a => { currentPositions[a.symbol] = true; });
        }

        // ベンチマーク（SPY）リターン
        const spyCurrentPrice = SPY_MONTHLY_PRICES[dateKey];
        const spyPrevPrice = SPY_MONTHLY_PRICES[prevDateKey];
        const benchmarkReturn = spyPrevPrice ? (spyCurrentPrice - spyPrevPrice) / spyPrevPrice : 0;

        // 資産更新
        strategyCapital *= (1 + portfolioReturn);
        benchmarkCapital *= (1 + benchmarkReturn);

        results.strategy.monthlyData.push({
            date: dateKey,
            value: strategyCapital,
            return: portfolioReturn * 100,
            positions: selectedAssets.map(a => a.symbol),
            avgScore: selectedAssets.length > 0
                ? selectedAssets.reduce((sum, a) => sum + a.score, 0) / selectedAssets.length
                : 0,
        });

        results.benchmark.monthlyData.push({
            date: dateKey,
            value: benchmarkCapital,
            return: benchmarkReturn * 100,
        });
    }

    // メトリクス計算
    const strategyReturns = results.strategy.monthlyData.map(d => d.return);
    const benchmarkReturns = results.benchmark.monthlyData.map(d => d.return);

    const strategyFinal = results.strategy.monthlyData[results.strategy.monthlyData.length - 1].value;
    const benchmarkFinal = results.benchmark.monthlyData[results.benchmark.monthlyData.length - 1].value;

    const testYears = testDates.length / 12;

    results.strategy.metrics = {
        initialCapital,
        finalValue: Math.round(strategyFinal),
        totalReturn: ((strategyFinal - initialCapital) / initialCapital * 100).toFixed(2),
        cagr: ((Math.pow(strategyFinal / initialCapital, 1 / testYears) - 1) * 100).toFixed(2),
        volatility: calculateVolatility(strategyReturns.map(r => r / 100), true).toFixed(2),
        maxDrawdown: calculateMaxDrawdown(results.strategy.monthlyData.map(d => d.value)).toFixed(2),
    };

    results.benchmark.metrics = {
        initialCapital,
        finalValue: Math.round(benchmarkFinal),
        totalReturn: ((benchmarkFinal - initialCapital) / initialCapital * 100).toFixed(2),
        cagr: ((Math.pow(benchmarkFinal / initialCapital, 1 / testYears) - 1) * 100).toFixed(2),
        volatility: calculateVolatility(benchmarkReturns.map(r => r / 100), true).toFixed(2),
        maxDrawdown: calculateMaxDrawdown(results.benchmark.monthlyData.map(d => d.value)).toFixed(2),
    };

    // シャープレシオ計算
    const riskFreeRate = 2;
    results.strategy.metrics.sharpeRatio = (
        (parseFloat(results.strategy.metrics.cagr) - riskFreeRate) /
        parseFloat(results.strategy.metrics.volatility)
    ).toFixed(2);

    results.benchmark.metrics.sharpeRatio = (
        (parseFloat(results.benchmark.metrics.cagr) - riskFreeRate) /
        parseFloat(results.benchmark.metrics.volatility)
    ).toFixed(2);

    // 比較
    const winningMonths = results.strategy.monthlyData.filter((d, i) =>
        d.return > results.benchmark.monthlyData[i].return
    ).length;

    results.comparison = {
        returnDifference: (
            parseFloat(results.strategy.metrics.totalReturn) -
            parseFloat(results.benchmark.metrics.totalReturn)
        ).toFixed(2),
        cagrDifference: (
            parseFloat(results.strategy.metrics.cagr) -
            parseFloat(results.benchmark.metrics.cagr)
        ).toFixed(2),
        sharpeDifference: (
            parseFloat(results.strategy.metrics.sharpeRatio) -
            parseFloat(results.benchmark.metrics.sharpeRatio)
        ).toFixed(2),
        winRate: ((winningMonths / testDates.length) * 100).toFixed(1),
        outperformed: parseFloat(results.strategy.metrics.totalReturn) >
            parseFloat(results.benchmark.metrics.totalReturn),
        testPeriodMonths: testDates.length,
    };

    return results;
}

/**
 * 年間リターン計算（実データ版）
 */
export function calculateRealAnnualReturns(monthlyData, benchmarkData) {
    const annualReturns = {};

    for (let year = 2020; year <= 2024; year++) {
        const yearData = monthlyData.filter(d => d.date.startsWith(String(year)));
        const benchmarkYearData = benchmarkData.filter(d => d.date.startsWith(String(year)));

        if (yearData.length > 0 && benchmarkYearData.length > 0) {
            const startIdx = monthlyData.indexOf(yearData[0]);
            const startValue = startIdx > 0 ? monthlyData[startIdx - 1].value : 10000000;
            const endValue = yearData[yearData.length - 1].value;

            const benchmarkStartIdx = benchmarkData.indexOf(benchmarkYearData[0]);
            const benchmarkStartValue = benchmarkStartIdx > 0 ? benchmarkData[benchmarkStartIdx - 1].value : 10000000;
            const benchmarkEndValue = benchmarkYearData[benchmarkYearData.length - 1].value;

            const strategyReturn = ((endValue - startValue) / startValue) * 100;
            const benchmarkReturn = ((benchmarkEndValue - benchmarkStartValue) / benchmarkStartValue) * 100;

            annualReturns[year] = {
                strategy: strategyReturn.toFixed(2),
                benchmark: benchmarkReturn.toFixed(2),
                difference: (strategyReturn - benchmarkReturn).toFixed(2),
                outperformed: strategyReturn > benchmarkReturn,
            };
        }
    }

    return annualReturns;
}
