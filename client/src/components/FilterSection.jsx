export default function FilterSection({ selectedCategory, setSelectedCategory }) {
  const categories = [
    { id: 'all', label: 'Tất cả sự kiện 🌟' },
    { id: 'Công nghệ', label: 'Công nghệ & AI 💻' },
    { id: 'Âm nhạc', label: 'Âm nhạc & Lễ hội 🎶' },
    { id: 'Thể thao', label: 'Thể thao & Giải trí ⚽' },
    { id: 'Giáo dục', label: 'Học thuật & Workshop 📚' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 my-6">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm whitespace-nowrap transition-all shadow-sm ${
              selectedCategory === cat.id 
                ? 'bg-indigo-600 text-white shadow-indigo-500/30 shadow-lg' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
