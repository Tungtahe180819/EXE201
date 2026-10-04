import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Profile() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', avatar: '', bio: '', history: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    axios.get('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setProfile(res.data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [token]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put('/api/user/profile', {
        name: profile.name,
        phone: profile.phone,
        avatar: profile.avatar,
        bio: profile.bio
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Cập nhật hồ sơ thành công! ✨');
      setProfile(res.data.user);
    } catch (err) {
      setMessage('Lỗi khi cập nhật hồ sơ!', err);
    }
  };

  if (loading) return <div className="text-center py-20">Đang tải thông tin hồ sơ...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-6 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
          <img 
            src={profile.avatar || 'https://via.placeholder.com/150'} 
            alt="Avatar" 
            className="w-24 h-24 rounded-full object-cover border-4 border-indigo-600 shadow-lg"
          />
          <div>
            <h1 className="text-2xl font-black">{profile.name}</h1>
            <p className="text-slate-500">{profile.email}</p>
            <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-bold ${profile.role === 'user_vip' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300'}`}>
              {profile.role === 'user_vip' ? `👑 VIP đến ${new Date(profile.vipExpiresAt).toLocaleDateString('vi-VN')}` : 'Thành viên Eventverse'}
            </span>
          </div>
        </div>

        {(profile.role === 'user' || profile.role === 'user_vip') && (
          <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-black">👑 Eventverse VIP — 250.000đ / năm</h2>
                <p className="mt-1 text-sm">Mở khóa Lịch thông minh và Chatbot AI, đồng thời giữ nguyên toàn bộ quyền mua và quản lý vé.</p>
              </div>
              <span className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-black text-amber-700 shadow-sm dark:bg-amber-900 dark:text-amber-100">
                {profile.role === 'user_vip' ? `Còn hạn đến ${new Date(profile.vipExpiresAt).toLocaleDateString('vi-VN')}` : 'Chưa kích hoạt'}
              </span>
            </div>
            {profile.role !== 'user_vip' && (
              <p className="mt-3 text-xs font-semibold">Giai đoạn hiện tại: sau khi xác nhận thanh toán, Admin Master sẽ kích hoạt VIP thủ công trong trang Quản lý tài khoản.</p>
            )}
          </section>
        )}

        {message && <div className="bg-emerald-100 text-emerald-700 p-4 rounded-xl mb-6 font-semibold">{message}</div>}

        <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold mb-2">Họ và Tên</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none"
              value={profile.name}
              onChange={e => setProfile({...profile, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Số Điện Thoại</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none"
              placeholder="Nhập số điện thoại..."
              value={profile.phone}
              onChange={e => setProfile({...profile, phone: e.target.value})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-2">Đường dẫn Ảnh đại diện (Avatar URL)</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none"
              placeholder="https://example.com/avatar.jpg"
              value={profile.avatar}
              onChange={e => setProfile({...profile, avatar: e.target.value})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-2">Tiểu sử cá nhân (Bio)</label>
            <textarea 
              rows="3"
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none"
              placeholder="Giới thiệu ngắn gọn về bản thân bạn..."
              value={profile.bio}
              onChange={e => setProfile({...profile, bio: e.target.value})}
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition">
              Lưu Thay Đổi Hồ Sơ 💾
            </button>
          </div>
        </form>

        {/* Lịch sử cá nhân */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-bold mb-4">Lịch sử sự kiện / Giao dịch cá nhân</h3>
          {profile.history && profile.history.length > 0 ? (
            <ul className="space-y-3">
              {profile.history.map((item, index) => (
                <li key={index} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-center">
                  <span>Mã vé: {item._id || item}</span>
                  <span className="text-indigo-500 font-semibold">Đã thanh toán</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 italic">Bạn chưa có lịch sử giao dịch hoặc tham gia sự kiện nào.</p>
          )}
        </div>
      </div>
    </div>
  );
}
