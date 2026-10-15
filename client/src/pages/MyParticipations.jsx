import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function MyParticipations() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axios.get('/api/bookings/mine', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(({ data }) => { if (active) setBookings(data); })
      .catch(error => { if (active) toast.error(error.response?.data?.message || 'Không thể tải nhật ký tham gia.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const cancel = async id => {
    try {
      await axios.delete(`/api/bookings/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success('Đã hủy xác nhận tham gia.');
      setBookings(items => items.map(item => item._id === id ? { ...item, status: 'cancelled' } : item));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể hủy xác nhận.');
    }
  };

  const [now] = useState(() => Date.now());
  const upcoming = bookings.filter(item => item.status !== 'cancelled' && item.eventId && new Date(item.eventId.startDate).getTime() >= now);
  const history = bookings.filter(item => item.status === 'cancelled' || !item.eventId || new Date(item.eventId.startDate).getTime() < now);
  const card = item => (
    <article key={item._id} className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_auto]">
      <div className="flex gap-4">
        {item.eventId?.image && <img src={item.eventId.image} alt="" className="h-24 w-28 rounded-xl object-cover" />}
        <div>
          <Link to={item.eventId ? `/events/${item.eventId._id}` : '/events'} className="text-lg font-black hover:text-indigo-600">{item.eventId?.title || 'Sự kiện đã bị xóa'}</Link>
          {item.eventId && <><p className="mt-1 text-sm text-slate-500">{new Date(item.eventId.startDate).toLocaleString('vi-VN')}</p><p className="text-sm text-slate-500">{item.eventId.location?.address}, {item.eventId.location?.city}</p></>}
          <p className="mt-2 text-sm font-semibold">{item.status === 'cancelled' ? 'Đã hủy xác nhận' : item.checkedInAt ? `Đã check-in lúc ${new Date(item.checkedInAt).toLocaleString('vi-VN')}` : `Mã xác nhận: ${item.confirmationCode}`}</p>
        </div>
      </div>
      {item.status !== 'cancelled' && item.eventId && new Date(item.eventId.startDate).getTime() >= now && <div className="flex flex-col items-center gap-2"><QRCodeCanvas size={116} value={JSON.stringify({ bookingId: item._id, confirmationCode: item.confirmationCode })} includeMargin /><button onClick={() => cancel(item._id)} className="text-sm font-bold text-rose-600 hover:underline">Hủy xác nhận</button></div>}
    </article>
  );

  return (
    <main className="mx-auto my-10 w-full max-w-5xl px-4">
      <h1 className="mb-2 text-3xl font-black">Lịch sự kiện của tôi</h1>
      <p className="mb-8 text-slate-500">Các sự kiện bạn đã xác nhận và nhật ký tham gia.</p>
      {loading ? <p className="py-12 text-center text-slate-500">Đang tải...</p> : <>
        <section className="mb-10"><h2 className="mb-4 text-xl font-black">Sắp tham gia ({upcoming.length})</h2><div className="grid gap-4">{upcoming.length ? upcoming.map(card) : <p className="rounded-2xl bg-slate-100 p-6 text-slate-500 dark:bg-slate-900">Bạn chưa xác nhận sự kiện nào sắp tới.</p>}</div></section>
        <section><h2 className="mb-4 text-xl font-black">Nhật ký tham gia ({history.length})</h2><div className="grid gap-4">{history.length ? history.map(card) : <p className="rounded-2xl bg-slate-100 p-6 text-slate-500 dark:bg-slate-900">Chưa có hoạt động trước đây.</p>}</div></section>
      </>}
    </main>
  );
}
