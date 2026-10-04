// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { VIP_ROLE } = require('../utils/vip');

const verifyRole = (requiredRoles) => async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Vui lòng đăng nhập!" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('role status vipExpiresAt');
        if (!user || user.status !== 'Active') return res.status(403).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa!' });
        if (user.role === VIP_ROLE && (!user.vipExpiresAt || user.vipExpiresAt <= new Date())) {
            await User.updateOne({ _id: user._id, role: VIP_ROLE }, { $set: { role: 'user' } });
            user.role = 'user';
        }
        req.user = { ...decoded, role: user.role, vipExpiresAt: user.vipExpiresAt };

        if (requiredRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ message: "Bạn không có quyền thực hiện hành động này." });
        }
    } catch (err) {
        res.status(403).json({ message: "Token không hợp lệ!" });
    }
};

module.exports = { verifyRole }; // Lưu ý: Export dạng object
