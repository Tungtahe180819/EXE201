import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function Auth({ setRole }) {
  const location = useLocation();
  const isLoginMode = location.pathname === '/login';
  
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLoginMode 
      ? '/api/auth/login'
      : '/api/auth/register';

    // Đảm bảo các trường không bị undefined trước khi gửi
    const payload = isLoginMode 
      ? { 
          email: formData.email ? formData.email.trim() : '', 
          password: formData.password ? formData.password.trim() : '' 
        }
      : { 
          name: formData.name ? formData.name.trim() : '', 
          email: formData.email ? formData.email.trim() : '', 
          password: formData.password ? formData.password.trim() : '' 
        };

    try {
      const res = await axios.post(endpoint, payload);
      if (isLoginMode) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        if (setRole) setRole(res.data.role);
        navigate('/');
      } else {
        alert('Đăng ký thành công! Vui lòng đăng nhập.');
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đã có lỗi xảy ra kết nối tới máy chủ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800">
        <h2 className="text-3xl font-black text-center mb-6 text-indigo-600 dark:text-indigo-400">
          {isLoginMode ? 'Đăng Nhập Hệ Thống 🔑' : 'Khởi Tạo Tài Khoản 🚀'}
        </h2>

        {error && (
          <div className="bg-rose-100 text-rose-600 p-3 rounded-xl mb-4 text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && (
            <div>
              <label className="block text-sm font-bold mb-1">Họ và tên</label>
              <input 
                type="text" 
                name="name"
                required 
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nguyễn Văn A"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold mb-1">Địa chỉ Email</label>
            <input 
              type="email" 
              name="email"
              required 
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Mật khẩu bảo mật</label>
            <input 
              type="password" 
              name="password"
              required 
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
            />
            {isLoginMode && (
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
                  Quên mật khẩu?
                </Link>
              </div>
            )}
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : (isLoginMode ? 'Đăng Nhập Ngay' : 'Đăng Ký Tài Khoản')}
          </button>
        </form>
      </div>
    </div>
  );
}
