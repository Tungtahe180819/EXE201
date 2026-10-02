const ics = require('ics');

function toIcsDate(value) {
  const date = new Date(value);
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes()
  ];
}

const exportEventToICS = (req, res) => {
  const { title, description, location, startDate, endDate } = req.body;
  if (!title || !startDate) return res.status(400).json({ message: 'Thiếu tên hoặc thời gian sự kiện.' });

  const eventConfig = {
    title,
    description: description || '',
    location: typeof location === 'object' ? `${location.address || ''}, ${location.city || ''}` : (location || ''),
    start: toIcsDate(startDate),
    end: toIcsDate(endDate || startDate),
    startInputType: 'utc',
    endInputType: 'utc'
  };

  ics.createEvent(eventConfig, (error, value) => {
    if (error) return res.status(400).json({ message: 'Không thể tạo file lịch.' });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=event-schedule.ics');
    return res.send(value);
  });
};

module.exports = { exportEventToICS };
