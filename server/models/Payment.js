const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderCode: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [{
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    ticketType: { type: String, default: 'Standard' }
  }],
  amount: { type: Number, required: true, min: 0 },
  provider: { type: String, enum: ['momo', 'vnpay', 'bank'], required: true },
  status: { type: String, enum: ['Pending', 'Processing', 'Paid', 'Failed'], default: 'Pending', index: true },
  transactionId: { type: String, default: '' },
  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
  providerResponse: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
