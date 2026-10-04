import { useNavigate } from 'react-router-dom';
import { VIP_PLAN_ID, VIP_PLAN_ITEM } from '../utils/vipPlan';

export default function VipUpgradeModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  if (!isOpen) return null;

  const goToCheckout = () => {
    let cart;
    try {
      cart = JSON.parse(localStorage.getItem('cart')) || [];
    } catch {
      cart = [];
    }
    if (!cart.some(item => item._id === VIP_PLAN_ID)) cart.push(VIP_PLAN_ITEM);
    localStorage.setItem('cart', JSON.stringify(cart));
    onClose();
    if (!isLoggedIn) {
      localStorage.setItem('postLoginRedirect', '/cart');
      navigate('/login');
      return;
    }
    navigate('/cart');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="vip-upgrade-title">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-300 bg-white shadow-2xl dark:border-amber-800 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-7 text-amber-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em]">Eventverse VIP</p>
              <h2 id="vip-upgrade-title" className="mt-1 text-3xl font-black">Nâng cấp để dùng AI 👑</h2>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/50 text-xl font-black hover:bg-white/70" aria-label="Đóng">×</button>
          </div>
        </div>

        <div className="p-6 text-slate-800 dark:text-slate-100">
          <div className="mb-5 rounded-2xl bg-amber-50 p-5 text-center dark:bg-amber-950/40">
            <p className="text-4xl font-black text-amber-600">250.000đ</p>
            <p className="mt-1 font-bold text-slate-500 dark:text-slate-300">cho 1 năm sử dụng</p>
          </div>
          <ul className="space-y-3 text-sm font-semibold">
            <li>✨ Tạo lịch trình sự kiện thông minh bằng AI</li>
            <li>🤖 Sử dụng Chatbot AI tư vấn sự kiện</li>
            <li>🎟️ Giữ nguyên toàn bộ quyền mua và quản lý vé</li>
          </ul>
          <p className="mt-5 rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Gói VIP sẽ được tự động kích hoạt sau khi payOS xác nhận giao dịch VietQR thành công.
          </p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Để sau</button>
            <button type="button" onClick={goToCheckout} className="flex-1 rounded-xl bg-amber-500 px-4 py-3 font-black text-amber-950 hover:bg-amber-400">Thanh toán</button>
          </div>
        </div>
      </div>
    </div>
  );
}
