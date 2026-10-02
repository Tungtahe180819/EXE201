const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fullName: String,
  bio: String,
  avatar: String,
  phoneNumber: String
});

module.exports = mongoose.model('Profile', profileSchema);