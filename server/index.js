require('dotenv').config();

for (const key of ['MONGO_URI', 'JWT_SECRET']) {
    if (!process.env[key]) throw new Error(`Thiếu biến môi trường bắt buộc: ${key}`);
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import Routes
const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const eventRoutes = require('./routes/eventRoutes');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/ticketRoutes');
const userRoutes = require('./routes/userRoutes');
const usersRoutes = require('./routes/usersRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
const PORT = process.env.PORT || 9999;

// Tạo Server Socket
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] }
});

// Middleware (Đặt express.json lên trước các routes)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gán io vào req
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Kết nối MongoDB (sử dụng EV_DATA từ .env)
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ Kết nối MongoDB (EV_DATA) thành công!');
        require('./services/reminderService').startReminderService();
        server.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Lỗi kết nối MongoDB:', err.message);
        process.exitCode = 1;
    });

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Eventverse API đang chạy ổn định tại port ' + PORT });
});

app.use('/api/events', eventRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/bookings', bookingRoutes);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('disconnect', () => console.log('User disconnected'));
});
