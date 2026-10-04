const Payment = require('../models/Payment');
const { fulfillOrder } = require('./checkoutService');

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
    const result = await fulfillOrder({
      userId: claimedPayment.userId,
      rawItems: claimedPayment.items,
      io,
      paymentMethod: 'bank',
      paymentReference: claimedPayment.orderCode
    });
    claimedPayment.status = 'Paid';
    claimedPayment.paidAt = new Date();
    claimedPayment.tickets = result.tickets.map(ticket => ticket._id);
    claimedPayment.emailSent = result.emailSent;
    claimedPayment.emailMessage = result.emailMessage;
    await claimedPayment.save();
    io?.emit('payment_updated', { orderCode: claimedPayment.orderCode, status: 'Paid' });
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
