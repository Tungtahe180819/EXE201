const express = require('express');
const Feedback = require('../models/Feedback');
const jwt = require('jsonwebtoken');
const { verifyRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, feedback } = req.body;
    const rating = Number(req.body.rating);
    if (!name || !email || !feedback || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin khảo sát.' });
    let userId;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try { userId = jwt.verify(token, process.env.JWT_SECRET).id; } catch { userId = undefined; }
    }
    await Feedback.create({ userId, name, email, rating, feedback });
    return res.status(201).json({ message: 'Cảm ơn bạn! Ý kiến đã được ghi nhận.' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/', verifyRole(['admin_master', 'admin_support']), async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    return res.json(feedbacks);
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tải danh sách góp ý.' });
  }
});

router.patch('/:id/status', verifyRole(['admin_master', 'admin_support']), async (req, res) => {
  try {
    const status = String(req.body.status || '');
    if (!['new', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái góp ý không hợp lệ.' });
    }
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after', runValidators: true });
    if (!feedback) return res.status(404).json({ message: 'Không tìm thấy góp ý.' });
    return res.json(feedback);
  } catch (error) {
    return res.status(400).json({ message: 'Không thể cập nhật góp ý.' });
  }
});

module.exports = router;
