#!/usr/bin/env node
/**
 * Daily News Digest → HTML page (v2)
 * Enhanced with sector analysis & market data
 * 
 * Features:
 * - RSS news across categories
 * - US sector ETF performance (via Yahoo Finance)
 * - A-share market data (via Tushare)
 * - AI-powered sector impact analysis (via Gemini)
 */

import https from 'https';
import http from 'http';
import fs from 'fs';

// ============================================================
// CONFIG
// ============================================================
const GEMINI_API_KEY = 'AIzaSyB43Jqp8rUgDd7cM7aWyWgClvELvTrAny0';
const TUSHARE_TOKEN = 'bb30a9f53019f70a1bbf2edb5d67587974a0cc5cde8f11f680672261';

// US Sector ETFs
const US_SECTOR_ETFS = [
  { symbol: 'SPY', name: '标普500' },
  { symbol: 'QQQ', name: '纳斯达克100' },
  { symbol: 'DIA', name: '道琼斯' },
  { symbol: 'XLK', name: '科技' },
  { symbol: 'XLF', name: '金融' },
  { symbol: 'XLE', name: '能源' },
  { symbol: 'XLV', name: '医疗' },
  { symbol: 'XLI', name: '工业' },
  { symbol: 'XLC', name: '通信' },
  { symbol: 'XLY', name: '消费' },
  { symbol: 'XLP', name: '必需消费' },
  { symbol: 'XLU', name: '公用事业' },
  { symbol: 'XLB', name: '材料' },
  { symbol: 'XLRE', name: '房地产' },
  { symbol: 'SMH', name: '半导体' },
  { symbol: 'ARKK', name: '创新科技' },
  { symbol: 'GLD', name: '黄金' },
  { symbol: 'USO', name: '原油' },
];

