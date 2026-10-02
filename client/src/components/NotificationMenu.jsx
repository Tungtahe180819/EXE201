import { useEffect, useState } from 'react';
import axios from 'axios';

export default function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) return undefined;
    const load = async () => {
      try {
        const { data } = await axios.get('/api/user/notifications', { headers: { Authorization: `Bearer ${token}` } });
        setItems(data);
        const unseenReminder = data.find(item => item.type === 'reminder' && !item.isRead);
        if (unseenReminder && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Eventverse nhắc lịch', { body: unseenReminder.message });
        }
      } catch { /* Giữ menu im lặng nếu phiên đăng nhập đã hết hạn. */ }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [token]);

  const markRead = async item => {
    if (!item.isRead) {
      await axios.patch(`/api/user/notifications/${item._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setItems(current => current.map(value => value._id === item._id ? { ...value, isRead: true } : value));
    }
  };

  const unread = items.filter(item => !item.isRead).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(value => !value)} className="relative rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Thông báo">
        🔔{unread > 0 && <span className="absolute right-0 top-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b p-4 font-bold dark:border-slate-700">Thông báo</div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-sm text-slate-500">Chưa có thông báo.</p>}
            {items.map(item => (
              <button key={item._id} onClick={() => markRead(item)} className={`block w-full border-b p-4 text-left text-sm dark:border-slate-800 ${item.isRead ? 'bg-white dark:bg-slate-900' : 'bg-indigo-50 dark:bg-indigo-950/40'}`}>
                <p>{item.message}</p>
                <span className="mt-1 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
