import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function EventCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Lấy danh sách sự kiện đã đăng ký hoặc sự kiện hệ thống
    axios.get('/api/events')
      .then(res => {
        const formattedEvents = (res.data.events || res.data).map(ev => ({
          id: ev._id,
          title: ev.title || ev.name,
          start: ev.startDate,
          end: ev.endDate,
          backgroundColor: '#4f46e5',
        }));
        setEvents(current => [...formattedEvents, ...current.filter(item => String(item.id).startsWith('booking-'))]);
        setError('');
      })
      .catch(() => {
        setError('Không thể tải dữ liệu lịch sự kiện. Hãy kiểm tra server tại cổng 9999.');
        toast.error("Không thể tải dữ liệu lịch sự kiện!");
      })
      .finally(() => setLoading(false));
    const token = localStorage.getItem('token');
    if (token && localStorage.getItem('role') === 'user') {
      axios.get('/api/bookings/mine', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const bookings = res.data.filter(item => item.status !== 'cancelled').map(item => ({
            id: `booking-${item._id}`,
            title: `Đã đặt: ${item.eventId?.title || 'Sự kiện'}`,
            start: item.bookingTime,
            backgroundColor: '#059669'
          }));
          setEvents(current => [...current, ...bookings]);
        })
        .catch(() => undefined);
    }
  }, []);

  // Xử lý kéo thả thay đổi thời gian (Dành cho Admin hoặc cá nhân hóa lịch trình)
  const handleEventDrop = (info) => {
    const updatedEvent = {
      id: info.event.id,
      newStart: info.event.start,
      newEnd: info.event.end
    };
    
    axios.put(`/api/events/reschedule/${updatedEvent.id}`, {
      startDate: updatedEvent.newStart,
      endDate: updatedEvent.newEnd
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    .then(() => toast.success("Đã cập nhật lịch trình sự kiện thành công!"))
    .catch(() => {
      toast.error("Lỗi khi đổi lịch, hoàn tác thay đổi.");
      info.revert();
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 my-8">
      <h2 className="text-2xl font-black mb-2">📅 Lịch Trình & Sự Kiện Tổng Quan</h2>
      <p className="mb-6 text-sm text-slate-500">Xem theo tháng, tuần hoặc ngày. Quản trị viên có thể kéo thả để đổi lịch.</p>
      {loading ? (
        <div className="grid h-[650px] place-items-center rounded-2xl bg-slate-50 dark:bg-slate-950">
          <p className="font-semibold text-indigo-600">Đang tải lịch sự kiện...</p>
        </div>
      ) : error ? (
        <div className="grid h-64 place-items-center rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <p className="font-semibold">{error}</p>
        </div>
      ) : <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        editable={['admin_master', 'admin_support'].includes(localStorage.getItem('role'))}
        selectable={true}
        events={events}
        eventDrop={handleEventDrop}
        height="650px"
        locale="vi"
        noEventsContent="Chưa có sự kiện trong khoảng thời gian này"
      />}
    </div>
  );
}