// ============================================================
// RSS FEEDS
// ============================================================
const FEEDS = {
  '🇺🇸 美国政治': [
    { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
    { name: 'AP Politics', url: 'https://rsshub.app/apnews/topics/politics' },
  ],
  '🪖 美国军事': [
    { name: 'Defense News', url: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml' },
  ],
  '💰 美国经济': [
    { name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
    { name: 'Reuters Biz', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best' },
    { name: 'CNBC Economy', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
  ],
  '🔬 美国科技': [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  ],
  '🇨🇦 加拿大': [
    { name: 'CBC Top', url: 'https://www.cbc.ca/webfeed/rss/rss-topstories' },
    { name: 'Globe & Mail', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/' },
  ],
  '🏔️ 温哥华': [
    { name: 'CBC BC', url: 'https://www.cbc.ca/webfeed/rss/rss-canada-britishcolumbia' },
    { name: 'Vancouver Sun', url: 'https://vancouversun.com/feed' },
    { name: 'Daily Hive', url: 'https://dailyhive.com/vancouver/feed' },
  ],
  '🏘️ 列治文': [
    { name: 'Richmond News', url: 'https://www.richmond-news.com/cmlink/1.4067622' },
    { name: 'Google Richmond', url: 'https://news.google.com/rss/search?q=Richmond+BC&hl=en-CA&gl=CA&ceid=CA:en' },
  ],
  '🇨🇳 A股': [
    { name: 'Google A股', url: 'https://news.google.com/rss/search?q=A%E8%82%A1+%E8%82%A1%E5%B8%82&hl=zh-CN&gl=CN&ceid=CN:zh-Hans' },
    { name: 'Google China Stock', url: 'https://news.google.com/rss/search?q=China+stock+market+A-shares&hl=en&gl=US&ceid=US:en' },
    { name: 'Google A股板块', url: 'https://news.google.com/rss/search?q=A%E8%82%A1+%E6%9D%BF%E5%9D%97+%E6%B6%A8%E5%81%9C&hl=zh-CN&gl=CN&ceid=CN:zh-Hans' },
  ],
  '🇺🇸 美股': [
    { name: 'MarketWatch Markets', url: 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse' },
    { name: 'CNBC Markets', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069' },
    { name: 'Google US Stock', url: 'https://news.google.com/rss/search?q=US+stock+market+S%26P+500+Nasdaq&hl=en&gl=US&ceid=US:en' },
    { name: 'Yahoo Finance', url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US' },
    { name: 'Google Sectors', url: 'https://news.google.com/rss/search?q=stock+sector+rotation+earnings&hl=en&gl=US&ceid=US:en' },
  ],
  '🇨🇦 加股': [
    { name: 'Google TSX', url: 'https://news.google.com/rss/search?q=TSX+Toronto+stock+exchange+Canada+market&hl=en-CA&gl=CA&ceid=CA:en' },
    { name: 'BNN Bloomberg', url: 'https://www.bnnbloomberg.ca/arc/outboundfeeds/rss/?outputType=xml' },
  ],
  '🤺 击剑花剑': [
    { name: 'Google Fencing Foil', url: 'https://news.google.com/rss/search?q=fencing+foil+FIE+epee+sabre&hl=en&gl=US&ceid=US:en' },
    { name: 'FIE News', url: 'https://fie.org/feed' },
    { name: 'Google 击剑花剑', url: 'https://news.google.com/rss/search?q=%E5%87%BB%E5%89%91+%E8%8A%B1%E5%89%91&hl=zh-CN&gl=CN&ceid=CN:zh-Hans' },
  ],
};

// ============================================================
// UTILS
// ============================================================
function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timer); resolve(data); });
    }).on('error', e => { clearTimeout(timer); reject(e); });
  });
}

function postJson(url, body, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { clearTimeout(timer); resolve(data); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
    req.write(postData);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseRSS(xml) {
  const items = [];
  const rssItems = xml.match(/<item[\s>]([\s\S]*?)<\/item>/gi) || [];
  for (const item of rssItems) {
    const title = clean((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    const link = clean((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1]);
    const pubDate = (item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1];
    const desc = clean((item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1]);
    if (title) items.push({ title, link: link || '', date: pubDate ? new Date(pubDate) : new Date(), desc: desc?.replace(/<[^>]+>/g, '').slice(0, 200) || '' });
  }
  if (items.length === 0) {
    const entries = xml.match(/<entry[\s>]([\s\S]*?)<\/entry>/gi) || [];
    for (const entry of entries) {
      const title = clean((entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
      const link = (entry.match(/<link[^>]*href="([^"]*)"[^>]*rel="alternate"[^>]*>/i) ||
                    entry.match(/<link[^>]*rel="alternate"[^>]*href="([^"]*)"[^>]*>/i) ||
                    entry.match(/<link[^>]*href="([^"]*)"[^>]*>/i) || [])[1];
      const updated = (entry.match(/<(?:updated|published)[^>]*>([\s\S]*?)<\/(?:updated|published)>/i) || [])[1];
      const summary = clean((entry.match(/<(?:summary|content)[^>]*>([\s\S]*?)<\/(?:summary|content)>/i) || [])[1]);
      if (title) items.push({ title, link: link || '', date: updated ? new Date(updated) : new Date(), desc: summary?.replace(/<[^>]+>/g, '').slice(0, 200) || '' });
    }
  }
  return items;
}

function clean(text) {
  if (!text) return '';
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x2019;/g, "'").replace(/&#x2018;/g, "'").replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'").replace(/&#x2014;/g, "—").replace(/&#x2013;/g, "–")
    .replace(/&#\d+;/g, '').replace(/&#x[0-9a-fA-F]+;/g, '').replace(/\n/g, ' ').trim();
}

function escapeHtml(text) {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// TRANSLATION (Google Translate)
// ============================================================
function translateOne(text) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encoded}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const translated = parsed[0].map(s => s[0]).join('');
          resolve(translated || text);
        } catch { resolve(text); }
      });
    }).on('error', () => resolve(text));
  });
}

async function translateBatch(texts) {
  const results = [];
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const translated = await Promise.all(batch.map(t => translateOne(t)));
    results.push(...translated);
    if (i + 10 < texts.length) await sleep(300);
  }
  return results;
}

