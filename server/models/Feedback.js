const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  feedback: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['new', 'reviewed', 'resolved'], default: 'new' }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
