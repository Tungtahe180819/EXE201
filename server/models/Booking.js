const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'confirmed' },
  reminderSent: { type: Boolean, default: false },
  reminderEmailStatus: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' },
  reminderSmsStatus: { type: String, enum: ['Pending', 'Sent', 'Failed', 'Skipped'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
