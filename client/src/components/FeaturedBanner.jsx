import { useState, useEffect } from 'react';
import axios from 'axios';

export default function FeaturedBanner() {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Gọi API lấy danh sách sự kiện tiêu điểm cho Banner
    axios.get('/api/events/featured')
      .then(res => {
        if (res.data && res.data.length > 0) {
          setBanners(res.data);
        } else {
          // Dữ liệu mẫu mặc định nếu Database chưa có sự kiện featured
          setBanners([
            {
              _id: '1',
              name: 'Đại Hội Âm Nhạc Mùa Hè - Summer Fest 2026',
              description: 'Sơ đồ trải nghiệm âm nhạc hoành tráng nhất khu vực công nghệ.',
              image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80'
            },
            {
              _id: '2',
              name: 'Ngày Hội Công Nghệ AI & Web Architecture',
              description: 'Gặp gỡ các chuyên gia hàng đầu về giải pháp Full-stack & Cloud.',
              image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80'
            }
          ]);
        }
      })
      .catch(() => {
        // Fallback dữ liệu mẫu khi lỗi kết nối
        setBanners([
          {
            _id: '1',
            name: 'Đại Hội Âm Nhạc Mùa Hè - Summer Fest 2026',
            description: 'Sơ đồ trải nghiệm âm nhạc hoành tráng nhất khu vực công nghệ.',
            image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80'
          }
        ]);
      });
  }, []);

  // Tự động chuyển slide sau mỗi 5 giây
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 my-6">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[380px] md:h-[450px] bg-slate-900 flex items-end">
        <img 
          src={currentBanner.image} 
          alt={currentBanner.name} 
          className="absolute inset-0 w-full h-full object-cover opacity-60 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
        
        {/* Nội dung tiêu điểm trên Banner */}
        <div className="relative z-10 p-8 md:p-12 max-w-3xl">
          <span className="bg-indigo-600 text-white text-xs font-black uppercase px-3 py-1.5 rounded-full tracking-wider mb-3 inline-block">
            Sự Kiện Tiêu Điểm 🔥
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight">
            {currentBanner.name}
          </h2>
          <p className="text-slate-300 text-sm md:text-base line-clamp-2 mb-6">
            {currentBanner.description}
          </p>
          <button className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg transition">
            Khám Phá Ngay 🚀
          </button>
        </div>

        {/* Nút chuyển đổi slide thủ công */}
        <div className="absolute bottom-6 right-6 z-10 flex gap-2">
          {banners.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-3 h-3 rounded-full transition-all ${currentIndex === idx ? 'bg-indigo-500 w-8' : 'bg-white/50'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
