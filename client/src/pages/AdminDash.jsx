import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import axios from 'axios';
import toast from 'react-hot-toast';

const initialDashboard = {
  stats: { totalEvents: 0, totalUsers: 0, activeEvents: 0, ticketsSold: 0, grossRevenue: 0, platformRevenue: 0, occupancyRate: 0 },
  chartData: [], usersByRole: [], recentEvents: [], recentTickets: [],
};

const formatCurrency = value => `${Number(value || 0).toLocaleString('vi-VN')}₫`;
const formatDate = value => value ? new Date(value).toLocaleDateString('vi-VN') : '—';

export default function AdminDash() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setDashboard({ ...initialDashboard, ...data, stats: { ...initialDashboard.stats, ...data.stats } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải dữ liệu dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role !== 'admin_master') {
      toast.error('Bạn không có quyền truy cập trang này!');
      navigate('/', { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, navigate, role]);

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center">Đang tải dashboard...</div>;

  const cards = [
    { label: 'Người dùng', value: dashboard.stats.totalUsers, icon: '👥', color: 'text-blue-600 bg-blue-50' },
    { label: 'Tổng sự kiện', value: dashboard.stats.totalEvents, icon: '📅', color: 'text-violet-600 bg-violet-50' },
    { label: 'Sự kiện sắp tới', value: dashboard.stats.activeEvents, icon: '🚀', color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Vé đã bán', value: dashboard.stats.ticketsSold, icon: '🎟️', color: 'text-amber-600 bg-amber-50' },
    { label: 'Tổng doanh thu', value: formatCurrency(dashboard.stats.grossRevenue), icon: '💰', color: 'text-rose-600 bg-rose-50' },
    { label: 'Lợi nhuận nền tảng (25%)', value: formatCurrency(dashboard.stats.platformRevenue), icon: '📈', color: 'text-indigo-600 bg-indigo-50' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">Admin Master</p>
            <h1 className="text-3xl font-black">Tổng quan hệ thống</h1>
            <p className="mt-1 text-sm text-slate-500">Theo dõi hoạt động và hiệu quả kinh doanh của Eventverse.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/users" className="rounded-xl bg-white px-4 py-2 font-bold shadow-sm ring-1 ring-slate-200">Người dùng</Link>
            <Link to="/admin/events" className="rounded-xl bg-white px-4 py-2 font-bold shadow-sm ring-1 ring-slate-200">Sự kiện</Link>
            <Link to="/add" className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white shadow-sm">+ Tạo sự kiện</Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-xl ${card.color}`}>{card.icon}</div>
              <p className="text-sm font-semibold text-slate-500">{card.label}</p>
              <p className="mt-1 text-3xl font-black">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">Doanh thu theo tháng</h2><span className="text-xs font-bold text-slate-400">Tối đa 12 tháng</span></div>
            <div className="h-80">
              {dashboard.chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" /><YAxis tickFormatter={value => `${Math.round(value / 1000)}k`} />
                    <Tooltip formatter={value => formatCurrency(value)} /><Legend />
                    <Bar dataKey="revenue" name="Doanh thu" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" name="Lợi nhuận" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-slate-400">Chưa có dữ liệu giao dịch.</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-black">Hiệu suất</h2>
            <div className="mb-6 flex justify-center">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-[14px] border-indigo-100 text-center">
                <div><p className="text-3xl font-black text-indigo-600">{dashboard.stats.occupancyRate}%</p><p className="text-xs text-slate-500">Lấp đầy</p></div>
              </div>
            </div>
            <div className="space-y-3">
              {dashboard.usersByRole.map(item => (
                <div key={item.role} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm font-semibold">{item.role}</span><span className="font-black text-indigo-600">{item.count}</span></div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black">Sự kiện gần đây</h2><Link to="/admin/events" className="text-sm font-bold text-indigo-600">Xem tất cả</Link></div>
            <div className="divide-y">
              {dashboard.recentEvents.map(event => (
                <div key={event._id} className="flex items-center justify-between gap-4 p-4">
                  <div><p className="font-bold">{event.title}</p><p className="text-xs text-slate-500">{event.category} · {formatDate(event.startDate)}</p></div>
                  <span className="whitespace-nowrap rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">{event.bookedSlots}/{event.totalSlots} vé</span>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b p-5"><h2 className="text-xl font-black">Giao dịch gần đây</h2></div>
            <div className="divide-y">
              {dashboard.recentTickets.length ? dashboard.recentTickets.map(ticket => (
                <div key={ticket._id} className="flex items-center justify-between gap-4 p-4">
                  <div><p className="font-bold">{ticket.eventId?.title || 'Sự kiện'}</p><p className="text-xs text-slate-500">{ticket.userId?.name || ticket.userId?.email || 'Người dùng'} · {formatDate(ticket.createdAt)}</p></div>
                  <span className="whitespace-nowrap font-black text-emerald-600">{formatCurrency(ticket.totalPrice)}</span>
                </div>
              )) : <p className="p-8 text-center text-slate-400">Chưa có giao dịch.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
