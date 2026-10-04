const express = require('express');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const verifyToken = require('../middleware/verifyToken');
const { quoteOrder, fulfillOrder } = require('../services/checkoutService');
const { createPayOSPayment, getPayOSPayment, verifyPayOSWebhook } = require('../services/paymentGatewayService');
const { completePaidPayment } = require('../services/paymentFulfillmentService');

const router = express.Router();

function createOrderCode() {
  // Date.now() * 100 vẫn nằm trong giới hạn số nguyên an toàn của JavaScript.
  return Date.now() * 100 + crypto.randomInt(0, 100);
}

router.post('/create', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ message: 'Chỉ tài khoản người dùng mới có thể thanh toán.' });
    const provider = String(req.body.provider || 'payos').toLowerCase();
    if (provider !== 'payos') return res.status(400).json({ message: 'Hệ thống hiện chỉ hỗ trợ thanh toán VietQR qua payOS.' });

    const { items, amount } = await quoteOrder(req.body.items);
    if (amount < 1000) return res.status(400).json({ message: 'Cổng thanh toán yêu cầu đơn hàng tối thiểu 1.000₫.' });
    const orderCode = createOrderCode();
    const payment = await Payment.create({ orderCode: String(orderCode), userId: req.user.id, items, amount, provider: 'payos' });

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
        message: 'Đã tạo mã VietQR payOS. Hệ thống sẽ tự động phát hành vé sau khi nhận được xác nhận thanh toán.'
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
    if (req.user.role !== 'user') return res.status(403).json({ message: 'Chỉ tài khoản người dùng mới có thể nhận vé.' });

    const { items, amount } = await quoteOrder(req.body.items);
    if (amount !== 0) {
      return res.status(400).json({ message: 'Đơn hàng có vé trả phí. Vui lòng thanh toán qua VietQR payOS.' });
    }

    const result = await fulfillOrder({
      userId: req.user.id,
      rawItems: items,
      io: req.io,
      paymentMethod: 'local',
      paymentReference: `FREE-${createOrderCode()}`
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

router.get('/status/:orderCode', verifyToken, async (req, res) => {
  let payment = await Payment.findOne({ orderCode: req.params.orderCode, userId: req.user.id });
  if (!payment) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });

  if (payment.status === 'Pending') {
    try {
      const payOSPayment = await getPayOSPayment(payment.orderCode);
      if (payOSPayment.status === 'PAID' && Number(payOSPayment.amountPaid) >= payment.amount) {
        const transaction = payOSPayment.transactions?.[payOSPayment.transactions.length - 1];
        payment = await completePaidPayment({
          payment,
          transactionId: transaction?.reference || payOSPayment.id,
          providerData: payOSPayment,
          io: req.io
        });
      }
    } catch (error) {
      console.error(`Không thể đối soát đơn ${payment.orderCode} với payOS:`, error.message);
    }
  }

  const publicPayment = await Payment.findById(payment._id)
    .select('orderCode amount provider status transactionId tickets paidAt emailSent emailMessage createdAt');
  return res.json(publicPayment);
});

module.exports = router;
