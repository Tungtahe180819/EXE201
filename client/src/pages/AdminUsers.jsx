import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Kiểm tra quyền truy cập ngay khi load trang
    const role = localStorage.getItem("role");
    if (role !== "admin_master") {
      toast.error("Bạn không có quyền truy cập khu vực này!");
      navigate("/admin/dashboard");
      return;
    }

    // 2. Gọi API lấy dữ liệu chỉ khi đã xác thực là master
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get('/api/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } catch (err) {
        toast.error("Không thể tải danh sách người dùng", err);
      }
    };
    
    fetchUsers();
  }, [navigate]);

  const updateUser = async (id, changes) => {
    try {
      setUpdatingId(id);
      const { data } = await axios.patch(`/api/users/${id}`, changes, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(current => current.map(user => user._id === id ? data.user : user));
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật tài khoản.');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatVipExpiry = value => value
    ? new Date(value).toLocaleDateString('vi-VN')
    : '—';

  const changeRole = (user, role) => {
    if (role === 'user_vip' && !window.confirm(`Xác nhận đã nhận 250.000đ phí VIP 1 năm từ ${user.email}?`)) return;
    updateUser(user._id, { role });
  };

  const renewVip = user => {
    if (!window.confirm(`Xác nhận đã nhận thêm 250.000đ để gia hạn VIP 1 năm cho ${user.email}?`)) return;
    updateUser(user._id, { renewVip: true });
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto min-h-screen">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Admin Master</p>
        <h2 className="text-3xl font-black">Quản lý tài khoản</h2>
        <p className="text-slate-500">Quản lý {users.length} tài khoản trong hệ thống.</p>
        <p className="mt-2 text-sm font-semibold text-amber-600">👑 Gói khách hàng VIP: 250.000đ / 1 năm. payOS tự động kích hoạt sau thanh toán; Admin Master vẫn có thể hỗ trợ thủ công.</p>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">Tên</th>
              <th className="p-4">Email</th>
              <th className="p-4">Vai trò</th>
              <th className="p-4">Hạn VIP</th>
              <th className="p-4">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map(user => (
                <tr key={user._id} className="border-b">
                  <td className="p-4 font-bold">{user.name || user.username || 'Chưa cập nhật'}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">
                    {user.role === 'admin_master' ? <span className="font-bold text-indigo-600">Admin Master</span> : (
                      <select disabled={updatingId === user._id} value={user.role} onChange={event => changeRole(user, event.target.value)} className="rounded-lg border px-3 py-2 disabled:opacity-50">
                        <option value="user">Khách hàng</option>
                        <option value="user_vip">Khách hàng VIP</option>
                        <option value="admin_support">Admin Support</option>
                      </select>
                    )}
                  </td>
                  <td className="p-4">
                    {user.role === 'user_vip' ? (
                      <div className="space-y-2">
                        <p className="font-bold text-amber-600">Đến {formatVipExpiry(user.vipExpiresAt)}</p>
                        <button
                          type="button"
                          disabled={updatingId === user._id}
                          onClick={() => renewVip(user)}
                          className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 disabled:opacity-50"
                        >
                          + Gia hạn 1 năm
                        </button>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="p-4">
                    {user.role === 'admin_master' ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">Đang hoạt động</span> : (
                      <select disabled={updatingId === user._id} value={user.status || 'Active'} onChange={event => updateUser(user._id, { status: event.target.value })} className="rounded-lg border px-3 py-2 disabled:opacity-50">
                        <option value="Active">Đang hoạt động</option>
                        <option value="Inactive">Ngừng hoạt động</option>
                        <option value="Banned">Đã khóa</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">Không có dữ liệu người dùng</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
