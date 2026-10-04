import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import NotificationMenu from './NotificationMenu';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ role, setRole, theme, toggleTheme }) {
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const t = lang === 'en' ? {
    search: 'Search events, workshops, music, art...', home: 'Home', calendar: 'Calendar', feedback: 'Feedback',
    dashboard: 'Dashboard', manage: 'Manage events', create: '+ Create event', cart: 'Cart', tickets: 'My tickets',
    profile: 'Profile 👤', logout: 'Log out', login: 'Log in', register: 'Sign up',
    lightTheme: 'Switch to light mode', darkTheme: 'Switch to dark mode'
  } : {
    search: 'Tìm kiếm sự kiện, hội thảo, âm nhạc, nghệ thuật...', home: 'Trang chủ', calendar: 'Lịch sự kiện', feedback: 'Góp ý',
    dashboard: 'Dashboard', manage: 'Quản lý sự kiện', create: '+ Tạo sự kiện', cart: 'Giỏ hàng', tickets: 'Vé của tôi',
    profile: 'Hồ Sơ 👤', logout: 'Đăng Xuất', login: 'Đăng Nhập', register: 'Đăng Ký',
    lightTheme: 'Chuyển sang giao diện sáng', darkTheme: 'Chuyển sang giao diện tối'
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/events?search=${encodeURIComponent(keyword)}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    setRole(null);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
        
        {/* Logo hệ thống */}
        <Link to="/" className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
          Eventverse 🌐
        </Link>

        {/* Thanh tìm kiếm toàn hệ thống (Global Search Engine) ở vị trí trung tâm */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl relative hidden md:block">
          <input 
            type="text" 
            placeholder={t.search}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <span className="absolute left-4 top-3.5 text-slate-400 text-lg">🔍</span>
        </form>

        {/* Điều hướng tài khoản / Hồ sơ */}
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold text-sm hover:text-indigo-600 transition hidden lg:block">{t.home}</Link>
          <Link to="/calendar" className="font-semibold text-sm hover:text-indigo-600 transition hidden xl:block">{t.calendar}</Link>
          {role === 'admin_master' ? (
            <Link to="/admin/feedback" className="font-semibold text-sm hover:text-indigo-600 transition hidden xl:block">Nhận góp ý</Link>
          ) : (
            <Link to="/feedback" className="font-semibold text-sm hover:text-indigo-600 transition hidden xl:block">{t.feedback}</Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t.lightTheme : t.darkTheme}
            title={theme === 'dark' ? t.lightTheme : t.darkTheme}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-100 text-lg shadow-sm transition hover:scale-105 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {role === 'admin_master' && (
            <>
              <Link to="/admin/dashboard" className="font-semibold text-sm hover:text-indigo-600 transition hidden lg:block">{t.dashboard}</Link>
              <Link to="/admin/users" className="font-semibold text-sm hover:text-indigo-600 transition hidden xl:block">Quản lý tài khoản</Link>
            </>
          )}
          {(role === 'admin_support' || role === 'admin_master') && (
            <>
              <Link to="/admin/events" className="font-semibold text-sm hover:text-indigo-600 transition hidden lg:block">
                {t.manage}
              </Link>
              <Link to="/add" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md transition">
                {t.create}
              </Link>
            </>
          )}
          {role === 'user' && (
            <>
              <Link to="/cart" className="font-semibold text-sm hover:text-indigo-600 transition">{t.cart}</Link>
              <Link to="/my-tickets" className="font-semibold text-sm hover:text-indigo-600 transition hidden sm:block">{t.tickets}</Link>
            </>
          )}
          {role ? (
            <div className="flex items-center gap-3">
              {role === 'user' && <NotificationMenu />}
              <Link to="/profile" className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold px-4 py-2 rounded-xl text-sm">
                {t.profile}
              </Link>
              <button onClick={handleLogout} className="bg-rose-50 text-rose-600 font-bold px-4 py-2 rounded-xl text-sm hover:bg-rose-100 transition">
                {t.logout}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="font-bold px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-xl transition">{t.login}</Link>
              <Link to="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md transition">{t.register}</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
