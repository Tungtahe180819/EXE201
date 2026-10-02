// server/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { verifyRole } = require('../middleware/auth'); // Import đúng cách (có ngoặc nhọn)

router.get('/dashboard', verifyRole(['admin_master']), getDashboardStats);

module.exports = router;