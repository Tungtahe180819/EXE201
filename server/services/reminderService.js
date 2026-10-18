const cron = require('node-cron');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { sendBookingReminder } = require('./emailService');
const { sendSmsReminder } = require('./smsService');
const PersonalCalendarEntry = require('../models/PersonalCalendarEntry');

let scheduledTask;

function startReminderService() {
  if (scheduledTask) return scheduledTask;
  scheduledTask = cron.schedule('* * * * *', async () => {
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000);
    try {
      const personalEntries = await PersonalCalendarEntry.find({
        startAt: { $gte: now, $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        reminderSentAt: null,
        reminderMinutes: { $gt: 0 }
      });
      for (const entry of personalEntries) {
        const reminderAt = new Date(entry.startAt.getTime() - entry.reminderMinutes * 60000);
        if (reminderAt > now) continue;
        const claimed = await PersonalCalendarEntry.findOneAndUpdate(
          { _id: entry._id, reminderSentAt: null },
          { reminderSentAt: now },
          { returnDocument: 'after' }
        );
        if (!claimed) continue;
        await Notification.create({
          userId: entry.userId,
          type: 'reminder',
          message: `Lịch cá nhân “${entry.title}” sẽ bắt đầu lúc ${entry.startAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.${entry.note ? ` Ghi chú: ${entry.note}` : ''}`
        });
      }

      const bookings = await Booking.find({ bookingTime: { $gte: now, $lte: thirtyMinutesLater }, reminderSent: false, status: 'confirmed' }).populate('eventId userId');
      for (const booking of bookings) {
        if (!booking.userId || !booking.eventId) continue;
        const message = `Sự kiện “${booking.eventId.title}” sẽ bắt đầu lúc ${booking.bookingTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`;
        await Notification.create({ userId: booking.userId._id, type: 'reminder', message });
        try {
          if (booking.userId.email) await sendBookingReminder({ booking });
          booking.reminderEmailStatus = booking.userId.email ? 'Sent' : 'Failed';
        } catch (emailError) {
          booking.reminderEmailStatus = 'Failed';
          console.error('Không thể gửi email nhắc lịch:', emailError.message);
        }
        try {
          const sms = await sendSmsReminder({ booking });
          booking.reminderSmsStatus = sms.skipped ? 'Skipped' : 'Sent';
        } catch (smsError) {
          booking.reminderSmsStatus = 'Failed';
          console.error('Không thể gửi SMS nhắc lịch:', smsError.message);
        }
        booking.reminderSent = true;
        await booking.save();
      }
    } catch (error) {
      console.error('Lỗi dịch vụ nhắc lịch:', error.message);
    }
  });
  console.log('⏰ Dịch vụ nhắc lịch đã hoạt động.');
  return scheduledTask;
}

module.exports = { startReminderService };
