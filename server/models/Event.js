const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  location: { 
    address: { type: String, required: true }, 
    city: { type: String, required: true, default: 'Hà Nội' } 
  },
  price: { type: Number, required: true, default: 0 },
  stock: { type: Number, required: true, default: 100 },
  image: { type: String, required: true },
  totalSlots: { type: Number, default: 100 },
  bookedSlots: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByRole: { type: String, enum: ['admin_master', 'admin_support'] },
  recurrence: {
    isRecurring: { type: Boolean, default: false },
    frequency: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    untilDate: { type: Date }
  },
  timezone: { type: String, default: 'Asia/Ho_Chi_Minh' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
