import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import EventReviewSection from '../components/EventReviewSection';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bookingTime, setBookingTime] = useState('');
  const [booking, setBooking] = useState(false);

  const role = localStorage.getItem("role");
  const isAdmin = role === "admin_master" || role === "admin_support";
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await axios.get(`/api/events/${id}`);
        setEvent(res.data);
      } catch (err) {
        toast.error("Không tìm thấy sự kiện");
        console.error(err);
      } finally { 
        setLoading(false); 
      }
    };
    fetchEvent();

    socket.on('ticket_updated', (data) => {
      if (data.eventId === id) {
        setEvent(prev => ({ ...prev, bookedSlots: data.bookedSlots }));
      }
    });

    return () => socket.off('ticket_updated');
  }, [id]);

  const handleDownloadICS = () => {
    try {
      const title = event.name || event.title || 'Sự kiện Eventverse';
      const description = event.description || '';
      const location = typeof event.location === 'object' ? `${event.location.address || ''}, ${event.location.city || ''}` : (event.location || 'Hà Nội');
      
      const startTime = event.startTime || event.startDate ? new Date(event.startTime || event.startDate).toISOString().replace(/-|:|\.\d+/g, '') : new Date().toISOString().replace(/-|:|\.\d+/g, '');
      const endTime = event.endTime ? new Date(event.endTime).toISOString().replace(/-|:|\.\d+/g, '') : startTime;

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `SUMMARY:${title}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        `DTSTART:${startTime}`,
        `DTEND:${endTime}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title.replace(/\s+/g, '_')}-schedule.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Đã tải file lịch .ics thành công!");
    } catch (error) {
      toast.error("Lỗi khi tạo file lịch .ics");
      console.error(error);
    }
  };

  const calendarDates = () => {
    const format = value => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, '');
    return `${format(event.startDate)}/${format(event.endDate || event.startDate)}`;
  };

  const openGoogleCalendar = () => {
    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', event.title);
    url.searchParams.set('dates', calendarDates());
    url.searchParams.set('details', event.description || '');
    url.searchParams.set('location', locationString);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const openOutlookCalendar = () => {
    const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    url.searchParams.set('subject', event.title);
    url.searchParams.set('startdt', new Date(event.startDate).toISOString());
    url.searchParams.set('enddt', new Date(event.endDate || event.startDate).toISOString());
    url.searchParams.set('body', event.description || '');
    url.searchParams.set('location', locationString);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleBooking = async () => {
    if (!token) return toast.error('Vui lòng đăng nhập để đặt lịch.');
    if (!bookingTime) return toast.error('Vui lòng chọn khung giờ.');
    try {
      setBooking(true);
      const { data } = await axios.post('/api/bookings', { eventId: event._id, bookingTime: new Date(bookingTime).toISOString() }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(data.message);
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đặt lịch.');
    } finally {
      setBooking(false);
    }
  };

  // 👉 HÀM ĐÃ ĐƯỢC VIẾT LẠI ĐỂ ĐẢM BẢO KHỚP VỚI BACKEND
  const handleAddToCart = async () => {
    if (isAdmin) {
      toast.error("Admin không được phép mua vé!");
      return;
    }

    if (!token) {
      toast.error("Vui lòng đăng nhập trước khi đặt vé!");
      return;
    }

    if (!event) {
        toast.error("Thông tin sự kiện chưa tải xong!");
        return;
    }

    const qty = Number(quantity);
    try {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      const existingIndex = cart.findIndex(item => item._id === event._id);
      if (existingIndex > -1) {
        const nextQuantity = cart[existingIndex].quantity + qty;
        if (nextQuantity > remaining || nextQuantity > 20) {
          toast.error('Số lượng trong giỏ vượt quá số vé có thể mua.');
          return;
        }
        cart[existingIndex].quantity = nextQuantity;
      } else {
        cart.push({ ...event, quantity: qty });
      }
      localStorage.setItem('cart', JSON.stringify(cart));
      toast.success('Đã thêm vé vào giỏ hàng!');
      navigate('/cart');
    } catch (err) {
      toast.error('Không thể cập nhật giỏ hàng.');
      console.error('Lỗi giỏ hàng:', err);
    }
  };

  if (loading) return <div className="p-20 text-center text-slate-500">Đang tải thông tin...</div>;
  if (!event) return <div className="p-20 text-center text-red-500 font-bold">Sự kiện không tồn tại.</div>;

  const maxTickets = event.maxTickets || event.totalSlots || 100;
  const soldCount = event.ticketsSold || event.bookedSlots || 0;
  const remaining = Math.max(0, maxTickets - soldCount);

  const locationString = typeof event.location === 'object' 
    ? `${event.location.address || ''}, ${event.location.city || 'Hà Nội'}` 
    : (event.location || 'Hà Nội');

  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(locationString)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="max-w-4xl mx-auto p-8 md:p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl my-10 text-slate-900 dark:text-slate-100 transition-colors">
      
      {(event.imageUrl || event.image) && (
        <div className="w-full h-72 md:h-96 rounded-2xl overflow-hidden mb-6 shadow-md bg-slate-100 dark:bg-slate-800">
          <img 
            src={event.imageUrl || event.image} 
            alt={event.name || event.title} 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <h1 className="text-3xl md:text-4xl font-black mb-4">{event.name || event.title}</h1>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{event.description}</p>
      
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-6 text-sm space-y-2">
        <p>🕒 <strong>Bắt đầu:</strong> {event.startTime || event.startDate ? new Date(event.startTime || event.startDate).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
        <p>🕒 <strong>Kết thúc:</strong> {event.endDate ? new Date(event.endDate).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 font-semibold">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-600 dark:text-indigo-400">
          📍 Địa điểm: {locationString}
        </div>
        <div className={`p-4 rounded-2xl ${remaining === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          🎟️ Vé còn lại: {remaining} vé (Tổng: {maxTickets})
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          🗺️ Bản Đồ Chỉ Đường Đến Sự Kiện
        </h3>
        <div className="w-full h-72 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
          <iframe
            title="Event Location Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight="0"
            marginWidth="0"
            src={mapEmbedUrl}
          ></iframe>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={handleDownloadICS}
          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition"
        >
          📥 Tải lịch .ics
        </button>
        <button onClick={openGoogleCalendar} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-2xl">Google Calendar</button>
        <button onClick={openOutlookCalendar} className="px-5 py-3 bg-sky-700 text-white font-bold rounded-2xl">Outlook Calendar</button>
      </div>

      {!isAdmin && token && remaining > 0 && (
        <div className="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h3 className="mb-3 font-bold">Đặt lịch tham gia và nhận nhắc lịch</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input type="datetime-local" value={bookingTime} min={event.startDate ? new Date(new Date(event.startDate).getTime() - new Date(event.startDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined} max={event.endDate ? new Date(new Date(event.endDate).getTime() - new Date(event.endDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined} onChange={e => setBookingTime(e.target.value)} className="flex-1 rounded-xl border bg-white p-3 dark:bg-slate-900" />
            <button onClick={handleBooking} disabled={booking} className="rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white disabled:opacity-60">{booking ? 'Đang đặt...' : 'Đặt lịch'}</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Hệ thống sẽ gửi email và thông báo trước giờ hẹn 30 phút.</p>
        </div>
      )}

      {!isAdmin && remaining > 0 && (
        <div className="flex items-center gap-4 mb-8">
          <span className="text-sm font-bold text-slate-500">Số lượng:</span>
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 border rounded-xl font-bold flex items-center justify-center">-</button>
          <span className="text-xl font-black w-10 text-center">{quantity}</span>
          <button onClick={() => setQuantity(q => Math.min(remaining, q + 1))} className="w-10 h-10 border rounded-xl font-bold flex items-center justify-center">+</button>
        </div>
      )}

      {isAdmin ? (
        <button disabled className="w-full bg-slate-200 dark:bg-slate-800 text-slate-400 py-4 rounded-2xl font-bold cursor-not-allowed">
          Admin không được phép mua vé
        </button>
      ) : remaining === 0 ? (
        <button disabled className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold cursor-not-allowed opacity-80">
          Hết vé (Fully Booked)
        </button>
      ) : (
        <button
          onClick={handleAddToCart}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg transition mb-8"
        >
          Thêm vào giỏ hàng - {((event.price || 0) * quantity).toLocaleString()}đ
        </button>
      )}

      <EventReviewSection eventId={event._id} />
    </div>
  );
}
