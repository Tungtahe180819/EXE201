import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { formatEventPrice } from '../utils/formatPrice';
import toast from 'react-hot-toast';
import { TicketQRCard } from '../components/TicketQRCard';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/tickets/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(({ data }) => setTicket(data))
      .catch(error => toast.error(error.response?.data?.message || 'Không tìm thấy vé.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-20 text-center">Đang tải vé...</div>;
  if (!ticket) return <div className="p-20 text-center">Không tìm thấy thông tin vé!</div>;

  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-3xl bg-white p-10 shadow-lg">
      <button onClick={() => navigate(-1)} className="mb-6 font-bold text-blue-600">← Quay lại</button>
      <h1 className="mb-6 text-3xl font-black">{ticket.eventId?.title || 'Vé sự kiện'}</h1>
      <div className="mb-8 space-y-3">
        <p><strong>Ngày mua:</strong> {new Date(ticket.paidAt || ticket.createdAt).toLocaleString('vi-VN')}</p>
        <p><strong>Số lượng:</strong> {ticket.quantity} vé</p>
        <p><strong>Tổng tiền:</strong> {formatEventPrice(ticket.totalPrice)}</p>
        <p><strong>Trạng thái:</strong> <span className="font-bold text-green-600">Đã thanh toán</span></p>
      </div>
      <TicketQRCard ticket={{ ...ticket, eventName: ticket.eventId?.title, eventId: ticket.eventId?._id }} />
    </div>
  );
}
