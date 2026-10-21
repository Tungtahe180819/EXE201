const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
let cachedToken = null;

function getCredentials() {
  if (process.env.GA4_PROPERTY_ID && process.env.GA4_OAUTH_CLIENT_ID && process.env.GA4_OAUTH_CLIENT_SECRET && process.env.GA4_OAUTH_REFRESH_TOKEN) {
    return {
      type: 'oauth',
      clientId: process.env.GA4_OAUTH_CLIENT_ID,
      clientSecret: process.env.GA4_OAUTH_CLIENT_SECRET,
      refreshToken: process.env.GA4_OAUTH_REFRESH_TOKEN,
    };
  }
  const encoded = process.env.GA4_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON || (encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '');
  if (!raw || !process.env.GA4_PROPERTY_ID) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.client_email && parsed.private_key ? { ...parsed, type: 'service-account' } : null;
  } catch {
    return null;
  }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken(credentials) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  if (credentials.type === 'oauth') {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.error_description || payload.error || 'Không thể làm mới quyền truy cập Google Analytics.');
    }
    cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 };
    return cachedToken.value;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: GA4_SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key, 'base64url');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Không thể xác thực Google Analytics.');
  }
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

async function runRealtimeReport(token, body) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(process.env.GA4_PROPERTY_ID)}:runRealtimeReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Không thể đọc báo cáo Google Analytics.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function runStandardReport(token, body) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(process.env.GA4_PROPERTY_ID)}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Không thể đọc báo cáo Google Analytics.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function metricValue(row, index) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function reportTotals(report) {
  const row = report.totals?.[0] || report.rows?.[0];
  return row ? {
    users: metricValue(row, 0),
    pageViews: metricValue(row, 1),
    events: metricValue(row, 2),
  } : { users: 0, pageViews: 0, events: 0 };
}

async function getRealtimeReport(token, window = '30m') {
  // The GA4 Realtime API only exposes the latest 30 minutes. Wider windows use
  // the standard Data API, which is near-current but may lag realtime by minutes.
  if (window === '30m') {
    const [summary, activity, pages, events] = await Promise.all([
      runRealtimeReport(token, { metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }] }),
      runRealtimeReport(token, {
        dimensions: [{ name: 'minutesAgo' }], metrics: [{ name: 'eventCount' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }], minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }], limit: 30,
      }),
      runRealtimeReport(token, {
        dimensions: [{ name: 'unifiedScreenName' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10,
      }),
      runRealtimeReport(token, {
        dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 10,
      }),
    ]);
    const totals = reportTotals(summary);
    const minuteRows = new Map((activity.rows || []).map(row => [Number(row.dimensionValues?.[0]?.value || 0), row]));
    return {
      mode: 'realtime', window, totals,
      activity: Array.from({ length: 30 }, (_, index) => {
        const minutesAgo = 29 - index;
        const row = minuteRows.get(minutesAgo);
        return { minute: minutesAgo === 0 ? 'Hiện tại' : `${minutesAgo} phút trước`, events: metricValue(row, 0), pageViews: metricValue(row, 1) };
      }),
      pages: (pages.rows || []).map(row => ({ path: row.dimensionValues?.[0]?.value || 'Không rõ tiêu đề', views: metricValue(row, 0), users: metricValue(row, 1) })),
      events: (events.rows || []).map(row => ({ name: row.dimensionValues?.[0]?.value || '(not set)', count: metricValue(row, 0) })),
      range: '30 phút gần nhất · GA4 Realtime', refreshedAt: new Date().toISOString(),
    };
  }

  const hours = window === '1d' ? 24 : 1;
  const timeReport = await runStandardReport(token, {
    dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
    dimensions: [{ name: 'dateHour' }],
    metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    orderBys: [{ dimension: { dimensionName: 'dateHour' } }], limit: 48,
  });
  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const timeZone = process.env.GA4_PROPERTY_TIME_ZONE || 'Asia/Ho_Chi_Minh';
  const formatHour = date => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    return `${parts.year}${parts.month}${parts.day}${parts.hour}`;
  };
  const cutoffHour = formatHour(cutoff);
  const rows = (timeReport.rows || []).filter(row => (row.dimensionValues?.[0]?.value || '') >= cutoffHour);
  const hoursInRange = [...new Set(rows.map(row => row.dimensionValues?.[0]?.value).filter(Boolean))];
  const summary = hoursInRange.length ? await runStandardReport(token, {
    dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
    dimensionFilter: {
      filter: {
        fieldName: 'dateHour',
        inListFilter: { values: hoursInRange },
      },
    },
    metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
  }) : null;
  return {
    mode: 'realtime', window,
    totals: summary ? reportTotals(summary) : { users: 0, pageViews: 0, events: 0 },
    activity: rows.map(row => ({ minute: row.dimensionValues?.[0]?.value?.slice(-2) + ':00', events: metricValue(row, 2), pageViews: metricValue(row, 1) })),
    pages: [], events: [],
    range: `${window === '1d' ? '24 giờ' : '1 giờ'} gần nhất · dữ liệu GA4 có thể trễ vài phút`,
    refreshedAt: new Date().toISOString(),
  };
}

async function getStandardAnalyticsReport(token) {
  const [summary, activity, pages, events] = await Promise.all([
    runStandardReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    }),
    runStandardReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }],
      metrics: [{ name: 'eventCount' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 30,
    }),
    runStandardReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10,
    }),
    runStandardReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }], orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }], limit: 10,
    }),
  ]);
  return {
    mode: 'report', totals: reportTotals(summary),
    activity: (activity.rows || []).map(row => ({ minute: row.dimensionValues?.[0]?.value, events: metricValue(row, 0), pageViews: metricValue(row, 1) })),
    pages: (pages.rows || []).map(row => ({ path: row.dimensionValues?.[0]?.value || 'Không rõ tiêu đề', views: metricValue(row, 0), users: metricValue(row, 1) })),
    events: (events.rows || []).map(row => ({ name: row.dimensionValues?.[0]?.value || '(not set)', count: metricValue(row, 0) })),
    range: '30 ngày gần nhất · Báo cáo GA4', refreshedAt: new Date().toISOString(),
  };
}

async function getAnalyticsReport({ mode = 'realtime', window = '30m' } = {}) {
  const credentials = getCredentials();
  if (!credentials) {
    const error = new Error('Chưa cấu hình GA4_PROPERTY_ID và OAuth client credentials trên server.');
    error.code = 'GA4_NOT_CONFIGURED';
    throw error;
  }
  const token = await getAccessToken(credentials);
  if (mode === 'report') return getStandardAnalyticsReport(token);
  return getRealtimeReport(token, ['30m', '1h', '1d'].includes(window) ? window : '30m');
}

module.exports = { getAnalyticsReport };
