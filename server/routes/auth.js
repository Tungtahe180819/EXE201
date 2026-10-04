const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

// 1. Route Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ email và mật khẩu!" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ message: user.status === 'Banned' ? 'Tài khoản đã bị khóa!' : 'Tài khoản hiện không hoạt động!' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role || 'user' }, 
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({ 
      token, 
      role: user.role || 'user', 
      user: {
        id: user._id,
        email: user.email,
        name: user.name || user.email,
        phone: user.phone || '',
        avatar: user.avatar || '',
        bio: user.bio || ''
      } 
    });
  } catch (err) {
    console.error('❌ LỖI KHI ĐĂNG NHẬP:', err);
    res.status(500).json({ message: "Lỗi máy chủ: " + err.message });
  }
});

// 2. Route Đăng ký (Đã gán rõ role là 'user' khớp hoàn toàn với enum Schema)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ email và mật khẩu!" });
    }

    if (String(password).length < 8 || String(password).length > 128) {
      return res.status(400).json({ message: 'Mật khẩu phải có từ 8 đến 128 ký tự.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại trong hệ thống!" });
    }

    const newUser = new User({ 
      email: cleanEmail,
      username: cleanEmail,
      password: String(password),
      name: name ? String(name).trim() : cleanEmail,
      role: 'user' // Khớp chuẩn enum ['user', 'admin_master', 'admin_support']
    });
    
    await newUser.save();
    res.status(201).json({ message: "Đăng ký thành công!" });
  } catch (err) {
    console.error('❌ LỖI KHI ĐĂNG KÝ:', err);
    res.status(500).json({ message: "Lỗi máy chủ: " + err.message });
  }
});

// Gửi email đặt lại mật khẩu. Luôn trả cùng một thông báo để không làm lộ email đã đăng ký.
router.post('/forgot-password', async (req, res) => {
  const successMessage = 'Nếu email đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong ít phút.';

  try {
    const cleanEmail = String(req.body.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(200).json({ message: successMessage });

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const requestOrigin = req.get('origin');
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin || '');
    const clientUrl = (process.env.CLIENT_URL || (isLocalOrigin ? requestOrigin : '') || 'http://localhost:5173').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await sendPasswordResetEmail({ user, resetUrl });
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      console.error('Không thể gửi email đặt lại mật khẩu:', emailError.message);
      return res.status(503).json({ message: 'Chưa thể gửi email lúc này. Vui lòng thử lại sau.' });
    }

    return res.status(200).json({ message: successMessage });
  } catch (err) {
    console.error('Lỗi quên mật khẩu:', err.message);
    return res.status(500).json({ message: 'Không thể xử lý yêu cầu đặt lại mật khẩu.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const rawToken = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (!rawToken) return res.status(400).json({ message: 'Liên kết đặt lại mật khẩu không hợp lệ.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Mật khẩu mới phải có từ 8 đến 128 ký tự.' });

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'Liên kết đã hết hạn hoặc đã được sử dụng.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
  } catch (err) {
    console.error('Lỗi đặt lại mật khẩu:', err.message);
    return res.status(500).json({ message: 'Không thể đặt lại mật khẩu.' });
  }
});

module.exports = router;
