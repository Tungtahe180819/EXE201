import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const statusLabels = { new: 'Mới', reviewed: 'Đã xem', resolved: 'Đã xử lý' };

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    axios.get('/api/feedback', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setFeedbacks(data))
      .catch(error => toast.error(error.response?.data?.message || 'Không thể tải góp ý.'))
      .finally(() => setLoading(false));
  }, [token]);

  const updateStatus = async (id, status) => {
    try {
      const { data } = await axios.patch(`/api/feedback/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedbacks(current => current.map(item => item._id === id ? data : item));
      toast.success('Đã cập nhật trạng thái góp ý.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật góp ý.');
    }
  };

  if (loading) return <div className="p-20 text-center">Đang tải góp ý...</div>;

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-6 md:p-10">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Khu vực quản trị</p>
        <h1 className="text-3xl font-black">Góp ý từ khách hàng</h1>
        <p className="mt-1 text-slate-500">Tổng cộng {feedbacks.length} phản hồi.</p>
      </div>
      {feedbacks.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Chưa có góp ý nào.</p> : (
        <div className="grid gap-4">
          {feedbacks.map(item => (
            <article key={item._id} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <h2 className="font-black">{item.name} · {'⭐'.repeat(item.rating)}</h2>
                  <p className="text-sm text-slate-500">{item.email} · {new Date(item.createdAt).toLocaleString('vi-VN')}</p>
                </div>
                <select value={item.status} onChange={event => updateStatus(item._id, event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold dark:border-slate-700 dark:bg-slate-800">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 dark:bg-slate-800">{item.feedback}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
