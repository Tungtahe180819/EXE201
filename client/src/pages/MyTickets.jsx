import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function MyTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/tickets/mine', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(({ data }) => setTickets(data))
      .catch(error => toast.error(error.response?.data?.message || 'Không thể tải danh sách vé.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-20 text-center">Đang tải vé...</div>;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="mb-8 text-3xl font-black">Vé của tôi</h1>
      {tickets.length === 0 ? <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Bạn chưa mua vé nào.</p> : (
        <div className="grid gap-4">
          {tickets.map(ticket => (
            <button key={ticket._id} onClick={() => navigate(`/my-tickets/${ticket._id}`)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
              <div>
                <h2 className="text-xl font-bold">{ticket.eventId?.title || 'Sự kiện'}</h2>
                <p className="text-sm text-slate-500">Mã vé: {ticket.ticketCode}</p>
                <p className="text-sm text-slate-500">Ngày mua: {new Date(ticket.paidAt || ticket.createdAt).toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="text-right">
                <span className="block font-bold text-blue-600">x{ticket.quantity} vé</span>
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 dark:bg-emerald-950 dark:text-emerald-300">{Number(ticket.totalPrice || 0) === 0 ? 'Miễn phí' : 'Đã thanh toán'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
