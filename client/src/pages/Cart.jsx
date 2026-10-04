import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatEventPrice } from '../utils/formatPrice';
import { VIP_PLAN_ID } from '../utils/vipPlan';

export default function Cart() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [bankPayment, setBankPayment] = useState(null);
  const [activeOrderCode, setActiveOrderCode] = useState(() => new URLSearchParams(window.location.search).get('orderCode'));
  const [completedPayment, setCompletedPayment] = useState(null);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cart')) || [];
    } catch {
      return [];
    }
  });

  const saveCart = nextCart => {
    setCart(nextCart);
    localStorage.setItem('cart', JSON.stringify(nextCart));
  };

  useEffect(() => {
    if (!activeOrderCode) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    let stopped = false;

    const checkPayment = async () => {
      try {
        const { data } = await axios.get(`/api/payments/status/${activeOrderCode}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!stopped && data.status === 'Paid') {
          if (data.vipPlan) {
            localStorage.setItem('role', 'user_vip');
            try {
              const user = JSON.parse(localStorage.getItem('user')) || {};
              localStorage.setItem('user', JSON.stringify({ ...user, role: 'user_vip', vipExpiresAt: data.vipExpiresAt }));
            } catch {
              localStorage.setItem('user', JSON.stringify({ role: 'user_vip', vipExpiresAt: data.vipExpiresAt }));
            }
            window.dispatchEvent(new CustomEvent('role-updated', { detail: { role: 'user_vip' } }));
          }
          setCompletedPayment(data);
          setActiveOrderCode(null);
          localStorage.removeItem('cart');
          setCart([]);
          toast.success(data.vipPlan ? 'Thanh toán thành công! Gói VIP đã được kích hoạt.' : data.emailSent ? 'Thanh toán thành công! Vé đã được gửi qua email.' : 'Thanh toán thành công! Bạn có thể xem vé trong mục Vé của tôi.');
        }
      } catch (error) {
        if (error.response?.status !== 404) console.error('Không thể kiểm tra thanh toán:', error);
      }
    };

    checkPayment();
    const intervalId = window.setInterval(checkPayment, 3000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [activeOrderCode]);

  const updateQuantity = (item, delta) => {
    if (item.itemType === 'vip') return;
    const available = Math.max(1, (item.totalSlots || 100) - (item.bookedSlots || 0));
    const nextQuantity = Math.min(20, available, Math.max(1, item.quantity + delta));
    saveCart(cart.map(current => current._id === item._id ? { ...current, quantity: nextQuantity } : current));
  };

  const removeItem = id => {
    saveCart(cart.filter(item => item._id !== id));
    toast.success('Đã xóa khỏi giỏ hàng.');
  };

  const handleCheckout = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vui lòng đăng nhập để thanh toán.');
      navigate('/login');
      return;
    }

    try {
      setPaying(true);
      const hasVipPlan = cart.some(item => item._id === VIP_PLAN_ID || item.itemType === 'vip');
      const items = cart
        .filter(item => item._id !== VIP_PLAN_ID && item.itemType !== 'vip')
        .map(item => ({ eventId: item._id, quantity: item.quantity, ticketType: item.category }));
      if (totalPrice === 0) {
        const { data } = await axios.post('/api/payments/free', { items }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        localStorage.removeItem('cart');
        setCart([]);
        toast.success(data.message);
        navigate('/my-tickets', { replace: true });
        return;
      }
      const { data } = await axios.post('/api/payments/create', { items, vipPlan: hasVipPlan, provider: 'payos' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.qrDataURL) {
        setBankPayment(data);
        setActiveOrderCode(data.orderCode);
        window.history.replaceState({}, '', `/cart?orderCode=${encodeURIComponent(data.orderCode)}`);
        toast.success('Đã tạo mã VietQR payOS.');
        return;
      }
      throw new Error('Máy chủ không trả về mã VietQR.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toán thất bại, vui lòng thử lại.');
    } finally {
      setPaying(false);
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);

  if (completedPayment) return (
    <div className="mx-auto max-w-2xl p-10 text-center">
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-10 text-slate-900 shadow-xl">
        <div className="mb-4 text-6xl">✅</div>
        <h1 className="text-3xl font-black text-emerald-700">{completedPayment.vipPlan ? 'Nâng cấp VIP thành công' : completedPayment.free ? 'Nhận vé miễn phí thành công' : 'Thanh toán thành công'}</h1>
        <p className="mt-3">{completedPayment.emailSent ? 'Vé và mã vé đã được gửi tới email đăng ký của bạn.' : completedPayment.emailMessage || (completedPayment.vipPlan ? 'Bạn đã có thể sử dụng Lịch thông minh và Chatbot AI.' : 'Vé đã được phát hành. Bạn có thể xem vé trong mục Vé của tôi.')}</p>
        {completedPayment.orderCode && <p className="mt-2 text-sm text-slate-500">Mã đơn: {completedPayment.orderCode}</p>}
        <Link to={completedPayment.vipPlan ? '/profile' : '/my-tickets'} className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white">{completedPayment.vipPlan ? 'Xem hồ sơ VIP' : 'Xem vé của tôi'}</Link>
      </div>
    </div>
  );

  if (cart.length === 0) return (
    <div className="p-20 text-center">
      <h2 className="mb-4 text-2xl font-bold">Giỏ hàng trống!</h2>
      <Link to="/events" className="font-bold text-blue-600 underline">Tiếp tục chọn sự kiện</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="mb-8 text-3xl font-black">Giỏ hàng của bạn</h1>
      <div className="space-y-4">
        {cart.map(item => (
          <div key={item._id} className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">{item.title}</h2>
              <p className="text-sm text-slate-500">{formatEventPrice(item.price)} {item.itemType === 'vip' ? '/ 1 năm' : '/ vé'}</p>
            </div>
            <div className="flex items-center gap-3">
              {item.itemType !== 'vip' && <button onClick={() => updateQuantity(item, -1)} className="h-9 w-9 rounded-lg border font-bold">−</button>}
              <span className="w-8 text-center font-black">{item.quantity}</span>
              {item.itemType !== 'vip' && <button onClick={() => updateQuantity(item, 1)} className="h-9 w-9 rounded-lg border font-bold">+</button>}
              <button onClick={() => removeItem(item._id)} className="ml-2 font-bold text-red-500">Xóa</button>
            </div>
            <p className="text-lg font-black text-indigo-600">{formatEventPrice((Number(item.price) || 0) * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-indigo-600 p-6 text-white shadow-xl sm:flex-row">
        <div><p className="text-sm text-indigo-200">Tổng thanh toán</p><p className="text-3xl font-black">{formatEventPrice(totalPrice)}</p></div>
        <button disabled={paying} onClick={handleCheckout} className="rounded-xl bg-white px-8 py-3 font-bold text-indigo-600 disabled:opacity-60">
          {paying ? (totalPrice === 0 ? 'Đang phát hành vé...' : 'Đang tạo mã...') : totalPrice === 0 ? 'Nhận vé miễn phí' : bankPayment ? 'Tạo lại mã VietQR' : 'Thanh toán VietQR qua payOS'}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-black">{totalPrice === 0 ? 'Thông tin vé' : 'Phương thức thanh toán'}</h2>
        <div className="rounded-xl border border-indigo-600 bg-indigo-50 p-4 font-bold text-indigo-700 dark:bg-indigo-950">
          {totalPrice === 0 ? '🎁 Vé miễn phí • Không cần thanh toán' : '✅ VietQR • Xác nhận tự động bởi payOS'}
        </div>
        <p className="mt-4 text-xs text-slate-500">{totalPrice === 0 ? 'Nhấn “Nhận vé miễn phí” để hệ thống phát hành mã vé và gửi về email đăng ký.' : 'Quét mã bằng ứng dụng ngân hàng và giữ nguyên số tiền, nội dung chuyển khoản. Vé sẽ được phát hành tự động khi payOS xác nhận giao dịch.'}</p>
      </div>

      {bankPayment && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-slate-900">
          <h2 className="text-xl font-black">Quét mã để chuyển khoản</h2>
          <img src={bankPayment.qrDataURL} alt="Mã VietQR thanh toán" className="mx-auto my-4 max-h-[520px] rounded-xl" />
          <div className="mx-auto max-w-lg space-y-1 rounded-xl bg-white p-4 text-left shadow-sm">
            <p><strong>Ngân hàng:</strong> VietQR / payOS</p>
            <p><strong>Số tài khoản:</strong> {bankPayment.bankInfo?.accountNo}</p>
            <p><strong>Chủ tài khoản:</strong> {bankPayment.bankInfo?.accountName}</p>
            <p><strong>Số tiền:</strong> {formatEventPrice(bankPayment.amount || totalPrice)}</p>
            <p><strong>Nội dung:</strong> {bankPayment.description}</p>
          </div>
          {bankPayment.checkoutUrl && (
            <a href={bankPayment.checkoutUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white">
              Mở trang thanh toán payOS
            </a>
          )}
          <p className="mt-3 animate-pulse font-semibold text-amber-700">Đang chờ ngân hàng xác nhận giao dịch...</p>
          <p className="mt-2 text-sm text-slate-600">{bankPayment.message}</p>
        </div>
      )}
    </div>
  );
}
