const { isVipActive } = require('../utils/vip');

module.exports = function requireVip(req, res, next) {
  if (!isVipActive(req.user)) {
    return res.status(403).json({
      code: 'VIP_REQUIRED',
      message: 'Tính năng này chỉ dành cho khách hàng VIP còn hạn (250.000đ/năm).'
    });
  }
  next();
};
