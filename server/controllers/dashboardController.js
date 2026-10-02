const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

const getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const [totalEvents, totalUsers, activeEvents, ticketTotals, capacityTotals, monthlyRevenue, usersByRole, recentEvents, recentTickets] = await Promise.all([
            Event.countDocuments(),
            User.countDocuments(),
            Event.countDocuments({ startDate: { $gte: now } }),
            Ticket.aggregate([{ $group: { _id: null, ticketsSold: { $sum: '$quantity' }, grossRevenue: { $sum: '$totalPrice' } } }]),
            Event.aggregate([{ $group: { _id: null, totalSlots: { $sum: '$totalSlots' }, bookedSlots: { $sum: '$bookedSlots' } } }]),
            Ticket.aggregate([
                { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$totalPrice' }, tickets: { $sum: '$quantity' } } },
                { $sort: { _id: 1 } },
                { $limit: 12 }
            ]),
            User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
            Event.find().sort({ createdAt: -1 }).limit(5).select('title category startDate totalSlots bookedSlots createdByRole'),
            Ticket.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name email').populate('eventId', 'title')
        ]);

        const ticketStats = ticketTotals[0] || { ticketsSold: 0, grossRevenue: 0 };
        const capacity = capacityTotals[0] || { totalSlots: 0, bookedSlots: 0 };
        const occupancyRate = capacity.totalSlots > 0 ? Math.round((capacity.bookedSlots / capacity.totalSlots) * 1000) / 10 : 0;

        return res.status(200).json({
            stats: {
                totalEvents,
                totalUsers,
                activeEvents,
                ticketsSold: ticketStats.ticketsSold,
                grossRevenue: ticketStats.grossRevenue,
                platformRevenue: ticketStats.grossRevenue * 0.25,
                occupancyRate
            },
            chartData: monthlyRevenue.map(item => ({ name: item._id, revenue: item.revenue, profit: item.revenue * 0.25, tickets: item.tickets })),
            usersByRole: usersByRole.map(item => ({ role: item._id, count: item.count })),
            recentEvents,
            recentTickets
        });
    } catch (error) {
        console.error('Lỗi dashboard:', error);
        return res.status(500).json({ message: 'Lỗi máy chủ khi lấy dữ liệu dashboard.' });
    }
};

module.exports = { getDashboardStats };
