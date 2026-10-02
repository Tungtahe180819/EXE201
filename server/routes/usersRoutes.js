const express = require('express');
const User = require('../models/User');
const { verifyRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyRole(['admin_master']), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;

