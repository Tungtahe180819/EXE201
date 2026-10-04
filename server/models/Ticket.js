const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketCode: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  quantity: { type: Number, required: true, min: 1, max: 20 },
  totalPrice: { type: Number, required: true, min: 0 },
  ticketType: { type: String, default: 'Standard' },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Cancelled'], default: 'Confirmed' },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' },
  paidAt: { type: Date },
  paymentMethod: { type: String, enum: ['local', 'bank'], default: 'local' },
  paymentReference: { type: String, default: '' },
  emailDeliveryStatus: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' },
  emailSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', ticketSchema);
