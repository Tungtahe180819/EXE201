import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setMessage(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800">
        <h2 className="text-3xl font-black text-center mb-3 text-indigo-600 dark:text-indigo-400">Quên mật khẩu 🔐</h2>
        <p className="text-center text-slate-500 mb-6">Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.</p>
        {message && <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl mb-4 text-sm font-semibold">{message}</div>}
        {error && <div className="bg-rose-100 text-rose-600 p-3 rounded-xl mb-4 text-sm font-semibold">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Địa chỉ Email</label>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500" placeholder="name@example.com" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition disabled:opacity-50">
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
          </button>
        </form>
        <div className="text-center mt-5"><Link to="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">← Quay lại đăng nhập</Link></div>
      </div>
    </div>
  );
}
