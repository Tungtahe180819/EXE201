import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Cart() {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
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
      const { data } = await axios.post('/api/tickets/checkout', {
        items: cart.map(item => ({ eventId: item._id, quantity: item.quantity, ticketType: item.category }))
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    </div>
  );
}
