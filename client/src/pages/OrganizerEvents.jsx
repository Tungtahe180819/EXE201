import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function OrganizerEvents() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState({});
  const [checking, setChecking] = useState(null);
  const [scannerEvent, setScannerEvent] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!scannerEvent) return undefined;
    let stream;
    let timer;
    let detected = false;
    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        toast.error('Trình duyệt này chưa hỗ trợ quét QR bằng camera. Bạn có thể nhập mã xác nhận thủ công.');
        setScannerEvent(null);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        timer = window.setInterval(async () => {
          if (detected || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (!results.length) return;
            const payload = JSON.parse(results[0].rawValue);
            const code = payload.confirmationCode || payload.code;
            if (!code) return;
            detected = true;
            setCodes(current => ({ ...current, [scannerEvent._id]: code }));
            toast.success('Đã quét mã QR. Nhấn Check-in để xác nhận.');
            setScannerEvent(null);
          } catch { /* Keep scanning until a valid Eventverse QR is found. */ }
        }, 500);
      } catch (error) {
        toast.error(error.name === 'NotAllowedError' ? 'Hãy cho phép trình duyệt dùng camera để quét QR.' : 'Không mở được camera.');
        setScannerEvent(null);
      }
    };
    start();
    return () => {
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [scannerEvent]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    axios.get('/api/events/mine', { headers })
      .then(async ({ data }) => {
        setEvents(data);
        const counts = await Promise.all(data.map(event => axios.get(`/api/bookings/event/${event._id}/summary`).then(res => [event._id, res.data]).catch(() => [event._id, null])));
        setStats(Object.fromEntries(counts));
      })
      .catch(error => toast.error(error.response?.data?.message || 'Không thể tải sự kiện.'))
      .finally(() => setLoading(false));
  }, []);

  const monthCount = useMemo(() => {
    const now = new Date();
    return events.filter(event => {
      const created = new Date(event.createdAt);
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;
  }, [events]);

  const exportCsv = async event => {
    try {
      const { data } = await axios.get(`/api/bookings/event/${event._id}/attendees.csv`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `event-attendees-${event._id}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể xuất CSV.'); }
  };

  const checkIn = async event => {
    try {
      setChecking(event._id);
      const { data } = await axios.post(`/api/bookings/event/${event._id}/check-in`, { confirmationCode: codes[event._id] }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success(`${data.message} ${data.attendee || ''}`);
      setCodes(current => ({ ...current, [event._id]: '' }));
    } catch (error) { toast.error(error.response?.data?.message || 'Check-in thất bại.'); }
    finally { setChecking(null); }
  };

  const deleteEvent = async event => {
    if (!window.confirm(`Xóa sự kiện “${event.title}”?`)) return;
    try {
      await axios.delete(`/api/events/${event._id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setEvents(current => current.filter(item => item._id !== event._id));
      toast.success('Đã xóa sự kiện.');
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể xóa sự kiện.'); }
  };

  return <main className="mx-auto my-10 max-w-6xl px-4">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Gói Ban tổ chức · 79.000đ / 30 ngày</p><h1 className="mt-1 text-3xl font-black">Sự kiện của tôi</h1><p className="mt-2 text-slate-500">Đã tạo {monthCount}/5 sự kiện trong tháng này · giới hạn 200 người mỗi sự kiện.</p></div><Link to="/add" className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">+ Tạo sự kiện</Link></div>
    {loading ? <p className="py-12 text-center text-slate-500">Đang tải...</p> : events.length ? <div className="grid gap-5">{events.map(event => <article key={event._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-4"><div><Link to={`/events/${event._id}`} className="text-xl font-black hover:text-indigo-600">{event.title}</Link><p className="mt-1 text-sm text-slate-500">{new Date(event.startDate).toLocaleString('vi-VN')} · {event.location?.address}, {event.location?.city}</p><p className="mt-1 text-sm font-semibold">{stats[event._id] ? `${stats[event._id].interested} đã xác nhận · ${stats[event._id].checkedIn} đã check-in · còn ${stats[event._id].remaining} chỗ` : `Còn ${Math.max(0, (event.totalSlots || 0) - (event.bookedSlots || 0))}/${event.totalSlots} chỗ`}</p></div><div className="flex gap-2"><Link to={`/edit-event/${event._id}`} className="rounded-lg border px-3 py-2 text-sm font-bold">Sửa</Link><button onClick={() => exportCsv(event)} className="rounded-lg border px-3 py-2 text-sm font-bold text-indigo-700">Xuất CSV</button><button onClick={() => deleteEvent(event)} className="rounded-lg border px-3 py-2 text-sm font-bold text-rose-600">Xóa</button></div></div><div className="mt-4 flex max-w-xl flex-wrap gap-2"><input value={codes[event._id] || ''} onChange={e => setCodes(current => ({ ...current, [event._id]: e.target.value }))} placeholder="Nhập mã xác nhận để check-in" className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2" /><button onClick={() => setScannerEvent(event)} className="rounded-lg border px-4 py-2 font-bold">Quét QR</button><button disabled={checking === event._id || !codes[event._id]} onClick={() => checkIn(event)} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">{checking === event._id ? 'Đang kiểm tra' : 'Check-in'}</button></div></article>)}</div> : <div className="rounded-2xl bg-slate-100 p-8 text-center dark:bg-slate-900"><p className="mb-4 text-slate-500">Bạn chưa có sự kiện nào.</p><Link to="/add" className="font-bold text-indigo-600">Tạo sự kiện đầu tiên</Link></div>}
    {scannerEvent && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 text-slate-900"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">Quét QR · {scannerEvent.title}</h2><button onClick={() => setScannerEvent(null)} className="rounded-lg border px-3 py-1 font-bold">Đóng</button></div><video ref={videoRef} muted playsInline className="aspect-square w-full rounded-xl bg-black object-cover" /><p className="mt-3 text-sm text-slate-500">Đưa mã QR xác nhận vào khung hình.</p></div></div>}
  </main>;
}
