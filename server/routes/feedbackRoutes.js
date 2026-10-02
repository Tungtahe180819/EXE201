const express = require('express');
const Feedback = require('../models/Feedback');
const jwt = require('jsonwebtoken');

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

module.exports = router;
