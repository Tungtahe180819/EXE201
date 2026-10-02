import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(token ? '' : 'Liên kết đặt lại mật khẩu không hợp lệ.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password.length < 8) return setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
    if (password !== confirmPassword) return setError('Mật khẩu xác nhận không khớp.');

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/reset-password', { token, password });
      setMessage(response.data.message);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể đặt lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800">
        <h2 className="text-3xl font-black text-center mb-6 text-indigo-600 dark:text-indigo-400">Đặt mật khẩu mới 🔑</h2>
        {message && <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl mb-4 text-sm font-semibold">{message}</div>}
        {error && <div className="bg-rose-100 text-rose-600 p-3 rounded-xl mb-4 text-sm font-semibold">{error}</div>}
        {!message && token && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Mật khẩu mới</label>
              <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tối thiểu 8 ký tự" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Nhập lại mật khẩu</label>
              <input type="password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nhập lại mật khẩu mới" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition disabled:opacity-50">
              {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </button>
          </form>
        )}
        <div className="text-center mt-5"><Link to="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">Quay lại đăng nhập</Link></div>
      </div>
    </div>
  );
}
