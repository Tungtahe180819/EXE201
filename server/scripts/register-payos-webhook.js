require('dotenv').config();
const { confirmPayOSWebhook } = require('../services/paymentGatewayService');

async function registerWebhook() {
  const publicUrl = String(process.env.SERVER_PUBLIC_URL || '').replace(/\/$/, '');
  if (!publicUrl || !/^https:\/\//i.test(publicUrl)) {
    throw new Error('SERVER_PUBLIC_URL phải là URL HTTPS công khai của server Render.');
  }
  const webhookUrl = `${publicUrl}/api/payments/webhook/payos`;
  const result = await confirmPayOSWebhook(webhookUrl);
  console.log(`✅ Đã đăng ký webhook payOS: ${webhookUrl}`);
  console.log(result);
}

registerWebhook().catch(error => {
  console.error('❌ Không thể đăng ký webhook payOS:', error.message);
  process.exitCode = 1;
});
