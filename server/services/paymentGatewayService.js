const crypto = require('crypto');

function requireEnv(keys, provider) {
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length) {
    const error = new Error(`${provider} chưa được cấu hình. Thiếu: ${missing.join(', ')}`);
    error.status = 503;
    throw error;
  }
}

function hmac(algorithm, secret, value) {
  return crypto.createHmac(algorithm, secret).update(value, 'utf8').digest('hex');
}

function formatVnDate(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const part = value => String(value).padStart(2, '0');
  return `${vn.getUTCFullYear()}${part(vn.getUTCMonth() + 1)}${part(vn.getUTCDate())}${part(vn.getUTCHours())}${part(vn.getUTCMinutes())}${part(vn.getUTCSeconds())}`;
}

function encodeVnpay(params) {
  return Object.keys(params).sort().map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key])).replace(/%20/g, '+')}`).join('&');
}

async function createMomoPayment({ orderCode, amount, user }) {
  requireEnv(['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'], 'MoMo');
  const baseUrl = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 9999}`;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const requestId = orderCode;
  const orderInfo = `Thanh toan ve Eventverse ${orderCode}`;
  const redirectUrl = `${clientUrl}/payment-result?provider=momo`;
  const ipnUrl = `${baseUrl}/api/payments/momo/ipn`;
  const extraData = '';
  const requestType = 'payWithMethod';
  const rawSignature = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderCode}&orderInfo=${orderInfo}&partnerCode=${process.env.MOMO_PARTNER_CODE}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const payload = {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    partnerName: 'Eventverse', storeId: 'Eventverse', requestId,
    amount, orderId: orderCode, orderInfo, redirectUrl, ipnUrl,
    requestType, extraData, autoCapture: true, lang: 'vi',
    userInfo: { email: user.email, name: user.name || user.email },
    signature: hmac('sha256', process.env.MOMO_SECRET_KEY, rawSignature)
  };
  const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || data.resultCode !== 0 || !data.payUrl) throw new Error(data.message || `MoMo trả về HTTP ${response.status}`);
  return { paymentUrl: data.payUrl, providerResponse: data };
}

function createVnpayPayment({ orderCode, amount, ipAddress }) {
  requireEnv(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'], 'VNPAY');
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const now = new Date();
  const params = {
    vnp_Version: '2.1.0', vnp_Command: 'pay', vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(amount * 100), vnp_CurrCode: 'VND',
    vnp_TxnRef: orderCode, vnp_OrderInfo: `Thanh toan ve Eventverse ${orderCode}`,
    vnp_OrderType: 'other', vnp_Locale: 'vn', vnp_ReturnUrl: `${clientUrl}/payment-result?provider=vnpay`,
    vnp_IpAddr: ipAddress || '127.0.0.1', vnp_CreateDate: formatVnDate(now),
    vnp_ExpireDate: formatVnDate(new Date(now.getTime() + 15 * 60 * 1000))
  };
  const signedData = encodeVnpay(params);
  const signature = hmac('sha512', process.env.VNPAY_HASH_SECRET, signedData);
  const endpoint = process.env.VNPAY_ENDPOINT || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  return { paymentUrl: `${endpoint}?${signedData}&vnp_SecureHash=${signature}`, providerResponse: { createdAt: now } };
}

async function createBankQr({ orderCode, amount }) {
  requireEnv(['VIETQR_CLIENT_ID', 'VIETQR_API_KEY', 'BANK_ACCOUNT_NO', 'BANK_ACQ_ID', 'BANK_ACCOUNT_NAME'], 'VietQR');
  const response = await fetch('https://api.vietqr.io/v2/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client-id': process.env.VIETQR_CLIENT_ID, 'x-api-key': process.env.VIETQR_API_KEY },
    body: JSON.stringify({
      accountNo: process.env.BANK_ACCOUNT_NO,
      accountName: process.env.BANK_ACCOUNT_NAME,
      acqId: Number(process.env.BANK_ACQ_ID), amount,
      addInfo: orderCode.slice(0, 25), template: 'compact2'
    }),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json();
  if (!response.ok || data.code !== '00' || !data.data?.qrDataURL) throw new Error(data.desc || 'Không tạo được mã VietQR.');
  return { qrDataURL: data.data.qrDataURL, description: orderCode, providerResponse: { code: data.code, desc: data.desc } };
}

function verifyMomoCallback(data) {
  requireEnv(['MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'], 'MoMo');
  const raw = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${data.amount}&extraData=${data.extraData || ''}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;
  const expected = hmac('sha256', process.env.MOMO_SECRET_KEY, raw);
  const received = String(data.signature || '');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function verifyVnpayCallback(query) {
  requireEnv(['VNPAY_HASH_SECRET'], 'VNPAY');
  const params = { ...query };
  const received = String(params.vnp_SecureHash || '');
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  const expected = hmac('sha512', process.env.VNPAY_HASH_SECRET, encodeVnpay(params));
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

module.exports = { createMomoPayment, createVnpayPayment, createBankQr, verifyMomoCallback, verifyVnpayCallback };
