const express = require('express');
const router = express.Router();
const { generateSmartItinerary, chatbotSupport } = require('../controllers/aiController');
const verifyToken = require('../middleware/verifyToken'); // Middleware bảo mật xác thực JWT
const requireVip = require('../middleware/requireVip');

// Endpoint tạo lịch trình AI thông minh (Đã bảo vệ bằng middleware)
router.post('/itinerary', verifyToken, requireVip, generateSmartItinerary);
router.post('/generate-itinerary', verifyToken, requireVip, generateSmartItinerary);

// Endpoint Chatbot AI hỗ trợ khách hàng trực tuyến
router.post('/chatbot', verifyToken, requireVip, chatbotSupport);

module.exports = router;
