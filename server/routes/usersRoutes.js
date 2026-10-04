const express = require('express');
const User = require('../models/User');
const { verifyRole } = require('../middleware/auth');
const { VIP_ANNUAL_PRICE, VIP_ROLE, createVipPeriod } = require('../utils/vip');

const router = express.Router();

router.get('/', verifyRole(['admin_master']), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', verifyRole(['admin_master']), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ message: 'Bạn không thể thay đổi quyền hoặc khóa chính tài khoản của mình.' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    if (target.role === 'admin_master') {
      return res.status(403).json({ message: 'Không thể thay đổi tài khoản Admin Master.' });
    }

    const changes = {};
    if (req.body.role !== undefined) {
      if (!['user', VIP_ROLE, 'admin_support'].includes(req.body.role)) return res.status(400).json({ message: 'Role không hợp lệ.' });
      changes.role = req.body.role;
      if (req.body.role === VIP_ROLE) {
        const period = createVipPeriod();
        changes.vipStartedAt = period.startedAt;
        changes.vipExpiresAt = period.expiresAt;
        changes.vipSource = 'manual';
      } else {
        changes.vipStartedAt = null;
        changes.vipExpiresAt = null;
        changes.vipSource = null;
      }
    }
    if (req.body.renewVip === true) {
      if (![VIP_ROLE, 'user'].includes(target.role)) {
        return res.status(400).json({ message: 'Chỉ có thể gia hạn VIP cho tài khoản khách hàng.' });
      }
      const renewalStart = target.vipExpiresAt && target.vipExpiresAt > new Date() ? target.vipExpiresAt : new Date();
      const period = createVipPeriod(renewalStart);
      changes.role = VIP_ROLE;
      changes.vipStartedAt = target.vipStartedAt || new Date();
      changes.vipExpiresAt = period.expiresAt;
      changes.vipSource = 'manual';
    }
    if (req.body.status !== undefined) {
      if (!['Active', 'Banned', 'Inactive'].includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
      changes.status = req.body.status;
    }
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'Không có thay đổi hợp lệ.' });

    const user = await User.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true }).select('-password');
    const message = changes.role === VIP_ROLE
      ? `Đã kích hoạt/gia hạn VIP 1 năm (gói ${VIP_ANNUAL_PRICE.toLocaleString('vi-VN')}đ).`
      : 'Cập nhật tài khoản thành công.';
    return res.json({ message, vipAnnualPrice: VIP_ANNUAL_PRICE, user });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;

