const express = require('express');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { quoteOrder, fulfillOrder } = require('../services/checkoutService');
const { createPayOSPayment, getPayOSPayment, verifyPayOSWebhook } = require('../services/paymentGatewayService');
const { completePaidPayment } = require('../services/paymentFulfillmentService');
const { isCustomerRole, isVipActive, VIP_ANNUAL_PRICE } = require('../utils/vip');

const router = express.Router();

function createOrderCode() {
  // Date.now() * 100 vẫn nằm trong giới hạn số nguyên an toàn của JavaScript.
  return Date.now() * 100 + crypto.randomInt(0, 100);
}

async function ensurePaidVipApplied(payment) {
  if (!payment?.vipPlan || payment.status !== 'Paid') return payment;
  const user = await User.findById(payment.userId).select('role status vipExpiresAt');
  if (!user || user.status !== 'Active') return payment;

  // Tự sửa các đơn đã được payOS xác nhận nhưng tiến trình cũ bị ngắt trước
  // khi ghi role/expiry. Nếu role đã là VIP thì không cộng thêm một năm lần nữa.
  if (isVipActive(user)) {
    if (!payment.vipExpiresAt || payment.vipExpiresAt.getTime() !== user.vipExpiresAt.getTime()) {
      payment.vipExpiresAt = user.vipExpiresAt;
      await payment.save();
    }
    return payment;
  }

  const { activateVipForYear } = require('../services/vipService');
  const vip = await activateVipForYear(payment.userId, 'payment');
  payment.vipExpiresAt = vip.vipExpiresAt;
  payment.providerResponse = {
    ...(payment.providerResponse || {}),
    vipRecoveredAt: new Date().toISOString()
  };
  await payment.save();
  return payment;
}

async function reconcileWithPayOS(payment, io) {
  if (payment.status !== 'Pending') return ensurePaidVipApplied(payment);
  const payOSPayment = await getPayOSPayment(payment.orderCode);
  const gatewayStatus = String(payOSPayment.status || '').toUpperCase();
  if (gatewayStatus !== 'PAID') return payment;

  // Một số phiên bản SDK không trả amountPaid dù trạng thái đã là PAID.
  // Chỉ chặn khi cổng thanh toán thực sự trả một số tiền dương thấp hơn đơn hàng.
  const amountPaid = Number(payOSPayment.amountPaid);
  if (Number.isFinite(amountPaid) && amountPaid > 0 && amountPaid < payment.amount) {
    throw new Error(`Số tiền payOS xác nhận (${amountPaid}) thấp hơn giá trị đơn (${payment.amount}).`);
  }

  const transactions = Array.isArray(payOSPayment.transactions) ? payOSPayment.transactions : [];
  const transaction = transactions[transactions.length - 1];
  const completed = await completePaidPayment({
    payment,
    transactionId: transaction?.reference || payOSPayment.id || payOSPayment.paymentLinkId,
    providerData: payOSPayment,
    io
  });
  return ensurePaidVipApplied(completed);
}

async function publicPaymentResponse(payment) {
  const publicPayment = await Payment.findById(payment._id)
    .select('orderCode amount provider purpose vipPlan vipExpiresAt status transactionId tickets paidAt emailSent emailMessage createdAt');
  const user = await User.findById(payment.userId).select('role vipExpiresAt');
  return {
    ...publicPayment.toObject(),
    userRole: user?.role,
    vipExpiresAt: publicPayment.vipExpiresAt || user?.vipExpiresAt || null
  };
}

