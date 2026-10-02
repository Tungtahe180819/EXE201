import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Cart() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('local');
  const [bankPayment, setBankPayment] = useState(null);
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

  const updateQuantity = (item, delta) => {
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
      const items = cart.map(item => ({ eventId: item._id, quantity: item.quantity, ticketType: item.category }));
      const endpoint = paymentMethod === 'local' ? '/api/tickets/checkout' : '/api/payments/create';
      const { data } = await axios.post(endpoint, {
        items,
        ...(paymentMethod !== 'local' ? { provider: paymentMethod } : {})
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.paymentUrl) {
        window.location.assign(data.paymentUrl);
        return;
      }
      if (data.qrDataURL) {
        setBankPayment(data);
        toast.success('Đã tạo mã QR chuyển khoản ngân hàng.');
        return;
      }
      localStorage.removeItem('cart');
      setCart([]);
      toast.success(data.message || 'Thanh toán thành công!');
      navigate('/my-tickets');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toán thất bại, vui lòng thử lại.');
    } finally {
      setPaying(false);
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);

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
              <p className="text-sm text-slate-500">{Number(item.price || 0).toLocaleString('vi-VN')}₫ / vé</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => updateQuantity(item, -1)} className="h-9 w-9 rounded-lg border font-bold">−</button>
              <span className="w-8 text-center font-black">{item.quantity}</span>
              <button onClick={() => updateQuantity(item, 1)} className="h-9 w-9 rounded-lg border font-bold">+</button>
              <button onClick={() => removeItem(item._id)} className="ml-2 font-bold text-red-500">Xóa</button>
            </div>
            <p className="text-lg font-black text-indigo-600">{((Number(item.price) || 0) * item.quantity).toLocaleString('vi-VN')}₫</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-indigo-600 p-6 text-white shadow-xl sm:flex-row">
        <div><p className="text-sm text-indigo-200">Tổng thanh toán</p><p className="text-3xl font-black">{totalPrice.toLocaleString('vi-VN')}₫</p></div>
        <button disabled={paying} onClick={handleCheckout} className="rounded-xl bg-white px-8 py-3 font-bold text-indigo-600 disabled:opacity-60">
          {paying ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-black">Phương thức thanh toán</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['local', '🧪 Thanh toán thử'],
            ['momo', '💗 Ví MoMo'],
            ['vnpay', '💳 VNPAY'],
            ['bank', '🏦 Chuyển khoản QR']
          ].map(([value, label]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 font-bold transition ${paymentMethod === value ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="radio" name="paymentMethod" value={value} checked={paymentMethod === value} onChange={() => { setPaymentMethod(value); setBankPayment(null); }} className="mr-2" />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">MoMo và VNPAY dùng môi trường sandbox. Chuyển khoản ngân hàng tạo mã VietQR và cần đối soát trước khi phát hành vé.</p>
      </div>

      {bankPayment && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-slate-900">
          <h2 className="text-xl font-black">Quét mã để chuyển khoản</h2>
          <img src={bankPayment.qrDataURL} alt="Mã VietQR thanh toán" className="mx-auto my-4 max-h-[520px] rounded-xl" />
          <p className="font-bold">Nội dung: {bankPayment.description}</p>
          <p className="mt-2 text-sm text-slate-600">{bankPayment.message}</p>
        </div>
      )}
    </div>
  );
}
