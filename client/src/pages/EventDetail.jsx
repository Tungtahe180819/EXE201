import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import { QRCodeCanvas } from 'qrcode.react';
import EventReviewSection from '../components/EventReviewSection';
import { formatEventPrice } from '../utils/formatPrice';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [attendance, setAttendance] = useState({ interested: 0, remaining: null });
  const [registered, setRegistered] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState([]);
  const navigate = useNavigate();

  const role = localStorage.getItem("role");
  const isAdmin = role === "admin_master" || role === "admin_support";
  const [isOrganizer] = useState(() => Date.parse(localStorage.getItem('organizerExpiresAt') || '') > Date.now());
  const canManageEvent = isAdmin || isOrganizer;
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await axios.get(`/api/events/${id}`);
        setEvent(res.data);
        axios.get('/api/events').then(({ data }) => {
          const allEvents = data.events || data;
          setRelatedEvents(allEvents.filter(item => String(item._id) !== String(id) && item.category === res.data.category).slice(0, 3));
        }).catch(() => undefined);
        try {
          const summary = await axios.get(`/api/bookings/event/${id}/summary`);
          setAttendance(summary.data);
        } catch { /* Event detail remains usable if availability summary is temporarily unavailable. */ }
        if (localStorage.getItem('token')) {
          const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
          const [mine, favorites] = await Promise.allSettled([axios.get('/api/bookings/mine', { headers }), axios.get('/api/user/favorites', { headers })]);
          if (mine.status === 'fulfilled') setRegistered(mine.value.data.find(item => item.eventId?._id === id && item.status !== 'cancelled') || null);
          if (favorites.status === 'fulfilled') setIsFavorite(favorites.value.data.some(item => String(item._id) === String(id)));
        }
      } catch (err) {
        toast.error("Không tìm thấy sự kiện");
        console.error(err);
      } finally { 
        setLoading(false); 
      }
    };
    fetchEvent();

    const updateCount = (data) => {
      if (data.eventId === id) {
        setEvent(prev => prev ? ({ ...prev, bookedSlots: data.bookedSlots }) : prev);
        axios.get(`/api/bookings/event/${id}/summary`).then(res => setAttendance(res.data)).catch(() => undefined);
      }
    };
    socket.on('ticket_updated', updateCount);
    socket.on('attendance_updated', updateCount);

    return () => { socket.off('ticket_updated', updateCount); socket.off('attendance_updated', updateCount); };
  }, [id]);

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
    if (!token) return toast.error('Vui lòng đăng nhập để xác nhận tham gia.');
    if (registered) return toast.error('Bạn đã xác nhận tham gia sự kiện này.');
    try {
      setBooking(true);
      const { data } = await axios.post('/api/bookings', { eventId: event._id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(data.message);
      setRegistered(data.booking);
      setAttendance(current => ({ ...current, interested: current.interested + 1, remaining: Math.max(0, current.remaining - 1) }));
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') new Notification('Eventverse', { body: `Bạn đã xác nhận tham gia ${event.title}.` });
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Eventverse', { body: `Bạn đã xác nhận tham gia ${event.title}.` });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể đặt lịch.');
    } finally {
      setBooking(false);
    }
  };

  const toggleFavorite = async () => {
    if (!token) { toast.error('Vui lòng đăng nhập để lưu sự kiện quan tâm.'); navigate('/login'); return; }
    try {
      const { data } = await axios.put(`/api/user/favorites/${event._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setIsFavorite(data.isFavorite);
      toast.success(data.message);
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể lưu sự kiện.'); }
  };

  if (loading) return <div className="p-20 text-center text-slate-500">Đang tải thông tin...</div>;
  if (!event) return <div className="p-20 text-center text-red-500 font-bold">Sự kiện không tồn tại.</div>;

  const remaining = attendance.remaining ?? Math.max(0, (event.totalSlots || 100) - (event.bookedSlots || 0));

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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2"><span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{event.category}</span><span className={`rounded-full px-3 py-1 text-sm font-black ${Number(event.price) === 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>{formatEventPrice(event.price)}</span></div>
        {!canManageEvent && <button onClick={toggleFavorite} className={`rounded-xl border px-4 py-2 font-bold ${isFavorite ? 'border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/40' : 'border-slate-300 dark:border-slate-700'}`}>{isFavorite ? '♥ Đang quan tâm' : '♡ Quan tâm sự kiện'}</button>}
      </div>
      
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-6 text-sm space-y-2">
        <p>🕒 <strong>Bắt đầu:</strong> {event.startTime || event.startDate ? new Date(event.startTime || event.startDate).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
        <p>🕒 <strong>Kết thúc:</strong> {event.endDate ? new Date(event.endDate).toLocaleString('vi-VN') : 'Đang cập nhật'}</p>
        <p>🎟️ <strong>Số chỗ:</strong> {remaining} / {event.totalSlots || 100} còn trống</p>
        <p>💳 <strong>Giá vé:</strong> {formatEventPrice(event.price)}{Number(event.price) > 0 ? ' / vé' : ''}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 font-semibold">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-600 dark:text-indigo-400">
          📍 Địa điểm: {locationString}
        </div>
        <div className={`p-4 rounded-2xl ${remaining === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
          👥 Đã có {attendance.interested} người quan tâm · Còn {remaining} chỗ
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
        <button onClick={openGoogleCalendar} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-2xl">Lưu lịch · Google Calendar</button>
        <button onClick={openOutlookCalendar} className="px-5 py-3 bg-sky-700 text-white font-bold rounded-2xl">Outlook Calendar</button>
      </div>

      {registered && <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30"><p className="font-bold text-emerald-700 dark:text-emerald-300">Bạn đã xác nhận tham gia · Mã check-in: {registered.confirmationCode}</p><QRCodeCanvas value={JSON.stringify({ bookingId: registered._id, confirmationCode: registered.confirmationCode })} size={150} includeMargin /><p className="text-xs text-slate-500">Mã QR cũng đã được gửi đến email tài khoản của bạn (nếu email hoạt động).</p></div>}
      {canManageEvent ? (
        <a href={`/api/bookings/event/${event._id}/attendees.csv`} onClick={e => { e.preventDefault(); axios.get(`/api/bookings/event/${event._id}/attendees.csv`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }).then(({ data }) => { const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = `event-attendees-${event._id}.csv`; link.click(); URL.revokeObjectURL(url); }).catch(() => toast.error('Không thể xuất danh sách người tham gia.')); }} className="mb-3 block w-full rounded-2xl border border-indigo-200 px-5 py-3 text-center font-bold text-indigo-700 dark:border-indigo-900 dark:text-indigo-300">Xuất danh sách tham gia CSV</a>
      ) : remaining === 0 ? (
        <button disabled className="w-full cursor-not-allowed rounded-2xl bg-red-500 py-4 font-bold text-white opacity-80">Đã hết chỗ</button>
      ) : (
        <button onClick={handleBooking} disabled={booking || !!registered} className="mb-8 w-full rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-60">
          {booking ? 'Đang xác nhận...' : registered ? 'Đã xác nhận tham gia' : 'Xác nhận tham gia'}
        </button>
      )}

      <aside className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <strong>Hủy vé / hoàn tiền?</strong> Gửi yêu cầu tại <a href="/help" className="font-bold underline">Trung tâm hỗ trợ</a> và ghi mã đơn hoặc mã vé. Yêu cầu sẽ được nhân viên xem xét; hệ thống không tự động hoàn tiền khi gửi biểu mẫu.
      </aside>

      {relatedEvents.length > 0 && <section className="mb-8 border-t border-slate-200 pt-6 dark:border-slate-700">
        <h2 className="mb-4 text-xl font-black">Sự kiện cùng thể loại</h2>
        <div className="grid gap-4 sm:grid-cols-3">{relatedEvents.map(item => <a key={item._id} href={`/events/${item._id}`} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">{(item.imageUrl || item.image) && <img src={item.imageUrl || item.image} alt="" className="h-32 w-full object-cover" />}<div className="p-3"><p className="line-clamp-2 font-bold">{item.title}</p><p className="mt-1 text-sm text-indigo-600">{formatEventPrice(item.price)}</p><p className="text-xs text-slate-500">{new Date(item.startDate).toLocaleDateString('vi-VN')}</p></div></a>)}</div>
      </section>}

      <EventReviewSection eventId={event._id} />
    </div>
  );
}
