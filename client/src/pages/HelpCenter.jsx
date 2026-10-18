import { Link } from 'react-router-dom';

const policies = [
  { title: 'Gửi khiếu nại ở đâu?', text: 'Chọn mục Góp ý trên thanh điều hướng hoặc dùng biểu mẫu Liên hệ hỗ trợ. Chọn “Khiếu nại” và cung cấp email cùng mã đơn/mã vé để đội ngũ kiểm tra.' },
  { title: 'Hủy vé hoặc xác nhận tham gia', text: 'Vé sự kiện đã thanh toán và xác nhận tham gia miễn phí là hai loại khác nhau. Với xác nhận tham gia miễn phí, bạn có thể hủy trong Nhật ký tham gia. Yêu cầu hủy/hoàn vé đã thanh toán cần gửi qua hỗ trợ để được kiểm tra theo tình trạng đơn.' },
  { title: 'Yêu cầu hoàn tiền', text: 'Gửi biểu mẫu “Yêu cầu hoàn tiền”, ghi mã đơn, mã vé và lý do. Hệ thống chưa tự động hoàn tiền khi bạn gửi yêu cầu; nhân viên sẽ xác nhận kết quả qua email.' },
  { title: 'Đặt cọc và xác nhận tham gia', text: 'Eventverse hiện không thu khoản cọc riêng để giữ chỗ. Nếu sự kiện yêu cầu điều kiện thanh toán cụ thể, vui lòng xem phần thông tin sự kiện hoặc liên hệ ban tổ chức trước khi thanh toán.' }
];

export default function HelpCenter() {
  return <main className="mx-auto my-10 max-w-4xl px-4">
    <header className="mb-8 rounded-3xl bg-indigo-600 p-8 text-white shadow-xl">
      <p className="text-sm font-bold uppercase tracking-wider text-indigo-200">Trung tâm hỗ trợ</p>
      <h1 className="mt-2 text-3xl font-black">Cần trợ giúp về sự kiện hoặc vé?</h1>
      <p className="mt-3 max-w-2xl text-indigo-100">Xem hướng dẫn bên dưới. Để gửi yêu cầu cụ thể, hãy chọn đúng loại trong biểu mẫu và đính kèm mã đơn/mã vé.</p>
      <Link to="/feedback" className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-indigo-700">Gửi yêu cầu hỗ trợ</Link>
    </header>
    <section className="grid gap-4">{policies.map(item => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-black">{item.title}</h2><p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{item.text}</p></article>)}</section>
  </main>;
}