// ============================================================
// MARKET DATA: US Sectors via Yahoo Finance
// ============================================================
async function fetchUSMarketData() {
  const results = [];
  // Fetch in batches of 6
  for (let i = 0; i < US_SECTOR_ETFS.length; i += 6) {
    const batch = US_SECTOR_ETFS.slice(i, i + 6);
    const promises = batch.map(async (etf) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.symbol}?range=5d&interval=1d`;
        const raw = await fetchUrl(url, 8000);
        const data = JSON.parse(raw);
        const result = data.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quotes = result.indicators?.quote?.[0];
        const timestamps = result.timestamp;

        if (!quotes || !timestamps || timestamps.length < 2) return null;

        const lastIdx = timestamps.length - 1;
        const prevIdx = lastIdx - 1;

        const close = quotes.close?.[lastIdx] || meta.regularMarketPrice;
        const prevClose = quotes.close?.[prevIdx];
        const volume = quotes.volume?.[lastIdx];

        if (!close || !prevClose) return null;

        const change = close - prevClose;
        const changePct = ((change / prevClose) * 100);

        return {
          symbol: etf.symbol,
          name: etf.name,
          price: close,
          change: change,
          changePct: changePct,
          volume: volume,
        };
      } catch (e) {
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
    if (i + 6 < US_SECTOR_ETFS.length) await sleep(500);
  }
  return results;
}

// ============================================================
// MARKET DATA: A-Share via Tushare
// ============================================================
async function fetchAShareData() {
  try {
    // Get latest trade date
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Fetch main indices
    const indexBody = {
      api_name: 'index_daily',
      token: TUSHARE_TOKEN,
      params: { ts_code: '000001.SH', start_date: formatTushareDate(-7), end_date: dateStr },
      fields: 'ts_code,trade_date,close,pre_close,change,pct_chg,vol,amount'
    };

    const indices = [
      { code: '000001.SH', name: '上证指数' },
      { code: '399001.SZ', name: '深证成指' },
      { code: '399006.SZ', name: '创业板指' },
      { code: '000016.SH', name: '上证50' },
      { code: '000300.SH', name: '沪深300' },
      { code: '000905.SH', name: '中证500' },
      { code: '399303.SZ', name: '国证2000' },
    ];

    const results = [];
    for (const idx of indices) {
      try {
        const body = {
          api_name: 'index_daily',
          token: TUSHARE_TOKEN,
          params: { ts_code: idx.code, start_date: formatTushareDate(-10), end_date: dateStr },
          fields: 'ts_code,trade_date,close,pre_close,pct_chg,vol,amount'
        };
        const raw = await postJson('https://api.tushare.pro', body);
        const data = JSON.parse(raw);
        if (data.data?.items?.length > 0) {
          const latest = data.data.items[0];
          const fields = data.data.fields;
          const row = {};
          fields.forEach((f, i) => row[f] = latest[i]);
          results.push({
            name: idx.name,
            code: idx.code,
            close: row.close,
            pctChg: row.pct_chg,
            volume: row.vol,
            amount: row.amount,
            tradeDate: row.trade_date,
          });
        }
      } catch (e) {}
    }

    // Fetch sector/concept data — top movers
    let sectorData = [];
    try {
      // Use Tushare concept/industry API for sector performance
      const sectorBody = {
        api_name: 'ths_daily',
        token: TUSHARE_TOKEN,
        params: { trade_date: results[0]?.tradeDate || dateStr },
        fields: 'ts_code,name,pct_change,trade_date'
      };
      const sectorRaw = await postJson('https://api.tushare.pro', sectorBody);
      const sectorParsed = JSON.parse(sectorRaw);
      if (sectorParsed.data?.items?.length > 0) {
        const fields = sectorParsed.data.fields;
        sectorData = sectorParsed.data.items.map(item => {
          const row = {};
          fields.forEach((f, i) => row[f] = item[i]);
          return row;
        });
        // Sort by absolute change, get top gainers and losers
        sectorData.sort((a, b) => (b.pct_change || 0) - (a.pct_change || 0));
      }
    } catch (e) {}

    // Fetch weekly signals for top sectors using index_weekly
    let sectorSignals = [];
    try {
      // Get major sector index weekly K-lines for signal calculation
      const sectorIndices = [
        { code: '399998.SZ', name: '中证煤炭' }, { code: '399967.SZ', name: '中证军工' },
        { code: '399986.SZ', name: '中证银行' }, { code: '399975.SZ', name: '中证全指证券' },
        { code: '399808.SZ', name: '中证新能' }, { code: '399976.SZ', name: '中证新能车' },
        { code: '399396.SZ', name: '国证食品' }, { code: '399394.SZ', name: '国证医药' },
        { code: '931009.CSI', name: '中证人工智能' }, { code: '399006.SZ', name: '创业板指' },
        { code: '000016.SH', name: '上证50' }, { code: '000905.SH', name: '中证500' },
        { code: '399303.SZ', name: '国证2000' },
      ];
      for (const si of sectorIndices) {
        try {
          const wkBody = {
            api_name: 'index_weekly',
            token: TUSHARE_TOKEN,
            params: { ts_code: si.code, start_date: formatTushareDate(-200), end_date: dateStr },
            fields: 'ts_code,trade_date,close'
          };
          const wkRaw = await postJson('https://api.tushare.pro', wkBody);
          const wkData = JSON.parse(wkRaw);
          if (wkData.data?.items?.length >= 6) {
            const fields = wkData.data.fields;
            const prices = wkData.data.items.map(item => {
              const row = {};
              fields.forEach((f, i) => row[f] = item[i]);
              return { date: row.trade_date, close: row.close };
            }).sort((a, b) => a.date.localeCompare(b.date));
            const bullN = calcSignalN(prices, 4, 30, 'bull');
            const bearN = calcSignalN(prices, 4, 30, 'bear');
            sectorSignals.push({ name: si.name, code: si.code, bullN, bearN });
          }
        } catch (e) {}
      }
    } catch (e) {}

    return { indices: results, sectors: sectorData, sectorSignals };
  } catch (e) {
    console.error('Tushare fetch error:', e.message);
    return { indices: [], sectors: [], sectorSignals: [] };
  }
}

// 乾/坤信号计算（和蝴蝶图逻辑一致）
function calcSignalN(prices, lookback, maxN, type) {
  const n = prices.length;
  if (n < lookback + 2) return 0;
  let count = 0;
  for (let i = 0; i < maxN; i++) {
    const ci = n - 1 - i;
    const ri = ci - lookback;
    if (ri < 0) break;
    if (type === 'bull' ? prices[ci].close > prices[ri].close : prices[ci].close < prices[ri].close) count++;
    else break;
  }
  return count;
}

function formatTushareDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// ============================================================
// AI ANALYSIS (Gemini)
// ============================================================
async function generateMarketAnalysis(newsHeadlines, usMarketData, aShareData) {
  try {
    const usDataSummary = usMarketData.map(d =>
      `${d.name}(${d.symbol}): ${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(2)}%`
    ).join(', ');

    const aShareSummary = aShareData.indices.map(d =>
      `${d.name}: ${d.pctChg >= 0 ? '+' : ''}${d.pctChg?.toFixed(2) || 'N/A'}%`
    ).join(', ');

    const topSectors = aShareData.sectors.slice(0, 10).map(s =>
      `${s.name}: ${s.pct_change >= 0 ? '+' : ''}${s.pct_change?.toFixed(2) || 'N/A'}%`
    ).join(', ');

    const bottomSectors = aShareData.sectors.slice(-10).reverse().map(s =>
      `${s.name}: ${s.pct_change >= 0 ? '+' : ''}${s.pct_change?.toFixed(2) || 'N/A'}%`
    ).join(', ');

    const signalSummary = (aShareData.sectorSignals || []).map(s => {
      const isBull = s.bullN > 0 && s.bullN >= s.bearN;
      const sig = isBull ? `乾${s.bullN}` : (s.bearN > 0 ? `坤${s.bearN}` : '无');
      return `${s.name}: ${sig}`;
    }).join(', ');

    const prompt = `你是一个专业的股市分析师。基于以下今日数据，生成简洁的市场分析。

## 美股板块表现
${usDataSummary || '数据暂无'}

## A股指数表现
${aShareSummary || '数据暂无'}

## A股领涨板块
${topSectors || '数据暂无'}

## A股领跌板块
${bottomSectors || '数据暂无'}

## A股板块周线乾坤信号
${signalSummary || '数据暂无'}
（乾N=连续N周收盘高于4周前=上升趋势，坤N=连续N周低于4周前=下降趋势）

## 今日重要新闻
${newsHeadlines.slice(0, 30).join('\n')}

请生成以下分析（用中文，简洁有力，每个部分3-5句话）：

### 1. 美股板块分析
- 哪些板块异动明显？为什么？
- 关联新闻事件分析
- 短期方向性预测（看多/看空/震荡）

### 2. A股板块分析
- 领涨/领跌板块解读
- 资金流向判断
- 短期方向性预测

### 3. 联动分析
- 美股对A股的传导效应
- 间接事件对两个市场的潜在影响
- 需要关注的风险点

输出格式要求：
- 使用 HTML 格式（不要用 markdown）
- 用 <h3> 做小标题
- 用 <p> 做段落
- 用 <span class="up"> 包裹看涨/正面内容
- 用 <span class="down"> 包裹看跌/负面内容
- 用 <span class="neutral"> 包裹中性内容
- 简洁直接，不要套话废话`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    };

    const raw = await postJson(url, body, 30000);
    const data = JSON.parse(raw);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
  } catch (e) {
    console.error('Gemini analysis error:', e.message);
    return '<p>AI 分析暂时不可用</p>';
  }
}

// ============================================================
// HTML GENERATION
// ============================================================
function generateMarketHtml(usData, aShareData, analysis) {
  let html = '';

  // === US Market Section ===
  if (usData.length > 0) {
    const mainIndices = usData.filter(d => ['SPY', 'QQQ', 'DIA'].includes(d.symbol));
    const sectors = usData.filter(d => !['SPY', 'QQQ', 'DIA', 'GLD', 'USO'].includes(d.symbol));
    const commodities = usData.filter(d => ['GLD', 'USO'].includes(d.symbol));

    // Sort sectors by change
    sectors.sort((a, b) => b.changePct - a.changePct);

    html += `
  <div class="category" id="cat-us-market">
    <div class="category-title">📊 美股板块动态</div>
    <div class="market-grid">
      <div class="market-section">
        <div class="market-subtitle">主要指数</div>
        ${mainIndices.map(d => marketCard(d)).join('')}
      </div>
      <div class="market-section">
        <div class="market-subtitle">板块 ETF（按涨跌排序）</div>
        <div class="sector-heatmap">
          ${sectors.map(d => sectorBlock(d)).join('')}
        </div>
      </div>
      ${commodities.length > 0 ? `
      <div class="market-section">
        <div class="market-subtitle">大宗商品</div>
        ${commodities.map(d => marketCard(d)).join('')}
      </div>` : ''}
    </div>
  </div>`;
  }

  // === A-Share Section ===
  if (aShareData.indices.length > 0) {
    const topGainers = aShareData.sectors.slice(0, 10);
    const topLosers = aShareData.sectors.slice(-10).reverse();

    html += `
  <div class="category" id="cat-a-market">
    <div class="category-title">📊 A股板块动态</div>
    <div class="market-grid">
      <div class="market-section">
        <div class="market-subtitle">主要指数${aShareData.indices[0]?.tradeDate ? ` (${aShareData.indices[0].tradeDate})` : ''}</div>
        ${aShareData.indices.map(d => `
        <div class="market-card ${d.pctChg >= 0 ? 'up' : 'down'}">
          <div class="mc-name">${escapeHtml(d.name)}</div>
          <div class="mc-price">${d.close?.toFixed(2) || 'N/A'}</div>
          <div class="mc-change">${d.pctChg >= 0 ? '+' : ''}${d.pctChg?.toFixed(2) || 'N/A'}%</div>
        </div>`).join('')}
      </div>
      ${topGainers.length > 0 ? `
      <div class="market-section">
        <div class="market-subtitle">🔥 领涨板块 TOP 10</div>
        <div class="sector-list">
          ${topGainers.map((s, i) => `
          <div class="sector-row up">
            <span class="sr-rank">${i + 1}</span>
            <span class="sr-name">${escapeHtml(s.name || '')}</span>
            <span class="sr-change">+${s.pct_change?.toFixed(2) || '0'}%</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
      ${topLosers.length > 0 ? `
      <div class="market-section">
        <div class="market-subtitle">💧 领跌板块 TOP 10</div>
        <div class="sector-list">
          ${topLosers.map((s, i) => `
          <div class="sector-row down">
            <span class="sr-rank">${i + 1}</span>
            <span class="sr-name">${escapeHtml(s.name || '')}</span>
            <span class="sr-change">${s.pct_change?.toFixed(2) || '0'}%</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
      ${(aShareData.sectorSignals?.length > 0) ? `
      <div class="market-section">
        <div class="market-subtitle">🦋 板块乾坤信号（周线）</div>
        <div class="sector-list">
          ${aShareData.sectorSignals.map(s => {
            const isBull = s.bullN > 0 && s.bullN >= s.bearN;
            const sig = isBull ? `乾${s.bullN}` : (s.bearN > 0 ? `坤${s.bearN}` : '无');
            const cls = isBull ? 'up' : (s.bearN > 0 ? 'down' : '');
            return `
          <div class="sector-row ${cls}">
            <span class="sr-name">${escapeHtml(s.name)}</span>
            <span class="sr-change" style="font-weight:bold;">${sig}</span>
          </div>`;
          }).join('')}
        </div>
        <div style="font-size:10px;color:#999;margin-top:4px;">乾N=连续N周收盘价高于4周前 坤N=连续N周低于4周前</div>
      </div>` : ''}
    </div>
  </div>`;
  }

  // === AI Analysis Section ===
  if (analysis) {
    html += `
  <div class="category" id="cat-analysis">
    <div class="category-title">🧠 AI 板块分析与预测</div>
    <div class="analysis-content">
      ${analysis}
    </div>
  </div>`;
  }

  return html;
}

function marketCard(d) {
  const cls = d.changePct >= 0 ? 'up' : 'down';
  return `
  <div class="market-card ${cls}">
    <div class="mc-name">${escapeHtml(d.name)} <span class="mc-symbol">${d.symbol}</span></div>
    <div class="mc-price">$${d.price.toFixed(2)}</div>
    <div class="mc-change">${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(2)}%</div>
  </div>`;
}

function sectorBlock(d) {
  const cls = d.changePct >= 0 ? 'up' : 'down';
  const intensity = Math.min(Math.abs(d.changePct) / 3, 1);
  const bg = d.changePct >= 0
    ? `rgba(46, 160, 67, ${0.15 + intensity * 0.5})`
    : `rgba(248, 81, 73, ${0.15 + intensity * 0.5})`;
  return `<div class="sector-block" style="background:${bg}">
    <div class="sb-name">${escapeHtml(d.name)}</div>
    <div class="sb-change ${cls}">${d.changePct >= 0 ? '+' : ''}${d.changePct.toFixed(2)}%</div>
  </div>`;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const now = new Date();
  const pdtNow = new Date(now - 7 * 3600000);
  const dateStr = pdtNow.toISOString().slice(0, 10);
  const cutoff = new Date(now - 36 * 60 * 60 * 1000);

  console.log(`[${dateStr}] Starting daily news generation...`);

  // Fetch all data in parallel
  const [newsCategories, usMarketData, aShareData] = await Promise.all([
    fetchAllNews(cutoff),
    fetchUSMarketData().catch(e => { console.error('US market error:', e.message); return []; }),
    fetchAShareData().catch(e => { console.error('A-share error:', e.message); return { indices: [], sectors: [] }; }),
  ]);

  // Collect all headlines for AI analysis
  const allHeadlines = [];
  for (const cat of newsCategories) {
    for (const item of cat.items) {
      allHeadlines.push(item.title);
    }
  }

  // Skip Gemini AI analysis (replaced by Claude in cron)
  console.log('Skipping Gemini AI analysis...');
  const analysis = '<p>AI 分析由 Claude 提供，请查看 Telegram 日报。</p>';

  // Generate market data HTML
  const marketHtml = generateMarketHtml(usMarketData, aShareData, analysis);

  // Build the full page
  const html = buildFullHtml(dateStr, pdtNow, newsCategories, marketHtml, usMarketData, aShareData);

  const outputPath = '/home/claudebot/daily-news-output/index.html';
  fs.mkdirSync('/home/claudebot/daily-news-output', { recursive: true });
  fs.writeFileSync(outputPath, html);
  console.log(`Generated: ${html.length} bytes, ${newsCategories.length} news categories, ${usMarketData.length} US ETFs, ${aShareData.indices.length} A-share indices`);
  console.log(`Output: ${outputPath}`);
}

async function fetchAllNews(cutoff) {
  const categories = [];
  for (const [category, feeds] of Object.entries(FEEDS)) {
    let allItems = [];
    for (const feed of feeds) {
      try {
        const xml = await fetchUrl(feed.url);
        const items = parseRSS(xml);
        // Only include items from the last 7 days max
        const maxAge = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recent = items.filter(i => i.date > cutoff);
        const notTooOld = items.filter(i => i.date > maxAge);
        allItems.push(...(recent.length > 0 ? recent : notTooOld.slice(0, 5)));
      } catch (e) {}
    }

    const seen = new Set();
    const unique = [];
    for (const item of allItems) {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
      if (!seen.has(key) && !item.title.toLowerCase().includes('good morning')) {
        seen.add(key);
        unique.push(item);
      }
    }
    unique.sort((a, b) => b.date - a.date);
    const top = unique.slice(0, 8);

    if (top.length > 0) {
      const titles = top.map(i => i.title);
      const translated = await translateBatch(titles);
      top.forEach((item, idx) => { item.titleCn = translated[idx] || item.title; });
      categories.push({ name: category, items: top });
    }
  }
  return categories;
}

function buildFullHtml(dateStr, pdtNow, newsCategories, marketHtml, usMarketData, aShareData) {
  // Build nav tabs — market sections first, then news
  const marketTabs = [];
  if (usMarketData.length > 0) marketTabs.push({ id: 'cat-us-market', name: '📊 美股板块' });
  if (aShareData.indices.length > 0) marketTabs.push({ id: 'cat-a-market', name: '📊 A股板块' });
  marketTabs.push({ id: 'cat-analysis', name: '🧠 AI分析' });

  const newsTabs = newsCategories.map((c, i) => ({ id: `cat-${i}`, name: c.name }));
  const allTabs = [...marketTabs, ...newsTabs];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📰 每日新闻 · ${dateStr}</title>
<style>
:root { --bg: #0d1117; --card: #161b22; --border: #30363d; --text: #e6edf3; --muted: #8b949e; --accent: #58a6ff; --hover: #1f2937; --up-color: #2ea043; --down-color: #f85149; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, 'SF Pro', 'Helvetica Neue', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 0; }
.header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 24px 20px; text-align: center; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; }
.header h1 { font-size: 24px; margin-bottom: 4px; }
.header .date { color: var(--muted); font-size: 14px; }
.nav { display: flex; overflow-x: auto; gap: 8px; padding: 12px 16px; background: var(--card); border-bottom: 1px solid var(--border); position: sticky; top: 72px; z-index: 9; -webkit-overflow-scrolling: touch; }
.nav::-webkit-scrollbar { display: none; }
.nav a { white-space: nowrap; padding: 6px 14px; border-radius: 20px; background: var(--bg); color: var(--muted); text-decoration: none; font-size: 13px; border: 1px solid var(--border); transition: all 0.2s; }
.nav a:hover, .nav a.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.nav a.market-tab { border-color: var(--accent); color: var(--accent); }
.container { max-width: 720px; margin: 0 auto; padding: 16px; }
.category { margin-bottom: 24px; }
.category-title { font-size: 18px; font-weight: 700; padding: 12px 0; border-bottom: 2px solid var(--accent); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
/* News items */
.news-item { background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; overflow: hidden; transition: all 0.2s; }
.news-item:hover { border-color: var(--accent); transform: translateY(-1px); }
.news-title { padding: 14px 16px; cursor: pointer; display: flex; align-items: flex-start; gap: 10px; font-size: 15px; font-weight: 500; }
.news-title .num { color: var(--accent); font-weight: 700; min-width: 20px; }
.news-title .arrow { color: var(--muted); margin-left: auto; transition: transform 0.2s; font-size: 12px; min-width: 16px; }
.news-item.open .news-title .arrow { transform: rotate(90deg); }
.news-detail { display: none; padding: 0 16px 14px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--border); }
.news-item.open .news-detail { display: block; padding-top: 12px; }
.news-detail .desc { margin-bottom: 8px; line-height: 1.5; }
.news-detail .meta { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.news-detail a { color: var(--accent); text-decoration: none; }
.news-detail a:hover { text-decoration: underline; }
.news-detail .orig-title { font-size: 12px; color: var(--muted); margin-bottom: 8px; font-style: italic; }
/* Market styles */
.market-grid { display: flex; flex-direction: column; gap: 16px; }
.market-section { }
.market-subtitle { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 8px; padding-left: 4px; }
.market-card { display: flex; align-items: center; justify-content: space-between; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 6px; }
.market-card.up { border-left: 3px solid var(--up-color); }
.market-card.down { border-left: 3px solid var(--down-color); }
.mc-name { font-weight: 500; font-size: 14px; }
.mc-symbol { color: var(--muted); font-size: 12px; }
.mc-price { font-size: 14px; color: var(--muted); }
.mc-change { font-weight: 700; font-size: 15px; min-width: 70px; text-align: right; }
.market-card.up .mc-change { color: var(--up-color); }
.market-card.down .mc-change { color: var(--down-color); }
/* Sector heatmap */
.sector-heatmap { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 6px; }
.sector-block { border-radius: 8px; padding: 10px 8px; text-align: center; border: 1px solid var(--border); }
.sb-name { font-size: 12px; font-weight: 500; margin-bottom: 2px; }
.sb-change { font-size: 14px; font-weight: 700; }
.sb-change.up { color: var(--up-color); }
.sb-change.down { color: var(--down-color); }
/* Sector list (A-share) */
.sector-list { display: flex; flex-direction: column; gap: 4px; }
.sector-row { display: flex; align-items: center; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; }
.sector-row.up { border-left: 3px solid var(--up-color); }
.sector-row.down { border-left: 3px solid var(--down-color); }
.sr-rank { color: var(--accent); font-weight: 700; min-width: 24px; font-size: 13px; }
.sr-name { flex: 1; font-size: 13px; }
.sr-change { font-weight: 700; font-size: 14px; min-width: 60px; text-align: right; }
.sector-row.up .sr-change { color: var(--up-color); }
.sector-row.down .sr-change { color: var(--down-color); }
/* AI Analysis */
.analysis-content { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; font-size: 14px; line-height: 1.8; }
.analysis-content h3 { color: var(--accent); font-size: 16px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
.analysis-content h3:first-child { margin-top: 0; }
.analysis-content p { margin-bottom: 10px; color: var(--text); }
.analysis-content .up { color: var(--up-color); font-weight: 500; }
.analysis-content .down { color: var(--down-color); font-weight: 500; }
.analysis-content .neutral { color: var(--accent); font-weight: 500; }
.footer { text-align: center; padding: 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); margin-top: 20px; }
@media (prefers-color-scheme: light) {
  :root { --bg: #f6f8fa; --card: #fff; --border: #d0d7de; --text: #1f2328; --muted: #656d76; --accent: #0969da; --up-color: #1a7f37; --down-color: #cf222e; }
}
</style>
</head>
<body>
<div class="header">
  <h1>📰 每日新闻速递</h1>
  <div class="date">${dateStr} · PDT ${pdtNow.toISOString().slice(11, 16)} 更新</div>
</div>
<div class="nav">
${allTabs.map(t => `  <a href="#${t.id}" class="${t.id.includes('market') || t.id.includes('analysis') ? 'market-tab' : ''}" onclick="document.getElementById('${t.id}')?.scrollIntoView({behavior:'smooth',block:'start'})">${t.name}</a>`).join('\n')}
</div>
<div class="container">
${marketHtml}
${newsCategories.map((cat, ci) => `
  <div class="category" id="cat-${ci}">
    <div class="category-title">${cat.name}</div>
    ${cat.items.map((item, ii) => `
    <div class="news-item" onclick="toggle(this)">
      <div class="news-title">
        <span class="num">${ii + 1}</span>
        <span>${escapeHtml(item.titleCn || item.title)}</span>
        <span class="arrow">▶</span>
      </div>
      <div class="news-detail">
        <div class="orig-title">${escapeHtml(item.title)}</div>
        ${item.desc ? `<div class="desc">${escapeHtml(item.desc)}</div>` : ''}
        <div class="meta">
          ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">阅读原文 →</a>` : '<span></span>'}
          <span class="time">${item.date.toISOString().slice(0, 16).replace('T', ' ')}</span>
        </div>
      </div>
    </div>`).join('')}
  </div>`).join('')}
</div>
<div class="footer">🦐 小虾米 · 自动生成 · 数据来自 RSS + Yahoo Finance + Tushare + Claude AI</div>
<script>
function toggle(el) { el.classList.toggle('open'); }
</script>
</body>
</html>`;
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
