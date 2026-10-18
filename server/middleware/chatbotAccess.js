const User = require('../models/User');

const FREE_CHATBOT_USES = 5;

module.exports = async function chatbotAccess(req, res, next) {
  if (req.user.role === 'user_vip') {
    req.chatbotTrialRemaining = null;
    return next();
  }
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Chatbot chỉ dành cho tài khoản khách hàng.' });
  }

  try {
    const updated = await User.findOneAndUpdate(
      { _id: req.user.id, role: 'user', chatbotTrialUses: { $lt: FREE_CHATBOT_USES } },
      { $inc: { chatbotTrialUses: 1 } },
      { returnDocument: 'after' }
    ).select('chatbotTrialUses');

    if (!updated) {
      return res.status(403).json({
        code: 'VIP_REQUIRED',
        remainingUses: 0,
        message: 'Bạn đã dùng hết 5 lượt Chatbot AI miễn phí. Nâng cấp VIP để tiếp tục sử dụng không giới hạn.'
      });
    }

    req.chatbotTrialRemaining = Math.max(0, FREE_CHATBOT_USES - updated.chatbotTrialUses);
    // A failed API call should not consume one of the user's successful trial uses.
    res.once('finish', () => {
      if (res.statusCode >= 400) {
        User.updateOne({ _id: req.user.id, chatbotTrialUses: { $gt: 0 } }, { $inc: { chatbotTrialUses: -1 } })
          .catch(error => console.error('Không thể hoàn lại lượt chatbot:', error.message));
      }
    });
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Không thể kiểm tra lượt dùng Chatbot AI.' });
  }
};
