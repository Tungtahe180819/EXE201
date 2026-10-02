const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');
const verifyToken = require('../middleware/verifyToken');
const { sendTicketConfirmation } = require('../services/emailService');

const router = express.Router();

router.post('/checkout', verifyToken, async (req, res) => {
    if (req.user.role !== 'user') {
        return res.status(403).json({ success: false, message: 'Chỉ tài khoản người dùng mới có thể mua vé.' });
    }

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Giỏ hàng đang trống.' });
    }

    const combinedItems = new Map();
    for (const item of rawItems) {
        if (!mongoose.isValidObjectId(item.eventId)) {
            return res.status(400).json({ success: false, message: 'Có sự kiện không hợp lệ trong giỏ hàng.' });
        }
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
            return res.status(400).json({ success: false, message: 'Mỗi sự kiện chỉ được mua từ 1 đến 20 vé.' });
        }
        const key = String(item.eventId);
        const current = combinedItems.get(key) || { eventId: key, quantity: 0, ticketType: item.ticketType };
        current.quantity += quantity;
        if (current.quantity > 20) {
            return res.status(400).json({ success: false, message: 'Mỗi sự kiện chỉ được mua tối đa 20 vé.' });
        }
        combinedItems.set(key, current);
    }

    const user = await User.findOne({ _id: req.user.id, status: 'Active' }).select('name email');
    if (!user) {
        return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' });
    }

    const reservations = [];
    const createdTickets = [];

    try {
        for (const item of combinedItems.values()) {
            const event = await Event.findOneAndUpdate(
                {
                    _id: item.eventId,
                    $expr: {
                        $lte: [
                            { $add: [{ $ifNull: ['$bookedSlots', 0] }, item.quantity] },
                            { $ifNull: ['$totalSlots', 100] }
                        ]
                    }
                },
                { $inc: { bookedSlots: item.quantity } },
                { returnDocument: 'after' }
            );

            if (!event) throw new Error('Sự kiện không tồn tại hoặc không còn đủ vé.');
            reservations.push({ eventId: event._id, quantity: item.quantity });

            const ticket = await Ticket.create({
                ticketCode: `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
                userId: req.user.id,
                eventId: event._id,
                quantity: item.quantity,
                totalPrice: event.price * item.quantity,
                ticketType: item.ticketType || event.category || 'Standard',
                status: 'Confirmed',
                paymentStatus: 'Paid',
                paidAt: new Date()
            });
            createdTickets.push(ticket);
            req.io.emit('ticket_updated', { eventId: String(event._id), bookedSlots: event.bookedSlots });
        }

        await User.findByIdAndUpdate(req.user.id, {
            $addToSet: { history: { $each: createdTickets.map(ticket => ticket._id) } }
        });

        const populatedTickets = await Ticket.find({ _id: { $in: createdTickets.map(ticket => ticket._id) } })
            .populate('eventId', 'title image startDate location')
            .sort({ createdAt: -1 });

        await Notification.create({
            userId: user._id,
            type: 'purchase',
            message: `Thanh toán thành công ${createdTickets.length} mã vé. Tổng tiền: ${createdTickets.reduce((sum, ticket) => sum + ticket.totalPrice, 0).toLocaleString('vi-VN')}₫.`
        });

        let emailSent = false;
        let emailMessage;
        try {
            await sendTicketConfirmation({ user, tickets: populatedTickets });
            emailSent = true;
            emailMessage = `Mã vé đã được gửi tới ${user.email}.`;
            await Ticket.updateMany(
                { _id: { $in: createdTickets.map(ticket => ticket._id) } },
                { $set: { emailDeliveryStatus: 'Sent', emailSentAt: new Date() } }
            );
        } catch (emailError) {
            console.error('Không thể gửi email vé:', emailError.message);
            emailMessage = 'Thanh toán thành công nhưng chưa gửi được email. Bạn vẫn có thể xem vé trong mục Vé của tôi.';
            await Ticket.updateMany(
                { _id: { $in: createdTickets.map(ticket => ticket._id) } },
                { $set: { emailDeliveryStatus: 'Failed' } }
            );
        }

        return res.status(201).json({
            success: true,
            message: `Thanh toán và đặt vé thành công! ${emailMessage}`,
            emailSent,
            email: user.email,
            tickets: populatedTickets
        });
    } catch (error) {
        if (createdTickets.length) {
            await Ticket.deleteMany({ _id: { $in: createdTickets.map(ticket => ticket._id) } });
        }
        for (const reservation of reservations) {
            await Event.findByIdAndUpdate(reservation.eventId, { $inc: { bookedSlots: -reservation.quantity } });
        }
        return res.status(400).json({ success: false, message: error.message || 'Không thể thanh toán đơn hàng.' });
    }
});

router.get('/mine', verifyToken, async (req, res) => {
    try {
        const tickets = await Ticket.find({ userId: req.user.id })
            .populate('eventId', 'title image startDate endDate location category price')
            .sort({ createdAt: -1 });
        return res.status(200).json(tickets);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get('/:id', verifyToken, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Mã vé không hợp lệ.' });
        const ticket = await Ticket.findOne({ _id: req.params.id, userId: req.user.id })
            .populate('eventId', 'title image startDate endDate location category price');
        if (!ticket) return res.status(404).json({ message: 'Không tìm thấy vé.' });
        return res.status(200).json(ticket);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
