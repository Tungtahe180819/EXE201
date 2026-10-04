import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

export default function AddEvent() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    
    const [formData, setFormData] = useState({
        title: '', category: '', description: '', price: '', address: '', city: 'Hà Nội',
        totalSlots: '', image: '', startDate: null, endDate: null,
        isRecurring: false, frequency: 'weekly', untilDate: '', timezone: 'Asia/Ho_Chi_Minh'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Kiểm tra dữ liệu thời gian trước khi gửi
        if (!formData.startDate || !formData.endDate) {
            toast.error("Vui lòng chọn đầy đủ ngày giờ!");
            return;
        }

        if (formData.endDate <= formData.startDate) {
            toast.error("Thời gian kết thúc phải sau thời gian bắt đầu!");
            return;
        }

        if (Number(formData.price) < 0 || Number(formData.totalSlots) < 1) {
            toast.error("Giá vé hoặc số lượng vé không hợp lệ!");
            return;
        }

        const payload = {
            title: formData.title,
            category: formData.category,
            description: formData.description,
            price: Number(formData.price),
            stock: Number(formData.totalSlots),
            totalSlots: Number(formData.totalSlots),
            image: formData.image,
            location: { address: formData.address, city: formData.city },
            startDate: formData.startDate.toISOString(),
            endDate: formData.endDate.toISOString(),
            timezone: formData.timezone,
            recurrence: {
                isRecurring: formData.isRecurring,
                frequency: formData.isRecurring ? formData.frequency : 'none',
                untilDate: formData.isRecurring ? formData.untilDate : undefined
            }
        };

        try {
            setSubmitting(true);
            await axios.post('/api/events', payload, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            // 3. Thông báo và chuyển hướng về trang chủ
            toast.success('Đăng sự kiện thành công! 🎉');
            navigate('/admin/events');
            
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Lỗi khi đăng sự kiện, vui lòng kiểm tra lại!');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold mb-6">Tạo sự kiện mới</h2>
            
            <input required className="w-full p-3 border rounded-xl" placeholder="Tên sự kiện" 
                value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />

            <select required className="w-full p-3 border rounded-xl" value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="">Chọn danh mục</option>
                <option value="Âm nhạc">Âm nhạc</option>
                <option value="Công nghệ">Công nghệ</option>
                <option value="Gaming">Gaming</option>
                <option value="Thể thao">Thể thao</option>
                <option value="Ẩm thực">Ẩm thực</option>
                <option value="Nghệ thuật">Nghệ thuật</option>
                <option value="Giáo dục">Giáo dục</option>
                <option value="Khác">Khác</option>
            </select>
            
            <textarea required className="w-full p-3 border rounded-xl" placeholder="Mô tả" 
                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            
            <div className="grid grid-cols-2 gap-4">
                <input required min="0" type="number" className="p-3 border rounded-xl" placeholder="Giá vé"
                    value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                <input required min="1" type="number" className="p-3 border rounded-xl" placeholder="Số lượng vé"
                    value={formData.totalSlots} onChange={e => setFormData({ ...formData, totalSlots: e.target.value })} />
            </div>

            <input required className="w-full p-3 border rounded-xl" placeholder="Địa chỉ"
                value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />

            <input required className="w-full p-3 border rounded-xl" placeholder="Thành phố"
                value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />

            <input required type="url" className="w-full p-3 border rounded-xl" placeholder="URL ảnh sự kiện"
                value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300">Thời gian bắt đầu</label>
                    <DatePicker 
                        selected={formData.startDate}
                        onChange={(date) => setFormData({ ...formData, startDate: date })}
                        showTimeSelect 
                        timeFormat="HH:mm" 
                        dateFormat="dd/MM/yyyy HH:mm" 
                        className="w-full p-3 border rounded-xl"
                        placeholderText="Chọn ngày giờ bắt đầu"
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-slate-300">Thời gian kết thúc</label>
                    <DatePicker 
                        selected={formData.endDate}
                        onChange={(date) => setFormData({ ...formData, endDate: date })}
                        showTimeSelect 
                        timeFormat="HH:mm" 
                        dateFormat="dd/MM/yyyy HH:mm" 
                        className="w-full p-3 border rounded-xl"
                        placeholderText="Chọn ngày giờ kết thúc"
                    />
                </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
                <label className="flex items-center gap-3 font-semibold">
                    <input type="checkbox" checked={formData.isRecurring} onChange={e => setFormData({ ...formData, isRecurring: e.target.checked })} />
                    Sự kiện lặp lại
                </label>
                {formData.isRecurring && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <select value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })} className="rounded-xl border p-3">
                            <option value="daily">Hằng ngày</option>
                            <option value="weekly">Hằng tuần</option>
                            <option value="monthly">Hằng tháng</option>
                        </select>
                        <input required type="date" value={formData.untilDate} onChange={e => setFormData({ ...formData, untilDate: e.target.value })} className="rounded-xl border p-3" />
                    </div>
                )}
                <label className="block text-sm font-semibold">Múi giờ
                    <select value={formData.timezone} onChange={e => setFormData({ ...formData, timezone: e.target.value })} className="mt-1 w-full rounded-xl border p-3">
                        <option value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</option>
                        <option value="Asia/Bangkok">Bangkok (UTC+7)</option>
                        <option value="Asia/Singapore">Singapore (UTC+8)</option>
                        <option value="UTC">UTC</option>
                    </select>
                </label>
            </div>

            <button disabled={submitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-60">
                {submitting ? 'Đang tạo sự kiện...' : 'Đăng sự kiện'}
            </button>
        </form>
    );
}
