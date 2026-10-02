import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminRevenue() {
  const revData = [{ name: 'T1', d: 1000 }, { name: 'T2', d: 2500 }];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-10">
        <h2 className="text-3xl font-bold mb-8">Doanh thu hệ thống</h2>
        <div className="bg-white p-8 rounded-3xl shadow-sm h-96">
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