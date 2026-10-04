const crypto = require('crypto');
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendTicketConfirmation } = require('./emailService');

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('Giỏ hàng đang trống.');
  const combined = new Map();
  for (const item of rawItems) {
    if (!mongoose.isValidObjectId(item.eventId)) throw new Error('Có sự kiện không hợp lệ trong giỏ hàng.');
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Mỗi sự kiện chỉ được mua từ 1 đến 20 vé.');
    const key = String(item.eventId);
    const current = combined.get(key) || { eventId: key, quantity: 0, ticketType: item.ticketType };
    current.quantity += quantity;
    if (current.quantity > 20) throw new Error('Mỗi sự kiện chỉ được mua tối đa 20 vé.');
    combined.set(key, current);
  }
  return [...combined.values()];
}

async function quoteOrder(rawItems) {
  const items = normalizeItems(rawItems);
  const events = await Event.find({ _id: { $in: items.map(item => item.eventId) } });
  if (events.length !== items.length) throw new Error('Có sự kiện không còn tồn tại.');
  const byId = new Map(events.map(event => [String(event._id), event]));
  let amount = 0;
  for (const item of items) {
    const event = byId.get(item.eventId);
    const available = (event.totalSlots || 100) - (event.bookedSlots || 0);
    if (available < item.quantity) throw new Error(`Sự kiện “${event.title}” không còn đủ vé.`);
    amount += Number(event.price || 0) * item.quantity;
    item.ticketType ||= event.category || 'Standard';
  }
  return { items, amount };
}

async function fulfillOrder({ userId, rawItems, io, paymentMethod = 'local', paymentReference = '' }) {
  const items = normalizeItems(rawItems);
  const user = await User.findOne({ _id: userId, status: 'Active' }).select('name email');
  if (!user) throw new Error('Tài khoản không tồn tại hoặc đã bị khóa.');

  const reservations = [];
  const createdTickets = [];
  try {
    for (const item of items) {
      const event = await Event.findOneAndUpdate({
        _id: item.eventId,
        $expr: { $lte: [{ $add: [{ $ifNull: ['$bookedSlots', 0] }, item.quantity] }, { $ifNull: ['$totalSlots', 100] }] }
      }, { $inc: { bookedSlots: item.quantity } }, { returnDocument: 'after' });
      if (!event) throw new Error('Sự kiện không tồn tại hoặc không còn đủ vé.');
      reservations.push({ eventId: event._id, quantity: item.quantity });
      const ticket = await Ticket.create({
        ticketCode: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        userId, eventId: event._id, quantity: item.quantity,
        totalPrice: event.price * item.quantity,
        ticketType: item.ticketType || event.category || 'Standard',
        status: 'Confirmed', paymentStatus: 'Paid', paidAt: new Date(),
        paymentMethod, paymentReference
      });
      createdTickets.push(ticket);
      io?.emit('ticket_updated', { eventId: String(event._id), bookedSlots: event.bookedSlots });
    }
    await User.findByIdAndUpdate(userId, { $addToSet: { history: { $each: createdTickets.map(ticket => ticket._id) } } });
    const populatedTickets = await Ticket.find({ _id: { $in: createdTickets.map(ticket => ticket._id) } })
      .populate('eventId', 'title image startDate location').sort({ createdAt: -1 });
    const total = createdTickets.reduce((sum, ticket) => sum + ticket.totalPrice, 0);
    await Notification.create({
      userId: user._id,
      type: 'purchase',
      message: total === 0
        ? `Nhận thành công ${createdTickets.length} mã vé miễn phí.`
        : `Thanh toán thành công ${createdTickets.length} mã vé. Tổng tiền: ${total.toLocaleString('vi-VN')}₫.`
    });

    let emailSent = false;
    let emailMessage = 'Thanh toán thành công nhưng chưa gửi được email. Bạn vẫn có thể xem vé trong mục Vé của tôi.';
    try {
      await sendTicketConfirmation({ user, tickets: populatedTickets });
      emailSent = true;
      emailMessage = `Mã vé đã được gửi tới ${user.email}.`;
      await Ticket.updateMany({ _id: { $in: createdTickets.map(ticket => ticket._id) } }, { $set: { emailDeliveryStatus: 'Sent', emailSentAt: new Date() } });
    } catch (emailError) {
      console.error('Không thể gửi email vé:', emailError.message);
      await Ticket.updateMany({ _id: { $in: createdTickets.map(ticket => ticket._id) } }, { $set: { emailDeliveryStatus: 'Failed' } });
    }
    return { tickets: populatedTickets, emailSent, email: user.email, emailMessage };
  } catch (error) {
    if (createdTickets.length) await Ticket.deleteMany({ _id: { $in: createdTickets.map(ticket => ticket._id) } });
    for (const reservation of reservations) await Event.findByIdAndUpdate(reservation.eventId, { $inc: { bookedSlots: -reservation.quantity } });
    throw error;
  }
}

module.exports = { normalizeItems, quoteOrder, fulfillOrder };
