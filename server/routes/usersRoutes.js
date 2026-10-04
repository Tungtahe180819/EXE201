const express = require('express');
const User = require('../models/User');
const { verifyRole } = require('../middleware/auth');

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
      if (!['user', 'admin_support'].includes(req.body.role)) return res.status(400).json({ message: 'Role không hợp lệ.' });
      changes.role = req.body.role;
    }
    if (req.body.status !== undefined) {
      if (!['Active', 'Banned', 'Inactive'].includes(req.body.status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
      changes.status = req.body.status;
    }
    if (!Object.keys(changes).length) return res.status(400).json({ message: 'Không có thay đổi hợp lệ.' });

    const user = await User.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true }).select('-password');
    return res.json({ message: 'Cập nhật tài khoản thành công.', user });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;

