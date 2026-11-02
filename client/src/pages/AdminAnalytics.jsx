import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const number = value => Number(value || 0).toLocaleString('vi-VN');
const refreshedTime = value => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
const duration = value => {
  const seconds = Math.max(0, Math.round(Number(value || 0)));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} phút ${seconds % 60} giây` : `${seconds} giây`;
};
const money = value => `${number(value)} ₫`;

function MetricCard({ label, value, icon, tone }) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
    </section>
  );
}

function EmptyState({ children }) {
  return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const [mode, setMode] = useState('report');
  const [window, setWindow] = useState('30m');

  const loadReport = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get('/api/admin/analytics', {
        params: { mode, ...(mode === 'realtime' ? { window } : {}) },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setReport(data);
      setConfigMissing(false);
    } catch (error) {
      if (error.response?.data?.code === 'GA4_NOT_CONFIGURED') setConfigMissing(true);
      else if (!silent) toast.error(error.response?.data?.message || 'Không thể tải báo cáo GA4.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [mode, window]);

  useEffect(() => {
    if (!['admin_master', 'admin_support'].includes(role)) {
      navigate('/', { replace: true });
      return undefined;
    }
    loadReport();
    if (mode !== 'realtime') return undefined;
    const refreshTimer = globalThis.window.setInterval(() => loadReport({ silent: true }), 60_000);
    return () => globalThis.window.clearInterval(refreshTimer);
  }, [loadReport, navigate, role, mode]);

  const selectMode = value => {
    setReport(null);
    setMode(value);
  };
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const isReport = mode === 'report';
  const metrics = isReport
    ? [
      ['Người dùng hoạt động', number(report?.totals.users), '👥', 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'],
      ['Người dùng mới', number(report?.totals.newUsers), '✦', 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300'],
      ['Thời gian tương tác trung bình', duration(report?.totals.averageEngagementSeconds), '◷', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'],
      ['Phiên', number(report?.totals.sessions), '↗', 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'],
    ]
    : [
      [`Người dùng hoạt động · ${window === '30m' ? '30 phút' : window === '1h' ? '1 giờ' : '1 ngày'}`, number(report?.totals.users), '👥', 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'],
      ['Lượt xem trang', number(report?.totals.pageViews), '◉', 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300'],
      ['Sự kiện', number(report?.totals.events), '⚡', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'],
    ];

  return (
    <main className="min-h-[80vh] bg-slate-100 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-5 lg:px-7">
      <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-24">
          <div className="mb-4 border-b border-slate-100 px-3 pb-4 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Eventverse</p>
            <h2 className="mt-1 text-lg font-semibold">Phân tích</h2>
          </div>
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Báo cáo</p>
          <nav className="space-y-1" aria-label="Điều hướng phân tích">
            <button type="button" onClick={() => selectMode('report')} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${isReport ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              Tổng quan nhanh về báo cáo
            </button>
            <button type="button" onClick={() => selectMode('realtime')} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${!isReport ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              Tổng quan theo thời gian thực
            </button>
            <div className="my-3 border-t border-slate-100 dark:border-slate-800" />
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Chi tiết</p>
            <button type="button" onClick={() => scrollTo('analytics-sources')} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Thu nạp lưu lượng truy cập</button>
            <button type="button" onClick={() => scrollTo('analytics-pages')} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Trang và màn hình</button>
            <button type="button" onClick={() => scrollTo('analytics-events')} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Sự kiện</button>
          </nav>
          {!isReport && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="px-3 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Khoảng thời gian</p>
              {[['30m', '30 phút'], ['1h', '1 giờ'], ['1d', '1 ngày']].map(([value, label]) => (
                <button key={value} type="button" onClick={() => { setReport(null); setWindow(value); }} aria-pressed={window === value} className={`mr-1 mb-1 rounded-lg px-3 py-2 text-xs font-semibold ${window === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</button>
              ))}
            </div>
          )}
        </aside>

        <section className="min-w-0">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Google Analytics 4</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{isReport ? 'Tổng quan nhanh về báo cáo' : 'Tổng quan theo thời gian thực'}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{report?.range || (isReport ? '28 ngày gần nhất · Dữ liệu từ GA4' : 'Dữ liệu người dùng đang hoạt động')} {report?.refreshedAt ? `· Cập nhật lúc ${refreshedTime(report.refreshedAt)}` : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isReport ? <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">28 ngày gần nhất</span> : window !== '30m' && <span className="text-xs text-slate-500">GA4 có thể trễ vài phút</span>}
              <button type="button" onClick={() => loadReport()} disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{loading ? 'Đang tải…' : 'Làm mới'}</button>
            </div>
          </header>

          {configMissing ? (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <h2 className="text-lg font-bold">Cần cấu hình quyền đọc báo cáo GA4</h2>
              <p className="mt-2 text-sm leading-6">Mã đo lường G-… chỉ gửi dữ liệu vào GA4. Để hiển thị báo cáo, server cần <code>GA4_PROPERTY_ID</code> cùng OAuth credentials có quyền đọc tài sản GA4.</p>
              <p className="mt-3 text-sm">Cấu hình <code>GA4_PROPERTY_ID</code>, <code>GA4_OAUTH_CLIENT_ID</code>, <code>GA4_OAUTH_CLIENT_SECRET</code> và <code>GA4_OAUTH_REFRESH_TOKEN</code> trong Render rồi tải lại trang.</p>
            </section>
          ) : loading && !report ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">Đang tải dữ liệu GA4…</div>
          ) : report ? (
            <>
              <div className={`mb-5 grid gap-3 ${isReport ? 'sm:grid-cols-2 2xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
                {metrics.map(([label, value, icon, tone]) => <MetricCard key={label} label={label} value={value} icon={icon} tone={tone} />)}
              </div>

              {isReport ? (
                <>
                  <section id="analytics-sources" className="mb-5 scroll-mt-28 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                      <div>
                        <h2 className="font-semibold">Thu nạp qua lưu lượng truy cập hàng đầu</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Nguồn / phương tiện phiên · {report.range}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">GA4</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="px-5 py-3 font-medium">Nguồn / phương tiện của phiên</th>
                            <th className="px-5 py-3 text-right font-medium">Phiên</th>
                            <th className="px-5 py-3 text-right font-medium">Sự kiện quan trọng</th>
                            <th className="px-5 py-3 text-right font-medium">Tổng doanh thu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.sources?.length ? report.sources.map(source => (
                            <tr key={source.source} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="max-w-[360px] truncate px-5 py-3 font-medium" title={source.source}>{source.source}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{number(source.sessions)}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{number(source.keyEvents)}</td>
                              <td className="px-5 py-3 text-right tabular-nums">{money(source.revenue)}</td>
                            </tr>
                          )) : <tr><td colSpan="4" className="px-5"><EmptyState>Chưa có dữ liệu nguồn truy cập trong khoảng thời gian này.</EmptyState></td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
                    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-4">
                        <h2 className="font-semibold">Lượt xem theo ngày</h2>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">28 ngày gần nhất</p>
                      </div>
                      <div className="h-64">
                        {report.activity?.length ? <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={report.activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="minute" minTickGap={28} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="pageViews" name="Lượt xem trang" stroke="#4285f4" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                            <Line type="monotone" dataKey="events" name="Sự kiện" stroke="#14b8a6" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer> : <EmptyState>Chưa có dữ liệu theo ngày.</EmptyState>}
                      </div>
                    </section>

                    <section id="analytics-pages" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <h2 className="font-semibold">Trang được xem nhiều</h2>
                      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                        {report.pages?.length ? report.pages.slice(0, 6).map(page => (
                          <div key={page.path} className="flex items-center justify-between gap-4 py-3 text-sm">
                            <p className="min-w-0 truncate font-medium" title={page.path}>{page.path}</p>
                            <span className="shrink-0 tabular-nums text-slate-500">{number(page.views)}</span>
                          </div>
                        )) : <EmptyState>Chưa có dữ liệu trang.</EmptyState>}
                      </div>
                    </section>

                    <section id="analytics-events" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <h2 className="font-semibold">Sự kiện hàng đầu</h2>
                      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                        {report.events?.length ? report.events.slice(0, 6).map(event => (
                          <div key={event.name} className="flex items-center justify-between gap-4 py-3 text-sm">
                            <p className="min-w-0 truncate font-medium" title={event.name}>{event.name}</p>
                            <span className="shrink-0 tabular-nums text-slate-500">{number(event.count)}</span>
                          </div>
                        )) : <EmptyState>Chưa có dữ liệu sự kiện.</EmptyState>}
                      </div>
                    </section>
                  </div>
                </>
              ) : (
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
                  <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="font-semibold">Hoạt động {window === '30m' ? 'theo phút' : 'theo giờ'}</h2>
                    <p className="mb-4 mt-1 text-xs text-slate-500 dark:text-slate-400">{report.range}</p>
                    <div className="h-72">
                      {report.activity?.length ? <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={report.activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="minute" minTickGap={28} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="pageViews" name="Lượt xem trang" stroke="#4285f4" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="events" name="Sự kiện" stroke="#14b8a6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer> : <EmptyState>Chưa có hoạt động trong khoảng thời gian này.</EmptyState>}
                    </div>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="font-semibold">Trang đang được xem</h2>
                    <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                      {report.pages?.length ? report.pages.map(page => (
                        <div key={page.path} className="py-3">
                          <p className="break-all text-sm font-medium">{page.path}</p>
                          <p className="mt-1 text-xs text-slate-500">{number(page.views)} lượt xem · {number(page.users)} người dùng</p>
                        </div>
                      )) : <EmptyState>{window !== '30m' ? 'GA4 chỉ cung cấp danh sách trang trực tiếp cho 30 phút gần nhất.' : 'Chưa có trang nào được xem.'}</EmptyState>}
                    </div>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="font-semibold">Sự kiện gần đây</h2>
                    <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                      {report.events?.length ? report.events.map(event => (
                        <div key={event.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <p className="break-all font-medium">{event.name}</p>
                          <span className="shrink-0 text-slate-500">{number(event.count)}</span>
                        </div>
                      )) : <EmptyState>{window !== '30m' ? 'Danh sách sự kiện trực tiếp có sẵn trong chế độ 30 phút.' : 'Chưa có sự kiện nào.'}</EmptyState>}
                    </div>
                  </section>
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
