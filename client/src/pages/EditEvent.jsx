import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const toLocalDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [originalDates, setOriginalDates] = useState({ startDate: '', endDate: '' });
  const [event, setEvent] = useState({
    title: '', category: '', description: '', price: 0, stock: 1, totalSlots: 1,
    image: '', startDate: '', endDate: '', location: { address: '', city: '' },
    recurrence: { isRecurring: false, frequency: 'none', untilDate: '' }, timezone: 'Asia/Ho_Chi_Minh'
  });

  useEffect(() => {
    axios.get(`/api/events/${id}`)
      .then(({ data }) => {
        const startDate = toLocalDateTime(data.startDate);
        const endDate = toLocalDateTime(data.endDate);
        setOriginalDates({ startDate, endDate });
        setEvent({
          ...data,
          startDate,
          endDate,
          location: data.location || { address: '', city: '' },
          recurrence: { ...data.recurrence, untilDate: data.recurrence?.untilDate ? toLocalDateTime(data.recurrence.untilDate).slice(0, 10) : '' },
        });
      })
      .catch(() => {
        toast.error('Không tìm thấy sự kiện.');
        navigate('/admin/events');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const setField = (field, value) => setEvent(current => ({ ...current, [field]: value }));
  const setLocation = (field, value) => setEvent(current => ({
    ...current,
    location: { ...current.location, [field]: value },
  }));

  const handleSubmit = async e => {
    e.preventDefault();
    const datesWereChanged = event.startDate !== originalDates.startDate || event.endDate !== originalDates.endDate;
    if (datesWereChanged && new Date(event.endDate) <= new Date(event.startDate)) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }

    try {
      setSubmitting(true);
      await axios.put(`/api/events/${id}`, {
        title: event.title,
        category: event.category,
        description: event.description,
        price: Number(event.price),
        stock: Number(event.totalSlots),
        totalSlots: Number(event.totalSlots),
        image: event.image,
        startDate: new Date(event.startDate).toISOString(),
        endDate: new Date(event.endDate).toISOString(),
        location: event.location,
        recurrence: event.recurrence,
        timezone: event.timezone,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      toast.success('Cập nhật sự kiện thành công!');
      navigate('/admin/events');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật sự kiện.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Đang tải sự kiện...</div>;

  return (
    <div className="mx-auto my-10 max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-8 flex items-center justify-between">
        <div><p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Quản lý sự kiện</p><h1 className="text-3xl font-black">Chỉnh sửa sự kiện</h1></div>
        <button type="button" onClick={() => navigate('/admin/events')} className="font-bold text-slate-500">Quay lại</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="font-semibold">Tên sự kiện<input required value={event.title} onChange={e => setField('title', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
          <label className="font-semibold">Danh mục<select required value={event.category} onChange={e => setField('category', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"><option value="Âm nhạc">Âm nhạc</option><option value="Công nghệ">Công nghệ</option><option value="Gaming">Gaming</option><option value="Thể thao">Thể thao</option><option value="Ẩm thực">Ẩm thực</option><option value="Nghệ thuật">Nghệ thuật</option><option value="Giáo dục">Giáo dục</option><option value="Khác">Khác</option></select></label>
        </div>
        <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={Boolean(event.recurrence?.isRecurring)} onChange={e => setField('recurrence', { ...event.recurrence, isRecurring: e.target.checked, frequency: e.target.checked ? (event.recurrence?.frequency === 'none' ? 'weekly' : event.recurrence?.frequency) : 'none' })} /> Sự kiện lặp lại</label>
          {event.recurrence?.isRecurring && <div className="grid gap-3 md:grid-cols-2"><select value={event.recurrence.frequency} onChange={e => setField('recurrence', { ...event.recurrence, frequency: e.target.value })} className="rounded-xl border p-3"><option value="daily">Hằng ngày</option><option value="weekly">Hằng tuần</option><option value="monthly">Hằng tháng</option></select><input type="date" value={event.recurrence.untilDate || ''} onChange={e => setField('recurrence', { ...event.recurrence, untilDate: e.target.value })} className="rounded-xl border p-3" /></div>}
          <label className="block font-semibold">Múi giờ<select value={event.timezone || 'Asia/Ho_Chi_Minh'} onChange={e => setField('timezone', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal"><option value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</option><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="Asia/Singapore">Singapore (UTC+8)</option><option value="UTC">UTC</option></select></label>
        </div>
        <label className="block font-semibold">Mô tả<textarea required rows="4" value={event.description || ''} onChange={e => setField('description', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="font-semibold">Giá vé<input required min="0" type="number" value={event.price} onChange={e => setField('price', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
          <label className="font-semibold">Tổng số vé<input required min="1" type="number" value={event.totalSlots} onChange={e => setField('totalSlots', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="font-semibold">Địa chỉ<input required value={event.location.address || ''} onChange={e => setLocation('address', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
          <label className="font-semibold">Thành phố<input required value={event.location.city || ''} onChange={e => setLocation('city', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        </div>
        <label className="block font-semibold">URL ảnh
          <input required type="url" value={event.image || ''} onChange={e => setField('image', e.target.value.trim())} className="mt-2 w-full rounded-xl border p-3 font-normal" />
        </label>
        {event.image && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
            <img
              src={event.image}
              alt="Xem trước ảnh sự kiện"
              className="h-56 w-full object-cover"
              onError={e => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling.style.display = 'block';
              }}
              onLoad={e => {
                e.currentTarget.style.display = 'block';
                e.currentTarget.nextElementSibling.style.display = 'none';
              }}
            />
            <p className="hidden p-4 text-sm font-semibold text-red-600">Không tải được ảnh từ URL này. Hãy kiểm tra URL ảnh công khai.</p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="font-semibold">Bắt đầu<input required type="datetime-local" value={event.startDate} onChange={e => setField('startDate', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
          <label className="font-semibold">Kết thúc<input required type="datetime-local" value={event.endDate} onChange={e => setField('endDate', e.target.value)} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        </div>
        <button disabled={submitting} className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
      </form>
    </div>
  );
}
