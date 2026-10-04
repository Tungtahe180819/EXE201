import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminRevenue() {
  const revData = [{ name: 'T1', d: 1000 }, { name: 'T2', d: 2500 }];

  return (
    <div className="flex min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="flex-1 p-10">
        <h2 className="text-3xl font-bold mb-8">Doanh thu hệ thống</h2>
        <div className="h-96 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="d" stroke="#2563eb" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
