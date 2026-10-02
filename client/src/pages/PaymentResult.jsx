import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider');
  const token = localStorage.getItem('token');
  const validRequest = Boolean(token && ['momo', 'vnpay'].includes(provider));
  const [state, setState] = useState(() => validRequest
    ? { loading: true, success: false, message: 'Đang xác thực giao dịch...' }
    : { loading: false, success: false, message: 'Thông tin giao dịch không hợp lệ hoặc phiên đăng nhập đã hết hạn.' });

  useEffect(() => {
    const query = new URLSearchParams(searchParams);
    query.delete('provider');
    if (!validRequest) return;
    axios.get(`/api/payments/verify/${provider}?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        localStorage.removeItem('cart');
        setState({ loading: false, success: true, message: data.message || 'Thanh toán thành công.' });
      })
      .catch(error => setState({ loading: false, success: false, message: error.response?.data?.message || 'Không thể xác thực giao dịch.' }));
  }, [provider, searchParams, token, validRequest]);

  return (
    <div className="mx-auto my-16 max-w-xl rounded-3xl border bg-white p-10 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 text-6xl">{state.loading ? '⏳' : state.success ? '✅' : '❌'}</div>
      <h1 className="mb-3 text-2xl font-black">{state.loading ? 'Đang xử lý' : state.success ? 'Thanh toán thành công' : 'Thanh toán chưa thành công'}</h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">{state.message}</p>
      {!state.loading && <Link to={state.success ? '/my-tickets' : '/cart'} className="inline-block rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white">
        {state.success ? 'Xem vé của tôi' : 'Quay lại giỏ hàng'}
      </Link>}
    </div>
  );
}
