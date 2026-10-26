const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { chatbotSupport } = require('../controllers/aiController');
const { exportEventToICS } = require('../controllers/icsController'); // 🌟 Tích hợp controller xuất file .ics
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verifyToken');
const requireVip = require('../middleware/requireVip');
const { isOrganizerActive, ORGANIZER_MONTHLY_EVENT_LIMIT, ORGANIZER_EVENT_ATTENDEE_LIMIT } = require('../utils/organizerPlan');

/**
 * Middleware: Xác thực JWT và kiểm tra quyền
 * Dùng cho các route cần đăng nhập và phân quyền
 */
const verifyRole = (requiredRoles) => (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Vui lòng đăng nhập để tiếp tục!" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Dữ liệu chứa { id, role, ... }

        if (requiredRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ message: "Bạn không có quyền thực hiện hành động này!" });
        }
    } catch (err) {
        return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};

function canManageEvent(event, user) {
    return ['admin_master', 'admin_support'].includes(user.role)
        || (isOrganizerActive(user) && String(event.createdBy || '') === String(user.id));
}

// --- 1. ROUTES AI ---
router.post('/chat', verifyToken, require('../middleware/chatbotAccess'), chatbotSupport);

// --- 2. ROUTES TÌM KIẾM VÀ BANNER NỔI BẬT (Đặt TRƯỚC /:id) ---
router.get('/search', async (req, res) => {
    try {
        const { keyword, category } = req.query;
        let query = { isPublished: { $ne: false } };

        if (keyword) {
            query.$or = [
                { title: { $regex: keyword, $options: 'i' } },
                { description: { $regex: keyword, $options: 'i' } }
            ];
        }

        if (category && category !== 'all') {
            query.category = category;
        }

        const events = await Event.find(query).sort({ createdAt: -1 });
        res.status(200).json({ total: events.length, events });
    } catch (err) {
        res.status(500).json({ message: "Lỗi tìm kiếm: " + err.message });
    }
});

router.get('/featured', async (req, res) => {
    try {
        let featured = await Event.find({ isPublished: { $ne: false }, isFeatured: true }).limit(5);
        if (!featured || featured.length === 0) {
            featured = await Event.find({ isPublished: { $ne: false } }).sort({ createdAt: -1 }).limit(5);
        }
        res.status(200).json(featured);
    } catch (err) {
        res.status(500).json({ message: "Lỗi tải banner: " + err.message });
    }
});

// Lấy danh mục động từ dữ liệu thay vì viết cứng ở giao diện.
router.get('/categories', async (req, res) => {
    try {
        const categories = await Event.distinct('category', { isPublished: { $ne: false }, category: { $nin: [null, ''] } });
        return res.status(200).json(categories.sort((a, b) => a.localeCompare(b, 'vi')));
    } catch (err) {
        return res.status(500).json({ message: 'Không thể tải danh sách thể loại: ' + err.message });
    }
});

// --- 3. ROUTE XUẤT LỊCH ĐỒNG BỘ (.ICS) ---
router.post('/export-ics', exportEventToICS);

// --- 4. ROUTES QUẢN LÝ SỰ KIỆN CƠ BẢN ---
// Admin Support phụ trách tạo sự kiện; Admin Master chỉ quản lý sự kiện đã có.
router.post('/', verifyToken, async (req, res) => {
    try {
        const isAdminSupport = req.user.role === 'admin_support';
        const isPaidOrganizer = isOrganizerActive(req.user);
        if (!isAdminSupport && !isPaidOrganizer) return res.status(403).json({ message: 'Bạn cần đăng ký gói Ban tổ chức 79.000đ/tháng để tạo sự kiện.' });
        const {
            title, category, description, startDate, endDate,
            location, price, stock, totalSlots, image, recurrence, timezone
        } = req.body;

        if (!title || !category || !startDate || !location?.address || !location?.city || !image) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc của sự kiện.' });
        }

        if (endDate && new Date(endDate) <= new Date(startDate)) {
            return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
        }

        const slotCount = Number(totalSlots);
        const eventPrice = Number(price);
        if (!Number.isFinite(slotCount) || slotCount < 1 || !Number.isFinite(eventPrice) || eventPrice < 0) {
            return res.status(400).json({ message: 'Giá vé hoặc số lượng vé không hợp lệ.' });
        }
        if (isPaidOrganizer && slotCount > ORGANIZER_EVENT_ATTENDEE_LIMIT) return res.status(400).json({ message: `Gói Ban tổ chức giới hạn tối đa ${ORGANIZER_EVENT_ATTENDEE_LIMIT} người cho mỗi sự kiện.` });

        const baseEvent = {
            title: String(title).trim(),
            category,
            description,
            startDate,
            endDate,
            location: { address: location.address, city: location.city },
            price: eventPrice,
            stock: Number(stock) || slotCount,
            totalSlots: slotCount,
            image,
            createdBy: req.user.id,
            createdByRole: req.user.role,
            recurrence: recurrence || { isRecurring: false, frequency: 'none' },
            timezone: timezone || 'Asia/Ho_Chi_Minh'
        };

        const eventsToCreate = [baseEvent];
        if (recurrence?.isRecurring && ['daily', 'weekly', 'monthly'].includes(recurrence.frequency)) {
            const until = new Date(recurrence.untilDate);
            if (Number.isNaN(until.getTime()) || until <= new Date(startDate)) {
                return res.status(400).json({ message: 'Ngày kết thúc chuỗi lặp phải sau ngày bắt đầu.' });
            }
            let nextStart = new Date(startDate);
            let nextEnd = endDate ? new Date(endDate) : null;
            while (eventsToCreate.length < 100) {
                if (recurrence.frequency === 'daily') {
                    nextStart.setDate(nextStart.getDate() + 1);
                    if (nextEnd) nextEnd.setDate(nextEnd.getDate() + 1);
                } else if (recurrence.frequency === 'weekly') {
                    nextStart.setDate(nextStart.getDate() + 7);
                    if (nextEnd) nextEnd.setDate(nextEnd.getDate() + 7);
                } else {
                    nextStart.setMonth(nextStart.getMonth() + 1);
                    if (nextEnd) nextEnd.setMonth(nextEnd.getMonth() + 1);
                }
                if (nextStart > until) break;
                eventsToCreate.push({ ...baseEvent, startDate: new Date(nextStart), endDate: nextEnd ? new Date(nextEnd) : undefined });
            }
        }

        if (isPaidOrganizer) {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const currentCount = await Event.countDocuments({ createdBy: req.user.id, createdAt: { $gte: monthStart, $lt: nextMonth } });
            if (currentCount + eventsToCreate.length > ORGANIZER_MONTHLY_EVENT_LIMIT) {
                return res.status(400).json({ message: `Gói Ban tổ chức giới hạn ${ORGANIZER_MONTHLY_EVENT_LIMIT} sự kiện mỗi tháng; bạn đã tạo ${currentCount} trong tháng này.` });
            }
        }

        const createdEvents = await Event.insertMany(eventsToCreate);
        createdEvents.forEach(event => req.io.emit('event_created', event));
        return res.status(201).json({ message: `Tạo thành công ${createdEvents.length} sự kiện!`, event: createdEvents[0], events: createdEvents });
    } catch (err) {
        return res.status(400).json({ message: 'Lỗi khi tạo sự kiện: ' + err.message });
    }
});

