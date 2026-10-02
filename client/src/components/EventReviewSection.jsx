import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function EventReviewSection({ eventId }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ average: 0, total: 0 });
  const [newComment, setNewComment] = useState('');
  const [rating, setRating] = useState(5);

  useEffect(() => {
    let active = true;
    axios.get(`/api/reviews/event/${eventId}`)
      .then(({ data }) => {
        if (!active) return;
        setReviews(data.reviews || []);
        setSummary({ average: data.average || 0, total: data.total || 0 });
      })
      .catch(() => toast.error('Không thể tải đánh giá.'));
    return () => { active = false; };
  }, [eventId]);

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) return toast.error('Vui lòng đăng nhập để đánh giá.');
    try {
      await axios.post(`/api/reviews/event/${eventId}`, { rating: Number(rating), comment: newComment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewComment('');
      toast.success('Đã lưu đánh giá.');
      const { data } = await axios.get(`/api/reviews/event/${eventId}`);
      setReviews(data.reviews || []);
      setSummary({ average: data.average || 0, total: data.total || 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu đánh giá.');
    }
  };

  const shareOnSocial = (platform) => {
    const url = window.location.href;
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=Tham gia sự kiện tuyệt vời này cùng mình nhé!`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      alert("Đã sao chép liên kết sự kiện vào bộ nhớ tạm!");
    }
  };

  return (
    <div className="mt-10 border-t border-slate-200 dark:border-slate-800 pt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-black">Đánh Giá & Bình Luận ({summary.total}) · {summary.average.toFixed(1)} ⭐</h3>
        
        {/* Nút chia sẻ mạng xã hội */}
        <div className="flex gap-2">
          <button onClick={() => shareOnSocial('facebook')} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:opacity-90">
            📘 Chia sẻ Facebook
          </button>
          <button onClick={() => shareOnSocial('twitter')} className="px-3 py-1.5 bg-sky-500 text-white rounded-xl text-xs font-bold hover:opacity-90">
            🐦 Twitter
          </button>
          <button onClick={() => shareOnSocial('copy')} className="px-3 py-1.5 bg-slate-700 text-white rounded-xl text-xs font-bold hover:opacity-90">
            🔗 Sao chép Link
          </button>
        </div>
      </div>

      {/* Form viết đánh giá */}
      <form onSubmit={handleAddReview} className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl mb-8 space-y-4">
        <h4 className="font-bold text-sm">Để lại đánh giá của bạn</h4>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Số sao:</span>
          <select value={rating} onChange={e => setRating(e.target.value)} className="px-3 py-1.5 rounded-lg border dark:bg-slate-800">
            <option value="5">⭐⭐⭐⭐⭐ (5 sao)</option>
            <option value="4">⭐⭐⭐⭐ (4 sao)</option>
            <option value="3">⭐⭐⭐ (3 sao)</option>
            <option value="2">⭐⭐ (2 sao)</option>
            <option value="1">⭐ (1 sao)</option>
          </select>
        </div>
        <textarea 
          rows="3" 
          placeholder="Viết nhận xét của bạn về sự kiện này..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-indigo-600 text-sm"
          required
        ></textarea>
        <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow">
          Gửi Đánh Giá
        </button>
      </form>

      {/* Danh sách bình luận */}
      <div className="space-y-4">
        {reviews.length === 0 && <p className="text-sm text-slate-500">Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận.</p>}
        {reviews.map(rev => (
          <div key={rev._id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm">{rev.userId?.name || 'Thành viên Eventverse'}</span>
              <span className="text-xs text-slate-400">{new Date(rev.createdAt).toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="text-amber-500 text-xs mb-2">{'⭐'.repeat(rev.rating)}</div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{rev.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
