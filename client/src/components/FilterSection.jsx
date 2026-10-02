import { useEffect, useState } from 'react';
import axios from 'axios';

const categoryIcons = {
  'Công nghệ': '💻',
  'Âm nhạc': '🎶',
  'Thể thao': '⚽',
  'Giáo dục': '📚',
  'Ẩm thực': '🍜',
  'Gaming': '🎮',
  'Nghệ thuật': '🎨'
};

export default function FilterSection({ selectedCategory, setSelectedCategory }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get('/api/events/categories')
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  const options = [
    { id: 'all', label: 'Tất cả sự kiện 🌟' },
    ...categories.map(category => ({
      id: category,
      label: `${category} ${categoryIcons[category] || '🎟️'}`
    }))
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 my-6">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {options.map(cat => (
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
