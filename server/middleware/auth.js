// server/middleware/auth.js
const jwt = require('jsonwebtoken');

const verifyRole = (requiredRoles) => (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Vui lòng đăng nhập!" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

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
