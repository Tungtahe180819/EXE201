const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Chưa cấu hình EMAIL_USER và EMAIL_PASS.');
  }

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

async function sendTicketConfirmation({ user, tickets }) {
  const transporter = createTransporter();
  const rows = tickets.map(ticket => {
    const event = ticket.eventId || {};
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(event.title || 'Sự kiện Eventverse')}</strong><br><span style="color:#64748b">${escapeHtml(event.startDate ? new Date(event.startDate).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '')}</span></td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0">${ticket.quantity}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:bold">${escapeHtml(ticket.ticketCode)}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0">${Number(ticket.totalPrice).toLocaleString('vi-VN')}₫</td>
      </tr>`;
  }).join('');

  const attachments = await Promise.all(tickets.map(async (ticket, index) => ({
    filename: `eventverse-ticket-${ticket.ticketCode}.png`,
    content: await QRCode.toBuffer(JSON.stringify({
      ticketId: ticket._id,
      ticketCode: ticket.ticketCode,
      userId: ticket.userId,
      eventId: ticket.eventId?._id || ticket.eventId
    }), { type: 'png', width: 360, margin: 2 }),
    cid: `ticket-${index}@eventverse`
  })));

  const qrImages = tickets.map((ticket, index) => `
    <div style="display:inline-block;margin:12px;text-align:center">
      <img src="cid:ticket-${index}@eventverse" width="180" height="180" alt="QR ${escapeHtml(ticket.ticketCode)}">
      <div style="font-family:monospace;font-weight:bold">${escapeHtml(ticket.ticketCode)}</div>
    </div>`).join('');

  const total = tickets.reduce((sum, ticket) => sum + Number(ticket.totalPrice || 0), 0);
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `Eventverse <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `Vé Eventverse của bạn – ${tickets.map(ticket => ticket.ticketCode).join(', ')}`,
    html: `
      <div style="max-width:720px;margin:auto;font-family:Arial,sans-serif;color:#0f172a">
        <div style="background:#4f46e5;color:white;padding:24px;border-radius:16px 16px 0 0"><h1 style="margin:0">Eventverse 🎟️</h1><p style="margin:8px 0 0">Thanh toán thành công</p></div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0">
          <p>Xin chào <strong>${escapeHtml(user.name || user.email)}</strong>,</p>
          <p>Đơn hàng của bạn đã được xác nhận. Vui lòng xuất trình mã QR khi tham gia sự kiện.</p>
          <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f8fafc"><th style="padding:12px;text-align:left">Sự kiện</th><th style="padding:12px;text-align:left">SL</th><th style="padding:12px;text-align:left">Mã vé</th><th style="padding:12px;text-align:left">Thành tiền</th></tr></thead><tbody>${rows}</tbody></table>
          <p style="font-size:20px;text-align:right"><strong>Tổng: ${total.toLocaleString('vi-VN')}₫</strong></p>
          <div style="text-align:center">${qrImages}</div>
          <p style="color:#64748b;font-size:13px">Email được gửi tự động từ Eventverse. Không chia sẻ mã vé với người khác.</p>
        </div>
      </div>`,
    attachments
  });

  return info.messageId;
}

async function sendPasswordResetEmail({ user, resetUrl }) {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `Eventverse <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Đặt lại mật khẩu Eventverse',
    html: `
      <div style="max-width:620px;margin:auto;font-family:Arial,sans-serif;color:#0f172a">
        <div style="background:#4f46e5;color:white;padding:24px;border-radius:16px 16px 0 0">
          <h1 style="margin:0">Eventverse 🔐</h1>
        </div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0">
          <p>Xin chào <strong>${escapeHtml(user.name || user.email)}</strong>,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
          <p style="text-align:center;margin:30px 0">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#4f46e5;color:white;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:10px">Đặt lại mật khẩu</a>
          </p>
          <p>Liên kết này chỉ có hiệu lực trong 15 phút và chỉ sử dụng được một lần.</p>
          <p>Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này.</p>
          <p style="color:#64748b;font-size:13px;word-break:break-all">Nếu nút không hoạt động, mở liên kết sau:<br>${escapeHtml(resetUrl)}</p>
        </div>
      </div>`
  });

  return info.messageId;
}

async function sendBookingReminder({ booking }) {
  const transporter = createTransporter();
  const event = booking.eventId;
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || `Eventverse <${process.env.EMAIL_USER}>`,
    to: booking.userId.email,
    subject: `[Nhắc lịch] ${event.title} sắp bắt đầu`,
    html: `<div style="font-family:Arial,sans-serif"><h2>Eventverse ⏰</h2><p>Xin chào <strong>${escapeHtml(booking.userId.name || booking.userId.email)}</strong>,</p><p>Sự kiện <strong>${escapeHtml(event.title)}</strong> sẽ bắt đầu lúc ${escapeHtml(booking.bookingTime.toLocaleString('vi-VN', { timeZone: event.timezone || 'Asia/Ho_Chi_Minh' }))}.</p><p>Địa điểm: ${escapeHtml(event.location?.address || '')}, ${escapeHtml(event.location?.city || '')}</p></div>`
  });
}

module.exports = { sendTicketConfirmation, sendPasswordResetEmail, sendBookingReminder };