router.get('/mine', verifyToken, async (req, res) => {
    if (!['admin_master', 'admin_support'].includes(req.user.role) && !isOrganizerActive(req.user)) {
        return res.status(403).json({ message: 'Bạn cần gói Ban tổ chức còn hạn để quản lý sự kiện.' });
    }
    const events = await Event.find(['admin_master', 'admin_support'].includes(req.user.role) ? {} : { createdBy: req.user.id }).sort({ startDate: 1 });
    return res.json(events);
});

router.get('/', async (req, res) => {
    try {
        const events = await Event.find({ isPublished: { $ne: false } }).sort({ createdAt: -1 });
        res.status(200).json(events);
    } catch (err) {
        res.status(500).json({ message: "Lỗi server: " + err.message });
    }
});

router.put('/reschedule/:id', verifyRole(['admin_master', 'admin_support']), async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        if (!startDate) return res.status(400).json({ message: 'Thiếu thời gian bắt đầu!' });
        const updated = await Event.findByIdAndUpdate(
            req.params.id,
            { startDate, endDate },
            { returnDocument: 'after', runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Không tìm thấy sự kiện!' });
        return res.status(200).json(updated);
    } catch (err) {
        return res.status(400).json({ message: 'Không thể đổi lịch: ' + err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, isPublished: { $ne: false } });
        if (!event) return res.status(404).json({ message: "Không tìm thấy sự kiện!" });
        res.status(200).json(event);
    } catch (err) {
        res.status(500).json({ message: "Lỗi server: " + err.message });
    }
});

router.put('/:id', verifyToken, async (req, res) => {
    try {
        const allowedFields = ['title', 'category', 'description', 'startDate', 'endDate', 'location', 'price', 'stock', 'totalSlots', 'image', 'sourceUrl', 'recurrence', 'timezone'];
        const changes = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
        );
        const currentEvent = await Event.findById(req.params.id);
        if (!currentEvent) return res.status(404).json({ message: "Không tìm thấy sự kiện để sửa!" });
        if (!canManageEvent(currentEvent, req.user)) return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa sự kiện này.' });
        if (isOrganizerActive(req.user) && Number(changes.totalSlots ?? currentEvent.totalSlots) > ORGANIZER_EVENT_ATTENDEE_LIMIT) return res.status(400).json({ message: `Gói Ban tổ chức giới hạn ${ORGANIZER_EVENT_ATTENDEE_LIMIT} người mỗi sự kiện.` });
        if (Number(changes.totalSlots ?? currentEvent.totalSlots) < Number(currentEvent.bookedSlots || 0)) return res.status(400).json({ message: 'Số chỗ không thể nhỏ hơn số người đã xác nhận tham gia.' });

        const startDateChanged = changes.startDate && new Date(changes.startDate).getTime() !== currentEvent.startDate.getTime();
        const endDateChanged = changes.endDate && new Date(changes.endDate).getTime() !== currentEvent.endDate?.getTime();
        if ((startDateChanged || endDateChanged) && changes.endDate && changes.startDate && new Date(changes.endDate) <= new Date(changes.startDate)) {
            return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });
        }
        const updated = await Event.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true });
        if (!updated) return res.status(404).json({ message: "Không tìm thấy sự kiện để sửa!" });
        req.io.emit('event_updated', updated);
        return res.status(200).json({ message: 'Cập nhật sự kiện thành công!', event: updated });
    } catch (err) {
        return res.status(400).json({ message: "Lỗi khi cập nhật: " + err.message });
    }
});

router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: "Không tìm thấy sự kiện để xóa!" });
        if (!canManageEvent(event, req.user)) return res.status(403).json({ message: 'Bạn không có quyền xóa sự kiện này.' });
        const deleted = await Event.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Không tìm thấy sự kiện để xóa!" });
        req.io.emit('event_deleted', { eventId: req.params.id });
        return res.status(200).json({ message: "Xóa sự kiện thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi khi xóa: " + err.message });
    }
});

module.exports = router;
