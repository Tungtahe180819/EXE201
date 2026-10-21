import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const number = value => Number(value || 0).toLocaleString('vi-VN');
const refreshedTime = value => value ? new Date(value).toLocaleTimeString('vi-VN') : '';

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configMissing, setConfigMissing] = useState(false);
  const [mode, setMode] = useState('realtime');
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
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReport();
    if (mode !== 'realtime') return undefined;
    const refreshTimer = globalThis.window.setInterval(() => loadReport({ silent: true }), 60_000);
    return () => globalThis.window.clearInterval(refreshTimer);
  }, [loadReport, navigate, role, mode]);

  const metrics = [
    [`Người dùng hoạt động · ${mode === 'report' ? '30 ngày' : window}`, report?.totals.users, '👥'],
    [`Lượt xem trang · ${mode === 'report' ? '30 ngày' : window}`, report?.totals.pageViews, '👁️'],
    [`Sự kiện · ${mode === 'report' ? '30 ngày' : window}`, report?.totals.events, '⚡'],
  ];

  return (
    <main className="min-h-[75vh] bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-indigo-600">Google Analytics 4</p>
            <h1 className="mt-1 text-3xl font-black">Phân tích truy cập</h1>
            <p className="mt-2 text-sm text-slate-500">{report?.range || 'Đang tải dữ liệu GA4'}{mode === 'realtime' ? ' · Tự cập nhật mỗi phút' : ''}{report?.refreshedAt ? ` · Cập nhật lúc ${refreshedTime(report.refreshedAt)}` : ''}</p>
          </div>
          <button onClick={loadReport} disabled={loading} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Chế độ phân tích">
            {[['realtime', 'Thời gian thực'], ['report', 'Báo cáo']].map(([value, label]) => (
              <button key={value} role="tab" aria-selected={mode === value} onClick={() => { setReport(null); setMode(value); }} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${mode === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'realtime' && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Khoảng thời gian">
              {[["30m", "30 phút"], ["1h", "1 giờ"], ["1d", "1 ngày"]].map(([value, label]) => (
                <button key={value} onClick={() => { setReport(null); setWindow(value); }} aria-pressed={window === value} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${window === value ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === 'realtime' && window !== '30m' && (
          <p className="mb-5 -mt-3 text-xs text-slate-500">Khoảng 1 giờ và 1 ngày được tổng hợp theo giờ từ GA4; dữ liệu có thể trễ vài phút. GA4 Realtime trực tiếp hỗ trợ 30 phút gần nhất.</p>
        )}

        {configMissing ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <h2 className="text-lg font-black">Cần cấu hình quyền đọc báo cáo GA4</h2>
            <p className="mt-2 text-sm leading-6">Mã đo lường G-… chỉ gửi dữ liệu vào GA4. Để hiển thị báo cáo, server cần <code>GA4_PROPERTY_ID</code> cùng OAuth credentials có quyền đọc tài sản GA4.</p>
            <p className="mt-3 text-sm">Cấu hình <code>GA4_PROPERTY_ID</code>, <code>GA4_OAUTH_CLIENT_ID</code>, <code>GA4_OAUTH_CLIENT_SECRET</code> và <code>GA4_OAUTH_REFRESH_TOKEN</code> trong Render rồi tải lại trang.</p>
          </section>
        ) : loading && !report ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">Đang tải dữ liệu GA4…</div>
        ) : report ? (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.map(([label, value, icon]) => (
                <section key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 text-2xl">{icon}</div>
                  <p className="text-sm font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-black">{number(value)}</p>
                </section>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
                <h2 className="mb-5 text-xl font-black">{mode === 'report' ? 'Hoạt động theo ngày · 30 ngày qua' : `Hoạt động ${window === '30m' ? 'theo phút' : 'theo giờ'} · ${window === '30m' ? '30 phút' : window === '1h' ? '1 giờ' : '24 giờ'} qua`}</h2>
                <div className="h-80">
                  {report.activity.length ? <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.activity}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="minute" minTickGap={30} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="events" name="Sự kiện" stroke="#4f46e5" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="pageViews" name="Lượt xem trang" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-slate-400">Chưa có hoạt động trong khoảng thời gian này.</div>}
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
                  <h2 className="mb-4 text-xl font-black">Trang đang được xem</h2>
                  <p className="mb-4 text-xs text-slate-500">Theo tiêu đề trang · {mode === 'report' ? '30 ngày qua' : report?.range}</p>
                  {report.pages.length ? <div className="space-y-3">
                    {report.pages.map(page => (
                      <div key={page.path} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                        <p className="break-all font-semibold">{page.path}</p>
                        <p className="mt-1 text-sm text-slate-500">{number(page.views)} lượt xem · {number(page.users)} người dùng</p>
                      </div>
                  ))}
                  </div> : <p className="text-sm text-slate-400">{mode === 'realtime' && window !== '30m' ? 'GA4 cung cấp danh sách trang chi tiết trực tiếp cho khoảng 30 phút.' : 'Chưa có trang nào được xem trong khoảng này.'}</p>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6">
                  <h2 className="mb-4 text-xl font-black">Sự kiện gần đây</h2>
                  {report.events.length ? <div className="space-y-3">
                    {report.events.map(event => (
                      <div key={event.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                        <p className="break-all font-semibold">{event.name}</p>
                        <p className="shrink-0 text-sm text-slate-500">{number(event.count)}</p>
                      </div>
                  ))}
                  </div> : <p className="text-sm text-slate-400">{mode === 'realtime' && window !== '30m' ? 'Danh sách sự kiện trực tiếp có sẵn trong chế độ 30 phút.' : 'Chưa có sự kiện trong khoảng này.'}</p>}
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
