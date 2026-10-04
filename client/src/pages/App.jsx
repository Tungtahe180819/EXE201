import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

// Vì App.jsx nằm trong thư mục pages, cần lùi 1 cấp (../) để trỏ ra thư mục components
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AddEvent from "../components/AddEvent";
import ChatBox from "../components/ChatBox";

// Các trang cùng nằm trong thư mục pages nên giữ nguyên đường dẫn ./
import Home from "./Home";
import Auth from "./Auth";
import AdminDash from "./AdminDash";
import AdminUsers from "./AdminUsers";
import AdminFeedback from './AdminFeedback';
import AdminRevenue from "./AdminRevenue";
import AdminEvents from './AdminEvents';
import SupportHome from './SupportHome';
import Profile from "./Profile";
import Cart from "./Cart";
import EventDetail from "./EventDetail";
import Events from "./Events";
import MyTickets from './MyTickets';
import TicketDetail from './TicketDetail';
import EditEvent from './EditEvent';
import EventCalendar from './EventCalendar';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import ContactSurveyModal from '../components/ContactSurveyModal';
import { LanguageContext } from '../context/LanguageContext';

function App() {
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [lang, updateLang] = useState(localStorage.getItem('lang') || 'vi');
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');
  const setLang = value => {
    localStorage.setItem('lang', value);
    document.documentElement.lang = value;
    updateLang(value);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <Navbar role={role} setRole={setRole} theme={theme} toggleTheme={toggleTheme} />

        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth key="login" setRole={setRole} />} />
            <Route path="/register" element={<Auth key="register" setRole={setRole} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/feedback" element={<ContactSurveyModal />} />

            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />

            {/* Route cho Lịch Trình & Sự Kiện */}
            <Route path="/calendar" element={<EventCalendar />} />

            <Route path="/cart" element={role === "user" ? <Cart /> : <Navigate to="/login" />} />
            <Route path="/my-tickets" element={role === "user" ? <MyTickets /> : <Navigate to="/login" />} />
            <Route path="/my-tickets/:id" element={role === "user" ? <TicketDetail /> : <Navigate to="/login" />} />
            <Route path="/profile" element={<Profile />} />

            {/* Đường dẫn hỗ trợ */}
            <Route path="/support" element={role === "admin_support" ? <SupportHome /> : <Navigate to="/" />} />
            <Route path="/support-home" element={role === "admin_support" ? <SupportHome /> : <Navigate to="/" />} />

            {/* Bảo mật Route cho Admin Master */}
            <Route path="/admin/dashboard" element={role === "admin_master" ? <AdminDash /> : <Navigate to="/" />} />
            <Route path="/admin/users" element={role === "admin_master" ? <AdminUsers /> : <Navigate to="/" />} />
            <Route path="/admin/feedback" element={role === "admin_master" ? <AdminFeedback /> : <Navigate to="/" />} />
            <Route path="/admin/revenue" element={role === "admin_master" ? <AdminRevenue /> : <Navigate to="/" />} />

            {/* Admin Master và Admin Support cùng quản lý; chỉ Admin Support được tạo mới */}
            <Route path="/admin/events" element={(role === "admin_master" || role === "admin_support") ? <AdminEvents /> : <Navigate to="/" />} />
            <Route path="/add" element={role === "admin_support" ? <AddEvent /> : <Navigate to="/admin/events" replace />} />
            <Route path="/edit-event/:id" element={(role === "admin_master" || role === "admin_support") ? <EditEvent /> : <Navigate to="/" />} />

            {/* Chuyển hướng về trang chủ nếu nhập sai URL */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        <Footer />
        <ChatBox />
      </div>
    </Router>
    </LanguageContext.Provider>
  );
}

export default App;
