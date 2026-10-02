const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  role: { 
    type: String, 
    enum: ['user', 'admin_master', 'admin_support'], 
    default: 'user' 
  },
  status: { type: String, enum: ['Active', 'Banned', 'Inactive'], default: 'Active' },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
