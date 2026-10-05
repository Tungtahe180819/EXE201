import { useState } from 'react';
import axios from 'axios';
import VipUpgradeModal from './VipUpgradeModal';

export default function ChatBox({ role }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Xin chào! Tôi là trợ lý AI của Eventverse. Tôi có thể giúp gì cho bạn hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const isVip = role === 'user_vip';

  if (role === 'admin_master' || role === 'admin_support') return null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      // Gọi API chatbot hỗ trợ từ Backend
      const res = await axios.post('/api/ai/chatbot', { userQuery: userMessage }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const botReply = res.data.reply || res.data.message || "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn.";
      setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
    } catch (err) {
      console.error('Không thể gọi trợ lý AI:', err);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: err.response?.data?.message || 'Hệ thống AI đang bận, vui lòng thử lại sau giây lát!'
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="fixed bottom-6 right-6 z-50">
      {/* Nút bật/tắt khung chat */}
      {!isOpen && (
        <button 
          onClick={() => isVip ? setIsOpen(true) : setIsVipModalOpen(true)}
          className="relative w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl transition hover:scale-110"
          aria-label={isVip ? 'Mở Chatbot AI' : 'Nâng cấp VIP để dùng Chatbot AI'}
        >
          💬
          {!isVip && <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-amber-400 text-xs shadow">🔒</span>}
        </button>
      )}

      {/* Khung cửa sổ chat */}
      {isOpen && (
        <div className="w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col h-[500px] overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <h4 className="font-bold text-sm">Trợ Lý AI Eventverse</h4>
                <span className="text-[10px] text-indigo-200">Sẵn sàng hỗ trợ 24/7</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-slate-200 font-bold text-lg">&times;</button>
          </div>

          {/* Danh sách tin nhắn */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-sm">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-line p-3 rounded-2xl leading-relaxed ${msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl text-slate-400 text-xs animate-pulse">
                  AI đang suy nghĩ...
                </div>
              </div>
            )}
          </div>

          {/* Ô nhập tin nhắn */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <input 
              type="text" 
              placeholder="Nhập câu hỏi của bạn..."
              value={input}
              onChange={e => setInput(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-indigo-600"
            />
            <button type="submit" className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow hover:bg-indigo-700 transition">
              Gửi
            </button>
          </form>
        </div>
      )}
    </div>
    <VipUpgradeModal isOpen={isVipModalOpen} onClose={() => setIsVipModalOpen(false)} />
    </>
  );
}
