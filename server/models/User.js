const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

const userSchema = new mongoose.Schema({
  username: { type: String, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  role: { 
    type: String, 
    enum: ['user', 'user_vip', 'admin_master', 'admin_support'],
    default: 'user' 
  },
  vipStartedAt: { type: Date, default: null },
  vipExpiresAt: { type: Date, default: null },
  vipSource: { type: String, enum: ['manual', 'payment', null], default: null },
  status: { type: String, enum: ['Active', 'Banned', 'Inactive'], default: 'Active' },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
  history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }]
}, { timestamps: true });

// Hash tập trung tại model để mọi luồng dùng user.save() đều không thể lưu mật khẩu thô.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || BCRYPT_HASH_PATTERN.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(String(candidatePassword), this.password);
};

module.exports = mongoose.model('User', userSchema);