router.post('/create', verifyToken, async (req, res) => {
  try {
    if (!isCustomerRole(req.user.role)) return res.status(403).json({ message: 'Chỉ tài khoản người dùng mới có thể thanh toán.' });
    const provider = String(req.body.provider || 'payos').toLowerCase();
    if (provider !== 'payos') return res.status(400).json({ message: 'Hệ thống hiện chỉ hỗ trợ thanh toán VietQR qua payOS.' });

    const wantsVip = req.body.vipPlan === true;
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!wantsVip && rawItems.length === 0) return res.status(400).json({ message: 'Giỏ hàng đang trống.' });

    let items = [];
    let ticketAmount = 0;
    if (rawItems.length > 0) {
      const quote = await quoteOrder(rawItems);
      items = quote.items;
      ticketAmount = quote.amount;
    }
    const amount = ticketAmount + (wantsVip ? VIP_ANNUAL_PRICE : 0);
    if (amount < 1000) return res.status(400).json({ message: 'Cổng thanh toán yêu cầu đơn hàng tối thiểu 1.000₫.' });
    const orderCode = createOrderCode();
    const purpose = wantsVip ? (items.length ? 'mixed' : 'vip') : 'tickets';
    const payment = await Payment.create({ orderCode: String(orderCode), userId: req.user.id, items, amount, purpose, vipPlan: wantsVip, provider: 'payos' });

    try {
      const gateway = await createPayOSPayment({ orderCode, amount });
      payment.providerResponse = gateway.providerResponse;
      await payment.save();
      const { providerResponse, ...publicGateway } = gateway;
      return res.status(201).json({
        success: true,
        orderCode: String(orderCode),
        amount,
        ...publicGateway,
        message: wantsVip
          ? 'Đã tạo mã VietQR payOS. Gói VIP sẽ tự động kích hoạt sau khi giao dịch được xác nhận.'
          : 'Đã tạo mã VietQR payOS. Hệ thống sẽ tự động phát hành vé sau khi nhận được xác nhận thanh toán.'
      });
    } catch (error) {
      await Payment.findByIdAndDelete(payment._id);
      throw error;
    }
  } catch (error) {
    console.error('Không thể tạo thanh toán payOS:', error.message);
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post('/free', verifyToken, async (req, res) => {
  try {
    if (!isCustomerRole(req.user.role)) return res.status(403).json({ message: 'Chỉ tài khoản người dùng mới có thể nhận vé.' });

    const { items, amount } = await quoteOrder(req.body.items);
    if (amount !== 0) {
      return res.status(400).json({ message: 'Đơn hàng có vé trả phí. Vui lòng thanh toán qua VietQR payOS.' });
    }

    const result = await fulfillOrder({
      userId: req.user.id,
      rawItems: items,
      io: req.io,
      paymentMethod: 'local',
      paymentReference: `FREE-${createOrderCode()}`,
      waitForEmail: false
    });

    return res.status(201).json({
      success: true,
      free: true,
      status: 'Paid',
      amount: 0,
      ...result,
      message: result.emailSent
        ? 'Nhận vé miễn phí thành công! Vé đã được gửi qua email.'
        : 'Nhận vé miễn phí thành công! Bạn có thể xem vé trong mục Vé của tôi.'
    });
  } catch (error) {
    console.error('Không thể phát hành vé miễn phí:', error.message);
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post('/webhook/payos', async (req, res) => {
  let webhookData;
  try {
    webhookData = await verifyPayOSWebhook(req.body);
  } catch (error) {
    console.error('Webhook payOS không hợp lệ:', error.message);
    return res.status(400).json({ success: false, message: 'Chữ ký webhook không hợp lệ.' });
  }

  const orderCode = String(webhookData.orderCode || '');
  const payment = await Payment.findOne({ orderCode });

  // payOS gửi một giao dịch mẫu khi đăng ký webhook. Luôn phản hồi 2xx nếu chữ ký hợp lệ.
  if (!payment) return res.status(200).json({ success: true });
  if (payment.status === 'Paid') return res.status(200).json({ success: true });

  if (webhookData.code !== '00' || Number(webhookData.amount) !== payment.amount) {
    payment.providerResponse = { ...payment.providerResponse, lastWebhook: webhookData };
    await payment.save();
    return res.status(200).json({ success: true });
  }

  try {
    await completePaidPayment({
      payment,
      transactionId: webhookData.reference || webhookData.paymentLinkId,
      providerData: webhookData,
      io: req.io
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Không thể phát hành vé cho đơn ${orderCode}:`, error.message);
    return res.status(500).json({ success: false, message: 'Chưa thể phát hành vé, payOS sẽ gửi lại webhook.' });
  }
});

// Khôi phục luồng sau khi người dùng thanh toán ở tab/app ngân hàng rồi quay lại
// mà URL orderCode hoặc state trình duyệt đã bị mất.
router.get('/status/latest-vip', verifyToken, async (req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let payment = await Payment.findOne({
    userId: req.user.id,
    vipPlan: true,
    createdAt: { $gte: since },
    status: { $in: ['Pending', 'Processing', 'Paid'] }
  }).sort({ createdAt: -1 });

  if (!payment) return res.status(404).json({ message: 'Không tìm thấy giao dịch VIP gần đây.' });
  try {
    payment = await reconcileWithPayOS(payment, req.io);
  } catch (error) {
    console.error(`Không thể khôi phục đơn VIP ${payment.orderCode}:`, error.message);
  }
  return res.json(await publicPaymentResponse(payment));
});

router.get('/status/:orderCode', verifyToken, async (req, res) => {
  let payment = await Payment.findOne({ orderCode: req.params.orderCode, userId: req.user.id });
  if (!payment) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });

  try {
    payment = await reconcileWithPayOS(payment, req.io);
  } catch (error) {
    console.error(`Không thể đối soát đơn ${payment.orderCode} với payOS:`, error.message);
  }

  return res.json(await publicPaymentResponse(payment));
});

module.exports = router;
