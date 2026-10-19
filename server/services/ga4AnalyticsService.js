const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
let cachedToken = null;

function getCredentials() {
  const encoded = process.env.GA4_SERVICE_ACCOUNT_BASE64;
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON || (encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '');
  if (!raw || !process.env.GA4_PROPERTY_ID) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken(credentials) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

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

async function runReport(token, body) {
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
  return Number(row.metricValues?.[index]?.value || 0);
}

async function getAnalyticsReport() {
  const credentials = getCredentials();
  if (!credentials) {
    const error = new Error('Chưa cấu hình GA4_PROPERTY_ID và service account trên server.');
    error.code = 'GA4_NOT_CONFIGURED';
    throw error;
  }
  const token = await getAccessToken(credentials);
  const [summary, daily, pages] = await Promise.all([
    runReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    }),
    runReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 30,
    }),
    runReport(token, {
      dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    }),
  ]);

  const summaryRow = summary.rows?.[0];
  const totals = summaryRow ? {
    users: metricValue(summaryRow, 0),
    sessions: metricValue(summaryRow, 1),
    pageViews: metricValue(summaryRow, 2),
    events: metricValue(summaryRow, 3),
  } : { users: 0, sessions: 0, pageViews: 0, events: 0 };

  return {
    totals,
    daily: (daily.rows || []).map(row => ({
      date: row.dimensionValues?.[0]?.value || '',
      users: metricValue(row, 0),
      sessions: metricValue(row, 1),
      pageViews: metricValue(row, 2),
    })),
    pages: (pages.rows || []).map(row => ({
      path: row.dimensionValues?.[0]?.value || '/',
      views: metricValue(row, 0),
      users: metricValue(row, 1),
    })),
    range: '30 ngày gần nhất',
  };
}

module.exports = { getAnalyticsReport };
