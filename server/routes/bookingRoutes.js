const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'user') return res.status(403).json({ message: 'Chỉ người dùng mới có thể đặt lịch.' });
  if (!mongoose.isValidObjectId(req.body.eventId)) return res.status(400).json({ message: 'Sự kiện không hợp lệ.' });
  const bookingTime = new Date(req.body.bookingTime);
  if (Number.isNaN(bookingTime.getTime()) || bookingTime <= new Date()) return res.status(400).json({ message: 'Vui lòng chọn thời gian hợp lệ trong tương lai.' });
  const existing = await Booking.findOne({ eventId: req.body.eventId, userId: req.user.id, status: { $ne: 'cancelled' } });
  if (existing) return res.status(409).json({ message: 'Bạn đã đặt lịch cho sự kiện này.' });

  const eventSchedule = await Event.findById(req.body.eventId).select('startDate endDate');
  if (!eventSchedule) return res.status(404).json({ message: 'Sự kiện không tồn tại.' });
  const eventEnd = eventSchedule.endDate || eventSchedule.startDate;
  if (bookingTime < eventSchedule.startDate || bookingTime > eventEnd) {
    return res.status(400).json({ message: 'Khung giờ phải nằm trong thời gian diễn ra sự kiện.' });
  }

  const event = await Event.findOneAndUpdate(
    { _id: req.body.eventId, $expr: { $lt: [{ $ifNull: ['$bookedSlots', 0] }, { $ifNull: ['$totalSlots', 100] }] } },
    { $inc: { bookedSlots: 1 } },
    { returnDocument: 'after' }
  );
  if (!event) return res.status(400).json({ message: 'Sự kiện không tồn tại hoặc đã kín chỗ.' });

  try {
    const booking = await Booking.create({ eventId: event._id, userId: req.user.id, bookingTime });
    req.io.emit('ticket_updated', { eventId: String(event._id), bookedSlots: event.bookedSlots });
    return res.status(201).json({ message: 'Đặt lịch thành công. Khung giờ đã được giữ chỗ.', booking });
  } catch (error) {
    await Event.findByIdAndUpdate(event._id, { $inc: { bookedSlots: -1 } });
    return res.status(400).json({ message: error.message });
  }
});

router.get('/mine', verifyToken, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user.id }).populate('eventId', 'title image location startDate endDate timezone').sort({ bookingTime: 1 });
  return res.json(bookings);
});

router.delete('/:id', verifyToken, async (req, res) => {
  const booking = await Booking.findOneAndUpdate({ _id: req.params.id, userId: req.user.id, status: { $ne: 'cancelled' } }, { status: 'cancelled' }, { returnDocument: 'after' });
  if (!booking) return res.status(404).json({ message: 'Không tìm thấy lịch đặt.' });
  await Event.findByIdAndUpdate(booking.eventId, { $inc: { bookedSlots: -1 } });
  return res.json({ message: 'Đã hủy lịch đặt.' });
});

module.exports = router;
