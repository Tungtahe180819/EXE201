const User = require('../models/User');
const Notification = require('../models/Notification');
const { VIP_ROLE, createVipPeriod, isCustomerRole } = require('../utils/vip');

async function activateVipForYear(userId, source = 'payment') {
  const user = await User.findOne({ _id: userId, status: 'Active' });
  if (!user || !isCustomerRole(user.role)) throw new Error('Không tìm thấy tài khoản khách hàng hợp lệ để kích hoạt VIP.');

  const now = new Date();
  const renewalStart = user.role === VIP_ROLE && user.vipExpiresAt && user.vipExpiresAt > now
    ? user.vipExpiresAt
    : now;
  const { expiresAt } = createVipPeriod(renewalStart);

  const updatedUser = await User.findByIdAndUpdate(user._id, {
    $set: {
      role: VIP_ROLE,
      vipStartedAt: user.vipStartedAt || now,
      vipExpiresAt: expiresAt,
      vipSource: source
    }
  }, { returnDocument: 'after', runValidators: true });

  await Notification.create({
    userId: updatedUser._id,
    type: 'system',
    message: `Gói Eventverse VIP đã được kích hoạt đến ${expiresAt.toLocaleDateString('vi-VN')}.`
  });

  return { role: updatedUser.role, vipExpiresAt: updatedUser.vipExpiresAt };
}

module.exports = { activateVipForYear };
