const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const Notification = require('../models/Notification');

const router = express.Router();

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('history');
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng!' });
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, avatar, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, avatar, bio },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng!' });
    return res.status(200).json({ message: 'Cập nhật hồ sơ thành công!', user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/notifications', verifyToken, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
  return res.json(notifications);
});

router.patch('/notifications/:id/read', verifyToken, async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true }, { returnDocument: 'after' });
  if (!notification) return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
  return res.json(notification);
});

module.exports = router;

