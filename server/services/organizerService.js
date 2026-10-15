const User = require('../models/User');
const Notification = require('../models/Notification');
const { createOrganizerPeriod, isOrganizerActive } = require('../utils/organizerPlan');

async function activateOrganizerMonth(userId) {
  const user = await User.findOne({ _id: userId, status: 'Active' });
  if (!user) throw new Error('Không tìm thấy tài khoản để kích hoạt gói ban tổ chức.');
  const start = isOrganizerActive(user) ? user.organizerExpiresAt : new Date();
  const period = createOrganizerPeriod(start);
  user.organizerStartedAt ||= new Date();
  user.organizerExpiresAt = period.expiresAt;
  await user.save();
  await Notification.create({ userId: user._id, type: 'system', message: `Gói Ban tổ chức đã được kích hoạt đến ${period.expiresAt.toLocaleDateString('vi-VN')}.` });
  return { organizerExpiresAt: period.expiresAt };
}

module.exports = { activateOrganizerMonth };
