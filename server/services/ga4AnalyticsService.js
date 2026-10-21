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

function metricValue(row, index) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

async function getAnalyticsReport() {
  const credentials = getCredentials();
  if (!credentials) {
    const error = new Error('Chưa cấu hình GA4_PROPERTY_ID và OAuth client credentials trên server.');
    error.code = 'GA4_NOT_CONFIGURED';
    throw error;
  }
  const token = await getAccessToken(credentials);
  const [summary, activity, pages, events] = await Promise.all([
    runRealtimeReport(token, {
      metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    }),
    runRealtimeReport(token, {
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'eventCount' }, { name: 'screenPageViews' }],
      orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }],
      minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
      limit: 30,
    }),
    runRealtimeReport(token, {
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    }),
    runRealtimeReport(token, {
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10,
    }),
  ]);

  const summaryRow = summary.totals?.[0] || summary.rows?.[0];
  const totals = summaryRow ? {
    users: metricValue(summaryRow, 0),
    pageViews: metricValue(summaryRow, 1),
    events: metricValue(summaryRow, 2),
  } : { users: 0, pageViews: 0, events: 0 };

  const minuteRows = new Map((activity.rows || []).map(row => [
    Number(row.dimensionValues?.[0]?.value || 0),
    row,
  ]));

  return {
    totals,
    activity: Array.from({ length: 30 }, (_, index) => {
      const minutesAgo = 29 - index;
      const row = minuteRows.get(minutesAgo);
      return {
        minute: minutesAgo === 0 ? 'Hiện tại' : `${minutesAgo} phút trước`,
        events: metricValue(row, 0),
        pageViews: metricValue(row, 1),
      };
    }),
    pages: (pages.rows || []).map(row => ({
      path: row.dimensionValues?.[0]?.value || 'Không rõ tiêu đề',
      views: metricValue(row, 0),
      users: metricValue(row, 1),
    })),
    events: (events.rows || []).map(row => ({
      name: row.dimensionValues?.[0]?.value || '(not set)',
      count: metricValue(row, 0),
    })),
    range: '30 phút gần nhất',
    refreshedAt: new Date().toISOString(),
  };
}

module.exports = { getAnalyticsReport };
