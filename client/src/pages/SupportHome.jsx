import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function SupportHome() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Gọi API lấy danh sách sự kiện
    axios.get('/api/events')
      .then(res => setEvents(res.data))
      .catch(() => toast.error('Không thể tải danh sách sự kiện.'));
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-indigo-600">Admin Support</p>
          <h1 className="text-3xl font-bold">Quản lý sự kiện</h1>
        </div>
        <Link to="/add" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-xl shadow-md transition">
          + Tạo sự kiện mới
        </Link>
      </div>
      <table className="w-full border bg-white rounded-xl overflow-hidden">
        <thead><tr className="bg-gray-100 text-left">
          <th className="p-4">Tên sự kiện</th>
          <th className="p-4">Hành động</th>
        </tr></thead>
        <tbody>
          {events.map(ev => (
            <tr key={ev._id} className="border-b">
              <td className="p-4">{ev.title}</td>
              <td className="p-4 flex gap-2">
                <Link to={`/events/${ev._id}`} className="text-blue-600 font-semibold">Xem chi tiết</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
