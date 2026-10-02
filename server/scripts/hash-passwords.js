require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

const HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI trong server/.env');
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find().select('+password');
  let migrated = 0;
  for (const user of users) {
    if (!HASH_PATTERN.test(user.password || '')) {
      user.markModified('password');
      await user.save();
      migrated += 1;
    }
  }
  console.log(`Hoàn tất: đã hash ${migrated}/${users.length} mật khẩu chưa được mã hóa.`);
}

main()
  .catch(error => {
    console.error('Không thể chuyển đổi mật khẩu:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
