import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { lang, setLang } = useLanguage();

  // Nội dung đa ngôn ngữ cho Footer
  const content = {
    vi: {
      aboutTitle: "Về Eventverse 🌐",
      aboutDesc: "Nền tảng quản lý sự kiện, kết nối cộng đồng và đặt vé thông minh hàng đầu tại Việt Nam.",
      contactTitle: "Kênh Liên Hệ Doanh Nghiệp",
      hotline: "Hotline: (+84) 999 888 666",
      email: "Email: support@eventverse.vn",
      address: "Địa chỉ: Khu Công nghệ cao Hòa Lạc, Thạch Thất, Hà Nội",
      socialTitle: "Mạng Xã Hội",
      langTitle: "Ngôn Ngữ",
      rights: "© 2026 Eventverse. Bản quyền thuộc về đội ngũ phát triển."
    },
    en: {
      aboutTitle: "About Eventverse 🌐",
      aboutDesc: "The leading event management, community connection, and smart ticketing platform in Vietnam.",
      contactTitle: "Corporate Contact Channels",
      hotline: "Hotline: (+84) 999 888 666",
      email: "Email: support@eventverse.vn",
      address: "Address: Hoa Lac Hi-Tech Park, Thach That, Hanoi",
      socialTitle: "Social Media",
      langTitle: "Language",
      rights: "© 2026 Eventverse. All rights reserved."
    }
  };

  const t = content[lang];

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-16 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        
        {/* Cột 1: Giới thiệu dự án */}
        <div className="space-y-4">
          <h3 className="text-xl font-black text-white">{t.aboutTitle}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {t.aboutDesc}
          </p>
        </div>

        {/* Cột 2: Kênh liên hệ doanh nghiệp (Hotline, Email, Địa chỉ) */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{t.contactTitle}</h3>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li className="flex items-center gap-2 hover:text-indigo-400 transition">
              <span>📞</span> <a href="tel:+84999888666">{t.hotline}</a>
            </li>
            <li className="flex items-center gap-2 hover:text-indigo-400 transition">
              <span>✉️</span> <a href="mailto:support@eventverse.vn">{t.email}</a>
            </li>
            <li className="flex items-start gap-2 hover:text-indigo-400 transition">
              <span>📍</span> <span>{t.address}</span>
            </li>
          </ul>
          <a href="/feedback" className="inline-block text-sm font-bold text-indigo-400 hover:text-indigo-300">Gửi liên hệ và khảo sát →</a>
        </div>

        {/* Cột 3: Mạng xã hội (Facebook, TikTok, Instagram) */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{t.socialTitle}</h3>
          <div className="flex gap-3">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600 flex items-center justify-center text-white transition shadow-md">
              📘
            </a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600 flex items-center justify-center text-white transition shadow-md">
              🎵
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600 flex items-center justify-center text-white transition shadow-md">
              📸
            </a>
          </div>
        </div>

        {/* Cột 4: Chuyển đổi ngôn ngữ (Tiếng Việt / English) */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">{t.langTitle}</h3>
          <div className="flex items-center bg-slate-800 p-1.5 rounded-2xl w-fit border border-slate-700">
            <button 
              onClick={() => setLang('vi')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${lang === 'vi' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🇻🇳 Tiếng Việt
            </button>
            <button 
              onClick={() => setLang('en')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${lang === 'en' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

      </div>

      {/* Dòng bản quyền phía dưới */}
      <div className="max-w-7xl mx-auto px-4 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
        {t.rights}
      </div>
    </footer>
  );
}
