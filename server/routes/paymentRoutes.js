const express = require('express');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const verifyToken = require('../middleware/verifyToken');
const { quoteOrder, fulfillOrder } = require('../services/checkoutService');
const { createPayOSPayment, verifyPayOSWebhook } = require('../services/paymentGatewayService');

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

  const claimedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'Pending' },
    {
      $set: {
        status: 'Processing',
        transactionId: String(webhookData.reference || webhookData.paymentLinkId || ''),
        providerResponse: { ...payment.providerResponse, paidWebhook: webhookData }
      }
    },
    { returnDocument: 'after' }
  );
  if (!claimedPayment) return res.status(200).json({ success: true });

  try {
    const result = await fulfillOrder({
      userId: claimedPayment.userId,
      rawItems: claimedPayment.items,
      io: req.io,
      paymentMethod: 'bank',
      paymentReference: claimedPayment.orderCode
    });
    claimedPayment.status = 'Paid';
    claimedPayment.paidAt = new Date();
    claimedPayment.tickets = result.tickets.map(ticket => ticket._id);
    claimedPayment.emailSent = result.emailSent;
    claimedPayment.emailMessage = result.emailMessage;
    await claimedPayment.save();
    req.io?.emit('payment_updated', { orderCode: claimedPayment.orderCode, status: 'Paid' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Không thể phát hành vé cho đơn ${orderCode}:`, error.message);
    await Payment.findByIdAndUpdate(claimedPayment._id, {
      $set: { status: 'Pending', 'providerResponse.fulfillmentError': error.message }
    });
    return res.status(500).json({ success: false, message: 'Chưa thể phát hành vé, payOS sẽ gửi lại webhook.' });
  }
});

router.get('/status/:orderCode', verifyToken, async (req, res) => {
  const payment = await Payment.findOne({ orderCode: req.params.orderCode, userId: req.user.id })
    .select('orderCode amount provider status transactionId tickets paidAt emailSent emailMessage createdAt');
  if (!payment) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
  return res.json(payment);
});

module.exports = router;
