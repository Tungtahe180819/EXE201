import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  // Hàm lấy danh sách sự kiện
  const fetchEvents = async () => {
    try {
      const res = await axios.get('/api/events');
      setEvents(res.data);
    } catch (err) {
      toast.error("Không thể tải danh sách sự kiện", err);
    }
  };

  useEffect(() => {
    // 1. Kiểm tra phân quyền
    if (role !== "admin_support" && role !== "admin_master") {
      toast.error("Bạn không có quyền truy cập khu vực này!");
      navigate("/");
      return;
    }

    // 2. Lấy dữ liệu khi vào trang
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [navigate, role]);

  // Hàm xử lý Xóa
  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      try {
        const token = localStorage.getItem("token");
        await axios.delete(`/api/events/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Cập nhật lại state để UI tự render lại danh sách mới
        setEvents(prev => prev.filter(e => e._id !== id));
        toast.success("Đã xóa sự kiện thành công");
      } catch {
        toast.error("Lỗi khi xóa sự kiện");
      }
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Quản lý sự kiện</h2>
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full font-semibold">
            Tổng: {events.length}
          </span>
          <button onClick={() => navigate('/add')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl transition">
            + Tạo sự kiện
          </button>
        </div>
      </div>

      {events.length > 0 ? (
        <div className="space-y-4">
          {events.map(event => (
            <div key={event._id} className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
              <span className="font-bold text-lg text-gray-700">{event.title}</span>
              <div className="flex gap-4">
                <button onClick={() => navigate(`/events/${event._id}`)} className="text-slate-600 font-semibold hover:bg-slate-50 px-4 py-2 rounded-lg transition">
                  Xem
                </button>
                <button
                  onClick={() => navigate(`/edit-event/${event._id}`)}
                  className="text-blue-600 font-semibold hover:bg-blue-50 px-4 py-2 rounded-lg transition"
                >
                  Sửa
                </button>
                <button
                  onClick={() => handleDelete(event._id)}
                  className="text-red-500 font-semibold hover:bg-red-50 px-4 py-2 rounded-lg transition"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-gray-500">Hiện tại chưa có sự kiện nào.</p>
        </div>
      )}
    </div>
  );
}
