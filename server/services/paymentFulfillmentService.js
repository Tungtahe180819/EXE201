const Payment = require('../models/Payment');
const { fulfillOrder } = require('./checkoutService');
const { activateVipForYear } = require('./vipService');

async function completePaidPayment({ payment, transactionId, providerData, io }) {
  if (payment.status === 'Paid') return payment;
  const claimedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'Pending' },
    {
      $set: {
        status: 'Processing',
        transactionId: String(transactionId || ''),
        providerResponse: { ...(payment.providerResponse || {}), paidConfirmation: providerData }
      }
    },
    { returnDocument: 'after' }
  );
  if (!claimedPayment) return Payment.findById(payment._id);

  try {
    let result = { tickets: [], emailSent: false, emailMessage: '' };
    if (claimedPayment.items.length > 0) {
      result = await fulfillOrder({
        userId: claimedPayment.userId,
        rawItems: claimedPayment.items,
        io,
        paymentMethod: 'bank',
        paymentReference: claimedPayment.orderCode
      });
    }
    if (claimedPayment.vipPlan) {
      const vip = await activateVipForYear(claimedPayment.userId, 'payment');
      claimedPayment.vipExpiresAt = vip.vipExpiresAt;
      result.emailMessage = result.emailMessage
        ? `${result.emailMessage} Gói VIP đã được kích hoạt đến ${vip.vipExpiresAt.toLocaleDateString('vi-VN')}.`
        : `Gói VIP đã được kích hoạt đến ${vip.vipExpiresAt.toLocaleDateString('vi-VN')}.`;
    }
    claimedPayment.status = 'Paid';
    claimedPayment.paidAt = new Date();
    claimedPayment.tickets = result.tickets.map(ticket => ticket._id);
    claimedPayment.emailSent = result.emailSent;
    claimedPayment.emailMessage = result.emailMessage;
    await claimedPayment.save();
    io?.emit('payment_updated', { orderCode: claimedPayment.orderCode, status: 'Paid' });
    if (claimedPayment.vipPlan) io?.emit('vip_updated', { userId: String(claimedPayment.userId), role: 'user_vip', vipExpiresAt: claimedPayment.vipExpiresAt });
    return claimedPayment;
  } catch (error) {
    await Payment.findByIdAndUpdate(claimedPayment._id, {
      $set: {
        status: 'Pending',
        'providerResponse.fulfillmentError': error.message
      }
    });
    throw error;
  }
}

module.exports = { completePaidPayment };
