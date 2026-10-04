const QRCode = require('qrcode');
const { PayOS } = require('@payos/node');

function requireEnv(keys, provider = 'payOS') {
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length) {
    const error = new Error(`${provider} chưa được cấu hình. Thiếu: ${missing.join(', ')}`);
    error.status = 503;
    throw error;
  }
}

function getPayOS() {
  requireEnv(['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY']);
  return new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY
  });
}

function getClientUrl() {
  return String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

async function createPayOSPayment({ orderCode, amount }) {
  const numericOrderCode = Number(orderCode);
  if (!Number.isSafeInteger(numericOrderCode) || numericOrderCode <= 0) {
    throw new Error('Mã đơn hàng payOS không hợp lệ.');
  }

  const clientUrl = getClientUrl();
  const description = `EV${numericOrderCode}`.slice(0, 25);
  const expiredAt = Math.floor(Date.now() / 1000) + 15 * 60;
  const paymentLink = await getPayOS().paymentRequests.create({
    orderCode: numericOrderCode,
    amount: Math.round(amount),
    description,
    returnUrl: `${clientUrl}/cart?orderCode=${numericOrderCode}`,
    cancelUrl: `${clientUrl}/cart?orderCode=${numericOrderCode}&cancelled=1`,
    expiredAt
  });
  const qrDataURL = await QRCode.toDataURL(paymentLink.qrCode, { width: 520, margin: 2 });
  const bankInfo = {
    bankBin: paymentLink.bin,
    accountNo: paymentLink.accountNumber,
    accountName: paymentLink.accountName
  };

  return {
    qrDataURL,
    checkoutUrl: paymentLink.checkoutUrl,
    description: paymentLink.description,
    bankInfo,
    expiresAt: paymentLink.expiredAt || expiredAt,
    providerResponse: {
      type: 'payos',
      paymentLinkId: paymentLink.paymentLinkId,
      checkoutUrl: paymentLink.checkoutUrl,
      status: paymentLink.status,
      bankInfo,
      expiresAt: paymentLink.expiredAt || expiredAt
    }
  };
}

async function verifyPayOSWebhook(payload) {
  return getPayOS().webhooks.verify(payload);
}

async function getPayOSPayment(orderCode) {
  const numericOrderCode = Number(orderCode);
  if (!Number.isSafeInteger(numericOrderCode) || numericOrderCode <= 0) {
    throw new Error('Mã đơn hàng payOS không hợp lệ.');
  }
  return getPayOS().paymentRequests.get(numericOrderCode);
}

async function confirmPayOSWebhook(webhookUrl) {
  return getPayOS().webhooks.confirm(webhookUrl);
}

module.exports = { createPayOSPayment, getPayOSPayment, verifyPayOSWebhook, confirmPayOSWebhook };
