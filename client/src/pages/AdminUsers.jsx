import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
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

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Quản lý tài khoản</h2>
      <div className="bg-white rounded-xl shadow-sm border">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">Username</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map(user => (
                <tr key={user._id} className="border-b">
                  <td className="p-4">{user.username}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4 text-gray-500">{user.role}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="p-4 text-center text-gray-500">Không có dữ liệu người dùng</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
