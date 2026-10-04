require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const { getPayOSPayment } = require('../services/paymentGatewayService');
const { completePaidPayment } = require('../services/paymentFulfillmentService');

async function reconcile() {
  await mongoose.connect(process.env.MONGO_URI);
  const pendingPayments = await Payment.find({ provider: 'payos', status: 'Pending' }).sort({ createdAt: 1 });
  let completed = 0;

  for (const payment of pendingPayments) {
    const payOSPayment = await getPayOSPayment(payment.orderCode);
    if (payOSPayment.status !== 'PAID' || Number(payOSPayment.amountPaid) < payment.amount) continue;
    const transaction = payOSPayment.transactions?.[payOSPayment.transactions.length - 1];
    const result = await completePaidPayment({
      payment,
      transactionId: transaction?.reference || payOSPayment.id,
      providerData: payOSPayment
    });
    if (result.status === 'Paid') completed += 1;
  }

  console.log(`✅ Đã đối soát ${pendingPayments.length} đơn chờ; phát hành vé cho ${completed} đơn đã thanh toán.`);
}

reconcile()
  .catch(error => {
    console.error('❌ Đối soát payOS thất bại:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
