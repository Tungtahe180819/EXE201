import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AIPlannerModal({ isOpen, onClose }) {
  const [form, setForm] = useState({
    destinationArea: '',
    startDate: '',
    endDate: '',
    userPreferences: ''
  });
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const itineraryText = typeof itinerary === 'string'
    ? itinerary
    : itinerary?.summary
      ? `${itinerary.summary}${itinerary.days?.length ? `\n\n${itinerary.days.map((day, index) => {
        const date = day.date ? new Date(day.date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
        return `${index + 1}. ${date ? `${date} — ` : ''}${day.title || day.activity || 'Hoạt động'}${day.venue ? `\n   Địa điểm: ${day.venue}` : ''}${day.price ? `\n   Giá vé: ${day.price}` : ''}${day.description ? `\n   ${day.description}` : ''}`;
      }).join('\n\n')}` : ''}`
      : JSON.stringify(itinerary, null, 2);

  if (!isOpen) return null;

  const handleGenerateItinerary = async () => {
    if (!form.destinationArea || !form.startDate || !form.endDate || !form.userPreferences.trim()) {
      const message = "Vui lòng nhập đầy đủ địa điểm, thời gian và sở thích!";
      setErrorMessage(message);
      toast.error(message);
      return;
    }
    if (form.endDate < form.startDate) {
      const message = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      setErrorMessage('');
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Vui lòng đăng nhập lại để tạo lịch trình.');
      
      // Gọi API Backend xử lý AI tạo lịch trình
      const res = await axios.post(
        '/api/ai/generate-itinerary',
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const plan = res.data?.data?.aiGeneratedPlan ?? res.data?.data?.plan ?? res.data?.plan;
      if (!plan) throw new Error('Máy chủ không trả về lịch trình. Vui lòng thử lại.');
      setItinerary(plan);
      toast.success("AI đã tạo lịch trình thành công cho bạn!");
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Lỗi khi tạo lịch trình AI.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-black flex items-center gap-2">
            🤖 Trợ Lý AI Lên Lịch Sự Kiện
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xl">✕</button>
        </div>

        {!itinerary ? (
          <div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
              Hãy cho AI biết bạn muốn tham gia sự kiện gì, thời gian nào (Ví dụ: *"Tôi muốn đi 2 sự kiện công nghệ vào cuối tuần này ở Cầu Giấy"*):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input
                value={form.destinationArea}
                onChange={(e) => setForm({ ...form, destinationArea: e.target.value })}
                placeholder="Khu vực, thành phố"
                className="p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="p-3 rounded-xl border bg-transparent" />
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="p-3 rounded-xl border bg-transparent" />
              </div>
            </div>
            <textarea
              rows="4"
              value={form.userPreferences}
              onChange={(e) => setForm({ ...form, userPreferences: e.target.value })}
              placeholder="Nhập yêu cầu của bạn tại đây..."
              className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 mb-4"
            />
            {errorMessage && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {errorMessage}
              </div>
            )}
            <button
              onClick={handleGenerateItinerary}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition shadow-lg"
            >
              {loading ? 'AI đang phân tích và lên lịch...' : 'Phân tích & Tạo Lịch Trình'}
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold mb-3 text-indigo-600">✨ Lịch trình gợi ý dành riêng cho bạn:</h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl max-h-80 overflow-y-auto mb-6 space-y-3 text-sm">
              {/* Hiển thị kết quả AI trả về */}
              <pre className="whitespace-pre-wrap leading-relaxed font-sans">{itineraryText}</pre>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setItinerary(null)}
                className="w-1/2 bg-slate-200 dark:bg-slate-800 font-bold py-3 rounded-2xl"
              >
                Nhập lại
              </button>
              <button
                onClick={() => {
                  toast.success("Lịch trình AI đã được lưu vào tài khoản của bạn!");
                  window.dispatchEvent(new CustomEvent('itinerary-saved'));
                  onClose();
                }}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl shadow-md"
              >
                Xác nhận & Lưu Lịch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
