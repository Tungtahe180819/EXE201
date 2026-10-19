const { getAnalyticsReport } = require('../services/ga4AnalyticsService');

async function getAnalytics(req, res) {
  try {
    res.json(await getAnalyticsReport());
  } catch (error) {
    if (error.code === 'GA4_NOT_CONFIGURED') {
      return res.status(503).json({ code: error.code, message: error.message });
    }
    console.error('GA4 report error:', error.message);
    return res.status(502).json({ message: 'Không tải được báo cáo GA4. Hãy kiểm tra cấu hình và quyền truy cập của service account.' });
  }
}

module.exports = { getAnalytics };
