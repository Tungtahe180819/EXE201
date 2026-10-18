import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import AIPlannerModal from '../components/AIPlannerModal';
import VipUpgradeModal from '../components/VipUpgradeModal';

const emptyForm = { title: '', startAt: '', endAt: '', note: '', reminderMinutes: '15' };

export default function EventCalendar() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => 'Notification' in window && Notification.permission === 'granted');
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const isVip = role === 'user_vip';

  const loadCalendar = useCallback(async () => {
    if (!token) { setEntries([]); setItineraries([]); setLoading(false); return; }
    try {
      const [entryResponse, itineraryResponse] = await Promise.all([
        axios.get('/api/user/calendar', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/user/itineraries', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setEntries(entryResponse.data);
      setItineraries(itineraryResponse.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải lịch cá nhân.');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    loadCalendar();
    const refresh = () => loadCalendar();
    window.addEventListener('itinerary-saved', refresh);
    return () => window.removeEventListener('itinerary-saved', refresh);
  }, [loadCalendar]);

  const calendarEvents = useMemo(() => [
    ...entries.map(entry => ({
      id: `personal-${entry._id}`,
      title: `📝 ${entry.title}`,
      start: entry.startAt,
      end: entry.endAt || undefined,
      backgroundColor: '#4f46e5',
      borderColor: '#4f46e5'
    })),
    ...itineraries.map(item => ({
      id: `itinerary-${item._id}`,
      title: `🤖 ${item.title}`,
      start: item.startDate,
      end: item.endDate,
      backgroundColor: '#059669',
      borderColor: '#059669'
    }))
  ], [entries, itineraries]);

  const enableNotifications = async () => {
    if (!('Notification' in window)) return toast.error('Trình duyệt này không hỗ trợ thông báo.');
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') toast.success('Đã bật thông báo lịch. Bạn vẫn có thể xem nhắc nhở trong chuông thông báo Eventverse.');
    else toast.error('Bạn chưa cấp quyền thông báo cho trình duyệt.');
  };

  const saveEntry = async event => {
    event.preventDefault();
    if (!token) { toast.error('Đăng nhập để tạo lịch cá nhân.'); navigate('/login'); return; }
    if (!form.title.trim() || !form.startAt) return toast.error('Vui lòng nhập tên lịch và thời gian bắt đầu.');
    setSaving(true);
    try {
      await axios.post('/api/user/calendar', {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        reminderMinutes: Number(form.reminderMinutes)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setForm(emptyForm);
      toast.success('Đã lưu lịch cá nhân. Eventverse sẽ tạo nhắc nhở theo thời gian bạn chọn.');
      await loadCalendar();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu lịch cá nhân.');
    } finally { setSaving(false); }
  };

  const removeEntry = async id => {
    try {
      await axios.delete(`/api/user/calendar/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setEntries(current => current.filter(entry => entry._id !== id));
      toast.success('Đã xóa lịch cá nhân.');
    } catch (error) { toast.error(error.response?.data?.message || 'Không thể xóa lịch.'); }
  };

  return <>
    <main className="mx-auto my-8 grid max-w-7xl gap-6 px-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-black">📅 Lịch của tôi</h1><p className="mt-1 text-sm text-slate-500">Lịch cá nhân và lịch trình AI đã lưu. Sự kiện đã quan tâm/tham gia nằm riêng trong Nhật ký tham gia.</p></div>
          <button onClick={() => isVip ? setAiOpen(true) : setVipModalOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white">🤖 Lên lịch bằng AI{!isVip && ' · VIP'}</button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-sm dark:bg-indigo-950/40">
          <span className="font-semibold">Nhắc lịch được tạo ở phía máy chủ và xuất hiện trong chuông thông báo.</span>
          <button type="button" onClick={enableNotifications} className="rounded-lg border border-indigo-300 px-3 py-2 font-bold text-indigo-700 dark:text-indigo-200">{notificationsEnabled ? '🔔 Thông báo đã bật' : 'Bật thông báo trình duyệt'}</button>
        </div>
        {loading ? <div className="grid h-96 place-items-center text-slate-500">Đang tải lịch...</div> : <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          events={calendarEvents}
          height="auto"
          locale="vi"
          noEventsContent="Chưa có lịch cá nhân. Hãy thêm ghi chú hoặc tạo lịch trình AI."
        />}
      </section>

      <aside className="space-y-6">
        <form onSubmit={saveEntry} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black">Thêm lịch / ghi chú</h2>
          <label className="mt-4 block text-sm font-bold">Tên lịch</label>
          <input required maxLength="160" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ví dụ: Gặp nhóm dự án" className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2.5 dark:border-slate-700" />
          <label className="mt-4 block text-sm font-bold">Bắt đầu</label>
          <input required type="datetime-local" value={form.startAt} onChange={e => setForm({ ...form, startAt: e.target.value })} className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2.5 dark:border-slate-700" />
          <label className="mt-4 block text-sm font-bold">Kết thúc (không bắt buộc)</label>
          <input type="datetime-local" value={form.endAt} onChange={e => setForm({ ...form, endAt: e.target.value })} className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2.5 dark:border-slate-700" />
          <label className="mt-4 block text-sm font-bold">Nhắc trước</label>
          <select value={form.reminderMinutes} onChange={e => setForm({ ...form, reminderMinutes: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
            <option value="0">Không nhắc</option><option value="5">5 phút</option><option value="15">15 phút</option><option value="30">30 phút</option><option value="60">1 giờ</option><option value="1440">1 ngày</option>
          </select>
          <label className="mt-4 block text-sm font-bold">Ghi chú</label>
          <textarea rows="3" maxLength="2000" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Việc cần chuẩn bị, địa điểm, liên hệ..." className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2.5 dark:border-slate-700" />
          <button disabled={saving} className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-60">{saving ? 'Đang lưu...' : 'Lưu vào lịch của tôi'}</button>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-black">Ghi chú sắp tới ({entries.length})</h2>
          <div className="space-y-3">{entries.length ? entries.map(entry => <article key={entry._id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><div className="flex justify-between gap-3"><strong>{entry.title}</strong><button onClick={() => removeEntry(entry._id)} className="text-sm font-bold text-rose-600">Xóa</button></div><p className="mt-1 text-sm text-slate-500">{new Date(entry.startAt).toLocaleString('vi-VN')}</p>{entry.note && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.note}</p>}<p className="mt-2 text-xs text-indigo-600">{entry.reminderMinutes ? `Nhắc trước ${entry.reminderMinutes >= 1440 ? '1 ngày' : `${entry.reminderMinutes} phút`}` : 'Không nhắc'}</p></article>) : <p className="text-sm text-slate-500">Chưa có ghi chú cá nhân.</p>}</div>
          {itineraries.length > 0 && <div className="mt-5 border-t pt-4 dark:border-slate-700"><h3 className="mb-2 font-bold">Lịch AI đã lưu</h3>{itineraries.map(item => <p key={item._id} className="py-1 text-sm">🤖 {item.title} · {new Date(item.startDate).toLocaleDateString('vi-VN')}–{new Date(item.endDate).toLocaleDateString('vi-VN')}</p>)}</div>}
        </section>
      </aside>
    </main>
    {aiOpen && <AIPlannerModal onClose={() => setAiOpen(false)} />}
    <VipUpgradeModal isOpen={vipModalOpen} onClose={() => setVipModalOpen(false)} />
  </>;
}
