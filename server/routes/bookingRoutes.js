const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const verifyToken = require('../middleware/verifyToken');
const { isCustomerRole } = require('../utils/vip');
const crypto = require('crypto');
const { sendAttendanceConfirmation } = require('../services/emailService');
const Notification = require('../models/Notification');
const { isOrganizerActive } = require('../utils/organizerPlan');

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  if (!isCustomerRole(req.user.role)) return res.status(403).json({ message: 'Chỉ người dùng mới có thể đặt lịch.' });
  if (!mongoose.isValidObjectId(req.body.eventId)) return res.status(400).json({ message: 'Sự kiện không hợp lệ.' });
  const event = await Event.findOne({ _id: req.body.eventId, isPublished: { $ne: false } });
  if (!event) return res.status(404).json({ message: 'Sự kiện không tồn tại.' });
  if (new Date(event.startDate) <= new Date()) return res.status(400).json({ message: 'Không thể xác nhận tham gia sự kiện đã bắt đầu.' });
  const existing = await Booking.findOne({ eventId: event._id, userId: req.user.id });
  if (existing?.status !== 'cancelled') return res.status(409).json({ message: 'Bạn đã xác nhận tham gia sự kiện này.' });

  const reservedEvent = await Event.findOneAndUpdate(
    { _id: event._id, $expr: { $lt: [{ $ifNull: ['$bookedSlots', 0] }, { $ifNull: ['$totalSlots', 100] }] } },
    { $inc: { bookedSlots: 1 } },
    { returnDocument: 'after' }
  );
  if (!reservedEvent) return res.status(400).json({ message: 'Sự kiện đã hết chỗ.' });
  try {
    const user = await require('../models/User').findById(req.user.id).select('email name');
    const values = { status: 'confirmed', bookingTime: event.startDate, confirmationCode: crypto.randomBytes(5).toString('hex').toUpperCase(), checkedInAt: null, reminderSent: false };
    const booking = existing
      ? await Booking.findByIdAndUpdate(existing._id, values, { returnDocument: 'after' })
      : await Booking.create({ eventId: event._id, userId: req.user.id, ...values });
    try {
      await Notification.create({ userId: req.user.id, type: 'system', message: `Đã xác nhận tham gia “${event.title}”. Mã check-in: ${booking.confirmationCode}` });
    } catch (notificationError) {
      console.error('Không thể lưu thông báo xác nhận tham gia:', notificationError.message);
    }
    const populated = await Booking.findById(booking._id).populate('eventId', 'title image location startDate endDate timezone');
    let emailSent = false;
    let emailMessage = '';
    try {
      if (user?.email) {
        await sendAttendanceConfirmation({ user, booking: populated });
        emailSent = true;
      } else emailMessage = 'Không tìm thấy email của tài khoản.';
    } catch (error) {
      emailMessage = 'Chưa gửi được email xác nhận. Mã QR vẫn có trong mục Lịch sự kiện của tôi.';
      console.error('Không thể gửi email xác nhận tham gia:', error.message);
    }
    req.io.emit('attendance_updated', { eventId: String(event._id), bookedSlots: reservedEvent.bookedSlots });
    return res.status(201).json({ message: emailSent ? 'Đã xác nhận tham gia và gửi mã check-in qua email.' : 'Đã xác nhận tham gia. ' + emailMessage, booking: populated, emailSent, emailMessage });
  } catch (error) {
    await Event.findByIdAndUpdate(reservedEvent._id, { $inc: { bookedSlots: -1 } });
    return res.status(400).json({ message: error.message });
  }
});

router.get('/event/:eventId/summary', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(400).json({ message: 'Sự kiện không hợp lệ.' });
  const [event, interested, checkedIn] = await Promise.all([
    Event.findById(req.params.eventId).select('totalSlots bookedSlots'),
    Booking.countDocuments({ eventId: req.params.eventId, status: { $ne: 'cancelled' } }),
    Booking.countDocuments({ eventId: req.params.eventId, status: { $ne: 'cancelled' }, checkedInAt: { $ne: null } })
  ]);
  if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
  return res.json({ interested, checkedIn, remaining: Math.max(0, (event.totalSlots || 100) - (event.bookedSlots || 0)) });
});

router.get('/mine', verifyToken, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user.id }).populate('eventId', 'title image location startDate endDate timezone').sort({ bookingTime: 1 });
  return res.json(bookings);
});

function canManageEvent(event, user) {
  return ['admin_master', 'admin_support'].includes(user.role)
    || (isOrganizerActive(user) && String(event.createdBy || '') === String(user.id));
}

router.get('/event/:eventId/attendees.csv', verifyToken, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) return res.status(400).json({ message: 'Sự kiện không hợp lệ.' });
  const event = await Event.findById(req.params.eventId).select('title createdBy');
  if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
  if (!canManageEvent(event, req.user)) return res.status(403).json({ message: 'Bạn không có quyền xuất danh sách tham gia.' });
  const bookings = await Booking.find({ eventId: event._id, status: { $ne: 'cancelled' } }).populate('userId', 'name email phone').sort({ createdAt: 1 });
  const cell = value => {
    let safe = String(value ?? '').replace(/[\r\n]+/g, ' ');
    if (/^[=+\-@]/.test(safe.trim())) safe = `'${safe}`;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [['Tên', 'Email', 'Điện thoại', 'Mã xác nhận', 'Đăng ký lúc', 'Check-in lúc'], ...bookings.map(item => [item.userId?.name, item.userId?.email, item.userId?.phone, item.confirmationCode, item.createdAt?.toISOString(), item.checkedInAt?.toISOString()])];
  const csv = '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="event-attendees-${event._id}.csv"`);
  return res.send(csv);
});

router.post('/event/:eventId/check-in', verifyToken, async (req, res) => {
  const { confirmationCode } = req.body;
  if (!confirmationCode) return res.status(400).json({ message: 'Vui lòng nhập mã check-in.' });
  const event = await Event.findById(req.params.eventId).select('createdBy title');
  if (!event) return res.status(404).json({ message: 'Không tìm thấy sự kiện.' });
  if (!canManageEvent(event, req.user)) return res.status(403).json({ message: 'Bạn không có quyền check-in sự kiện này.' });
  const booking = await Booking.findOneAndUpdate({ eventId: event._id, confirmationCode: String(confirmationCode).trim().toUpperCase(), status: 'confirmed', checkedInAt: null }, { checkedInAt: new Date() }, { returnDocument: 'after' }).populate('userId', 'name email');
  if (!booking) return res.status(404).json({ message: 'Mã không hợp lệ hoặc đã được sử dụng.' });
  return res.json({ message: 'Check-in thành công.', attendee: booking.userId?.name || booking.userId?.email, checkedInAt: booking.checkedInAt });
});

router.delete('/:id', verifyToken, async (req, res) => {
  const booking = await Booking.findOneAndUpdate({ _id: req.params.id, userId: req.user.id, status: { $ne: 'cancelled' } }, { status: 'cancelled' }, { returnDocument: 'after' });
  if (!booking) return res.status(404).json({ message: 'Không tìm thấy lịch đặt.' });
  await Event.findByIdAndUpdate(booking.eventId, { $inc: { bookedSlots: -1 } });
  return res.json({ message: 'Đã hủy lịch đặt.' });
});

module.exports = router;
