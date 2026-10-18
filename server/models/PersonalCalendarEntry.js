const mongoose = require('mongoose');

const personalCalendarEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  note: { type: String, trim: true, maxlength: 2000, default: '' },
  startAt: { type: Date, required: true },
  endAt: { type: Date, default: null },
  reminderMinutes: { type: Number, enum: [0, 5, 15, 30, 60, 1440], default: 15 },
  reminderSentAt: { type: Date, default: null }
}, { timestamps: true });

personalCalendarEntrySchema.index({ userId: 1, startAt: 1 });

module.exports = mongoose.model('PersonalCalendarEntry', personalCalendarEntrySchema);
