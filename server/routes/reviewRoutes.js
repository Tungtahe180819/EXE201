const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Event = require('../models/Event');
const verifyToken = require('../middleware/verifyToken');
const { isCustomerRole } = require('../utils/vip');

const router = express.Router();

router.get('/event/:eventId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(400).json({ message: 'Mã sự kiện không hợp lệ.' });
  const reviews = await Review.find({ eventId: req.params.eventId }).populate('userId', 'name avatar').sort({ createdAt: -1 });
  const summary = await Review.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(req.params.eventId) } },
    { $group: { _id: null, average: { $avg: '$rating' }, total: { $sum: 1 } } }
  ]);
  return res.json({ reviews, average: summary[0]?.average || 0, total: summary[0]?.total || 0 });
});

router.post('/event/:eventId', verifyToken, async (req, res) => {
  try {
    if (!isCustomerRole(req.user.role)) return res.status(403).json({ message: 'Chỉ người dùng mới có thể đánh giá.' });
    if (!mongoose.isValidObjectId(req.params.eventId) || !(await Event.exists({ _id: req.params.eventId }))) return res.status(404).json({ message: 'Sự kiện không tồn tại.' });
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) return res.status(400).json({ message: 'Vui lòng nhập nhận xét và chọn từ 1 đến 5 sao.' });
    const review = await Review.findOneAndUpdate(
      { eventId: req.params.eventId, userId: req.user.id },
      { rating, comment },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
    ).populate('userId', 'name avatar');
    return res.status(201).json({ message: 'Đã lưu đánh giá của bạn.', review });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  const query = req.user.role === 'admin_master' ? { _id: req.params.id } : { _id: req.params.id, userId: req.user.id };
  const deleted = await Review.findOneAndDelete(query);
  if (!deleted) return res.status(404).json({ message: 'Không tìm thấy đánh giá hoặc bạn không có quyền xóa.' });
  return res.json({ message: 'Đã xóa đánh giá.' });
});

module.exports = router;
