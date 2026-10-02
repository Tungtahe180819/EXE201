const express = require('express');
const Ticket = require('../models/Ticket');
const verifyToken = require('../middleware/verifyToken');
const { fulfillOrder } = require('../services/checkoutService');
const mongoose = require('mongoose');

const router = express.Router();

router.post('/checkout', verifyToken, async (req, res) => {
    if (req.user.role !== 'user') {
        return res.status(403).json({ success: false, message: 'Chỉ tài khoản người dùng mới có thể mua vé.' });
    }

    try {
        const result = await fulfillOrder({ userId: req.user.id, rawItems: req.body.items, io: req.io });
        return res.status(201).json({
            success: true,
            message: `Thanh toán và đặt vé thành công! ${result.emailMessage}`,
            ...result
        });
    } catch (error) {
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
