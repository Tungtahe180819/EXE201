const express = require('express');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { quoteOrder, fulfillOrder } = require('../services/checkoutService');
const { createMomoPayment, createVnpayPayment, createBankQr, verifyMomoCallback, verifyVnpayCallback } = require('../services/paymentGatewayService');

const router = express.Router();

async function completePayment(payment, transactionId, providerResponse, io) {
  if (payment.status === 'Paid') return payment;
  const locked = await Payment.findOneAndUpdate({ _id: payment._id, status: 'Pending' }, { status: 'Processing' }, { returnDocument: 'after' });
  if (!locked) return Payment.findById(payment._id);
  try {
    const result = await fulfillOrder({ userId: locked.userId, rawItems: locked.items, io, paymentMethod: locked.provider, paymentReference: transactionId });
    return Payment.findByIdAndUpdate(locked._id, { status: 'Paid', transactionId, tickets: result.tickets.map(ticket => ticket._id), providerResponse }, { returnDocument: 'after' });
  } catch (error) {
    await Payment.findByIdAndUpdate(locked._id, { status: 'Failed', providerResponse: { error: error.message, callback: providerResponse } });
    throw error;
  }
}

router.post('/create', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') return res.status(403).json({ message: 'Chỉ tài khoản người dùng mới có thể thanh toán.' });
    const provider = String(req.body.provider || '').toLowerCase();
    if (!['momo', 'vnpay', 'bank'].includes(provider)) return res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ.' });
    const { items, amount } = await quoteOrder(req.body.items);
    if (amount < 1000) return res.status(400).json({ message: 'Cổng thanh toán yêu cầu đơn hàng tối thiểu 1.000₫.' });
    const user = await User.findById(req.user.id).select('name email');
    if (!user) return res.status(401).json({ message: 'Không tìm thấy tài khoản.' });
    const orderCode = `EV${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
    const payment = await Payment.create({ orderCode, userId: req.user.id, items, amount, provider });
    let gateway;
    try {
      if (provider === 'momo') gateway = await createMomoPayment({ orderCode, amount, user });
      if (provider === 'vnpay') gateway = createVnpayPayment({ orderCode, amount, ipAddress: req.ip?.replace('::ffff:', '') });
      if (provider === 'bank') gateway = await createBankQr({ orderCode, amount });
      payment.providerResponse = gateway.providerResponse;
      await payment.save();
    } catch (error) {
      await Payment.findByIdAndDelete(payment._id);
      throw error;
    }
    return res.status(201).json({ success: true, orderCode, amount, ...gateway, message: provider === 'bank' ? 'Đã tạo mã chuyển khoản. Vé được phát hành sau khi giao dịch được xác nhận.' : 'Đã tạo phiên thanh toán.' });
  } catch (error) {
    return res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.get('/verify/momo', verifyToken, async (req, res) => {
  try {
    if (!verifyMomoCallback(req.query)) return res.status(400).json({ message: 'Chữ ký MoMo không hợp lệ.' });
    const payment = await Payment.findOne({ orderCode: req.query.orderId, userId: req.user.id, provider: 'momo' });
    if (!payment || Number(payment.amount) !== Number(req.query.amount)) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
    if (Number(req.query.resultCode) !== 0) return res.status(400).json({ message: req.query.message || 'Thanh toán MoMo không thành công.' });
    const completed = await completePayment(payment, String(req.query.transId || ''), req.query, req.io);
    return res.json({ success: true, status: completed.status, message: 'Thanh toán MoMo thành công, vé đã được phát hành.' });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
});

router.post('/momo/ipn', async (req, res) => {
  try {
    if (!verifyMomoCallback(req.body)) return res.status(400).json({ resultCode: 1001, message: 'Invalid signature' });
    const payment = await Payment.findOne({ orderCode: req.body.orderId, provider: 'momo' });
    if (!payment || Number(payment.amount) !== Number(req.body.amount)) return res.status(404).json({ resultCode: 1002, message: 'Order not found' });
    if (Number(req.body.resultCode) === 0) await completePayment(payment, String(req.body.transId || ''), req.body, req.io);
    else await Payment.findByIdAndUpdate(payment._id, { status: 'Failed', providerResponse: req.body });
    return res.json({ resultCode: 0, message: 'Success' });
  } catch (error) { return res.status(500).json({ resultCode: 1000, message: error.message }); }
});

router.get('/verify/vnpay', verifyToken, async (req, res) => {
  try {
    if (!verifyVnpayCallback(req.query)) return res.status(400).json({ message: 'Chữ ký VNPAY không hợp lệ.' });
    const payment = await Payment.findOne({ orderCode: req.query.vnp_TxnRef, userId: req.user.id, provider: 'vnpay' });
    if (!payment || Math.round(payment.amount * 100) !== Number(req.query.vnp_Amount)) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
    if (req.query.vnp_ResponseCode !== '00' || req.query.vnp_TransactionStatus !== '00') return res.status(400).json({ message: 'Thanh toán VNPAY không thành công.' });
    const completed = await completePayment(payment, String(req.query.vnp_TransactionNo || ''), req.query, req.io);
    return res.json({ success: true, status: completed.status, message: 'Thanh toán VNPAY thành công, vé đã được phát hành.' });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message }); }
});

router.get('/vnpay/ipn', async (req, res) => {
  try {
    if (!verifyVnpayCallback(req.query)) return res.json({ RspCode: '97', Message: 'Invalid signature' });
    const payment = await Payment.findOne({ orderCode: req.query.vnp_TxnRef, provider: 'vnpay' });
    if (!payment) return res.json({ RspCode: '01', Message: 'Order not found' });
    if (Math.round(payment.amount * 100) !== Number(req.query.vnp_Amount)) return res.json({ RspCode: '04', Message: 'Invalid amount' });
    if (req.query.vnp_ResponseCode === '00' && req.query.vnp_TransactionStatus === '00') await completePayment(payment, String(req.query.vnp_TransactionNo || ''), req.query, req.io);
    else await Payment.findByIdAndUpdate(payment._id, { status: 'Failed', providerResponse: req.query });
    return res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (error) { return res.json({ RspCode: '99', Message: error.message }); }
});

router.get('/status/:orderCode', verifyToken, async (req, res) => {
  const payment = await Payment.findOne({ orderCode: req.params.orderCode, userId: req.user.id }).select('orderCode amount provider status transactionId createdAt');
  if (!payment) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
  return res.json(payment);
});

module.exports = router;
