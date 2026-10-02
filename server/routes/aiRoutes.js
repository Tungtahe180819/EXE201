const express = require('express');
const router = express.Router();
const { generateSmartItinerary, chatbotSupport } = require('../controllers/aiController');
const verifyToken = require('../middleware/verifyToken'); // Middleware bảo mật xác thực JWT

// Endpoint tạo lịch trình AI thông minh (Đã bảo vệ bằng middleware)
router.post('/itinerary', verifyToken, generateSmartItinerary);
router.post('/generate-itinerary', verifyToken, generateSmartItinerary);

// Endpoint Chatbot AI hỗ trợ khách hàng trực tuyến
router.post('/chatbot', chatbotSupport);

module.exports = router;
