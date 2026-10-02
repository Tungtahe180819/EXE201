import { useState } from 'react';
import axios from 'axios';

export default function ContactSurveyModal() {
  const [form, setForm] = useState({ name: '', email: '', feedback: '', rating: '5' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/feedback', form, {
        headers: localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi góp ý.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-xl mx-auto my-10">
      <h3 className="text-2xl font-black mb-2">Khảo Sát & Góp Ý Trải Nghiệm</h3>
      <p className="text-slate-500 text-sm mb-6">Hãy chia sẻ ý kiến để giúp Eventverse cải thiện chất lượng dịch vụ tốt hơn.</p>

      {error && <div className="mb-4 rounded-xl bg-rose-100 p-3 text-sm font-semibold text-rose-600">{error}</div>}
      {submitted ? (
        <div className="bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 p-4 rounded-2xl text-center font-bold">
          🎉 Cảm ơn bạn đã đóng góp ý kiến! Chúng tôi đã ghi nhận.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Họ và tên</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
              placeholder="Nhập họ tên của bạn..."
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Email liên hệ</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
              placeholder="name@example.com"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Đánh giá mức độ hài lòng</label>
            <select 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
              value={form.rating}
              onChange={e => setForm({...form, rating: e.target.value})}
            >
              <option value="5">⭐⭐⭐⭐⭐ Tuyệt vời (5/5)</option>
              <option value="4">⭐⭐⭐⭐ Rất tốt (4/5)</option>
              <option value="3">⭐⭐⭐ Bình thường (3/5)</option>
              <option value="2">⭐⭐ Cần cải thiện (2/5)</option>
              <option value="1">⭐ Kém (1/5)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Ý kiến đóng góp / Nội dung liên hệ</label>
            <textarea 
              rows="4" 
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600"
              placeholder="Nhập nội dung bạn muốn gửi cho chúng tôi..."
              value={form.feedback}
              onChange={e => setForm({...form, feedback: e.target.value})}
            ></textarea>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition disabled:opacity-60">
            {loading ? 'Đang gửi...' : 'Gửi Góp Ý Ngay'}
          </button>
        </form>
      )}
    </div>
  );
}
