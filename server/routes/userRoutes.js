const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const Notification = require('../models/Notification');
const PersonalCalendarEntry = require('../models/PersonalCalendarEntry');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const Itinerary = require('../models/Itinerary');

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

router.get('/calendar', verifyToken, async (req, res) => {
  const entries = await PersonalCalendarEntry.find({ userId: req.user.id }).sort({ startAt: 1 });
  return res.json(entries);
});

router.post('/calendar', verifyToken, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const startAt = new Date(req.body.startAt);
  const endAt = req.body.endAt ? new Date(req.body.endAt) : null;
  const note = String(req.body.note || '').trim();
  const reminderMinutes = Number(req.body.reminderMinutes ?? 15);
  if (!title || Number.isNaN(startAt.getTime()) || (endAt && Number.isNaN(endAt.getTime())) || (endAt && endAt < startAt)) {
    return res.status(400).json({ message: 'Vui lòng nhập tiêu đề và thời gian hợp lệ; giờ kết thúc không được trước giờ bắt đầu.' });
  }
  if (![0, 5, 15, 30, 60, 1440].includes(reminderMinutes)) {
    return res.status(400).json({ message: 'Thời gian nhắc lịch không hợp lệ.' });
  }
  const entry = await PersonalCalendarEntry.create({ userId: req.user.id, title, startAt, endAt, note, reminderMinutes });
  return res.status(201).json(entry);
});

router.delete('/calendar/:id', verifyToken, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Lịch cá nhân không hợp lệ.' });
  const deleted = await PersonalCalendarEntry.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!deleted) return res.status(404).json({ message: 'Không tìm thấy lịch cá nhân.' });
  return res.json({ message: 'Đã xóa lịch cá nhân.' });
});

router.get('/itineraries', verifyToken, async (req, res) => {
  const itineraries = await Itinerary.find({ user: req.user.id }).sort({ createdAt: -1 });
  return res.json(itineraries);
});

router.get('/favorites', verifyToken, async (req, res) => {
  const user = await require('../models/User').findById(req.user.id).populate({ path: 'favoriteEvents', select: 'title category image description startDate endDate location price totalSlots bookedSlots' });
  return res.json(user?.favoriteEvents || []);
});

router.put('/favorites/:eventId', verifyToken, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(400).json({ message: 'Sự kiện không hợp lệ.' });
  const event = await Event.findById(req.params.eventId).select('_id');
  if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
  const user = await require('../models/User').findById(req.user.id).select('favoriteEvents');
  const isFavorite = user.favoriteEvents.some(id => String(id) === String(event._id));
  await require('../models/User').updateOne(
    { _id: req.user.id },
    isFavorite ? { $pull: { favoriteEvents: event._id } } : { $addToSet: { favoriteEvents: event._id } }
  );
  return res.json({ isFavorite: !isFavorite, message: isFavorite ? 'Đã bỏ sự kiện khỏi mục quan tâm.' : 'Đã lưu sự kiện vào mục quan tâm.' });
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

