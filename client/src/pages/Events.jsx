import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { formatEventPrice } from '../utils/formatPrice';
import FilterSection from '../components/FilterSection';

export default function Events() {
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('search') || '';
  const [events, setEvents] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Khởi tạo trạng thái loading là true ngay từ đầu để tránh gọi setState đồng bộ trong useEffect
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Gọi API tìm kiếm và lọc danh mục từ Backend
    axios.get('/api/events/search', {
      params: { keyword, category: selectedCategory }
    })
      .then(res => {
        setEvents(res.data.events || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Lỗi tải sự kiện:", err);
        setLoading(false);
      });
  }, [keyword, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black mb-2">
        {keyword ? `Kết quả tìm kiếm cho: "${keyword}"` : "Khám Phá Tất Cả Sự Kiện"}
      </h1>
      <p className="text-slate-500 mb-6">Tìm thấy tổng cộng {events.length} sự kiện phù hợp.</p>

      {/* Thanh bộ lọc phân mảng */}
      <FilterSection selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />

      {/* Danh sách sự kiện trả về */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-medium">Đang tải dữ liệu sự kiện...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-slate-100 dark:bg-slate-900 rounded-3xl">
          <p className="text-lg font-bold text-slate-600 dark:text-slate-400">Không tìm thấy sự kiện nào phù hợp!</p>
          <Link to="/" className="mt-4 inline-block bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl shadow-md">Quay về trang chủ</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {events.map(event => (
            <Link key={event._id} to={`/events/${event._id}`} className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 hover:scale-[1.02] transition">
              <img src={event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'} alt={event.title} className="w-full h-48 object-cover" />
              <div className="p-6">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full">{event.category || 'Sự kiện'}</span>
                <h3 className="text-xl font-bold mt-3 mb-2 line-clamp-1">{event.title}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4">{event.description}</p>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-indigo-600">{formatEventPrice(event.price)}</span>
                  <span className="text-xs text-slate-400">Xem chi tiết &rarr;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
