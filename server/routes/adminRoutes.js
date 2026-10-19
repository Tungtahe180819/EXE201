// server/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { getAnalytics } = require('../controllers/analyticsController');
const { verifyRole } = require('../middleware/auth'); // Import đúng cách (có ngoặc nhọn)

router.get('/dashboard', verifyRole(['admin_master']), getDashboardStats);
router.get('/analytics', verifyRole(['admin_master', 'admin_support']), getAnalytics);

module.exports = router;
