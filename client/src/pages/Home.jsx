import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AIPlannerModal from '../components/AIPlannerModal';
import FilterSection from '../components/FilterSection';
import { formatEventPrice, isFreePrice } from '../utils/formatPrice';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    // Gọi API lấy danh sách sự kiện từ Backend (Port 9999)
    axios.get('/api/events')
      .then(res => {
        const eventData = Array.isArray(res.data) ? res.data : (res.data.events || []);
        setEvents(eventData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Lỗi kết nối API sự kiện:", err);
        setLoading(false);
      });
  }, []);

  // Tự động chuyển slide cho Màn hình lớn Spotlight (mỗi 5 giây)
  useEffect(() => {
    if (events.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % Math.min(events.length, 5));
    }, 5000);
    return () => clearInterval(interval);
  }, [events]);

  const filteredEvents = selectedCategory === 'all'
    ? events
    : events.filter(event => event.category === selectedCategory);
  const featuredEvents = events.filter(event => event.image || event.imageUrl).slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-300">
      
      {/* --- MÀN HÌNH LỚN (HERO SPOTLIGHT) NỔI BẬT SỰ KIỆN TRONG THÁNG --- */}
      <div className="relative w-full h-[500px] md:h-[550px] bg-slate-900 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex items-center justify-center h-full text-indigo-400 font-semibold text-lg">
            Đang tải tâm điểm sự kiện trong tháng...
          </div>
        ) : featuredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">Chào mừng đến với Eventverse 🎟️</h1>
            <p className="text-slate-400 mb-6">Khám phá các sự kiện giải trí và công nghệ đỉnh cao ngay hôm nay.</p>
            <button 
              onClick={() => setIsAIModalOpen(true)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-lg"
            >
              Trải nghiệm Trợ Lý AI Lịch Trình ✨
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {featuredEvents.map((ev, idx) => (
              <div 
                key={ev._id || idx}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out flex items-center ${
                  idx === currentIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                <img
                  src={ev.imageUrl || ev.image || FALLBACK_IMAGE}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-indigo-950/90 to-purple-950/80 z-10" />
                
                <div className="relative z-20 max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div>
                    <span className="bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4 inline-block shadow-lg">
                      🔥 Tâm điểm sự kiện trong tháng
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4">
                      {ev.title || ev.name}
                    </h1>
                    <p className="text-slate-300 text-sm md:text-base line-clamp-3 mb-6">
                      {ev.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-indigo-300 mb-6 font-medium">
                      <span>📍 {ev.location?.address || 'Hà Nội'}</span>
                      <span>🎟️ {formatEventPrice(ev.price)}</span>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => navigate(`/events/${ev._id}`)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-xl transition transform hover:scale-105"
                      >
                        Xem Chi Tiết & Đặt Vé 🎫
                      </button>
                      <button 
                        onClick={() => setIsAIModalOpen(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold px-6 py-3 rounded-xl transition"
                      >
                        Lên Lịch AI 🤖
                      </button>
                    </div>
                  </div>
                  
                  <div className="hidden md:flex justify-center">
                    <div className="relative w-80 h-96 overflow-hidden rounded-3xl border border-white/20 shadow-2xl transform rotate-2 hover:rotate-0 transition duration-500">
                      <img src={ev.imageUrl || ev.image || FALLBACK_IMAGE} alt={ev.title || ev.name} className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 m-4 bg-black/45 backdrop-blur-md rounded-2xl p-4 text-white">
                        <span className="text-xs uppercase tracking-widest font-bold opacity-80">Eventverse Spotlight</span>
                        <h3 className="text-xl font-bold mt-1">{ev.title || ev.name}</h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center gap-2">
              {featuredEvents.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-pink-500 w-8' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- DANH SÁCH TOÀN BỘ SỰ KIỆN --- */}
      <div className="max-w-7xl mx-auto px-4 mt-16">
        <FilterSection selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black border-l-8 border-indigo-600 pl-4">Tất Cả Sự Kiện</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Đang hiển thị {filteredEvents.length} sự kiện</span>
        </div>
        
        {loading ? (
          <p className="text-center text-slate-500 py-12">Đang tải danh sách sự kiện...</p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-center text-slate-500 py-12">Không có sự kiện phù hợp với bộ lọc.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredEvents.map(ev => (
              <div 
                key={ev._id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition duration-300"
                onClick={() => navigate(`/events/${ev._id}`)}
              >
                {/* 👉 THẺ HIỂN THỊ ẢNH SỰ KIỆN */}
                <div className="h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img 
                    src={ev.imageUrl || ev.image || FALLBACK_IMAGE}
                    alt={ev.title || ev.name} 
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-6 flex flex-col justify-between flex-grow">
                  <div>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full font-bold">
                      {ev.category || 'Sự kiện hot'}
                    </span>
                    <h3 className="text-xl font-bold mt-4 mb-2 text-slate-900 dark:text-white line-clamp-1">
                      {ev.title || ev.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-3 mb-4">
                      {ev.description}
                    </p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-black ${isFreePrice(ev.price) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
                      🎟️ {formatEventPrice(ev.price)}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-indigo-500 font-semibold mb-4">📍 {ev.location?.address || 'Hà Nội'}</div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/events/${ev._id}`);
                      }}
                      className="w-full block text-center bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold shadow-lg transition"
                    >
                      Xem Chi Tiết & Mua Vé 🎫
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL TRỢ LÝ AI LÊN LỊCH --- */}
      <AIPlannerModal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
      />
    </div>
  );
}
